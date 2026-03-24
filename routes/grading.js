const express = require('express');
const router = express.Router();
const Grade = require('../models/Grade');
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const Rubric = require('../models/Rubric');
const Course = require('../models/Course');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for grading attachments
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../media/grading');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'grade-' + req.params.submissionId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 3
  }
});

// GET /api/grading/submission/:submissionId - Get grade for submission
router.get('/submission/:submissionId', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId)
      .populate('assignment', 'title course instructor')
      .populate('student', 'firstName lastName email');

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check access permissions
    const isInstructor = submission.assignment.instructor.toString() === req.user.id;
    const isOwner = submission.student._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isInstructor && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let grade = await Grade.findOne({ submission: submission._id })
      .populate('grader', 'firstName lastName email')
      .populate('rubricResults.criterion')
      .populate('moderation.moderator');

    // Don't show grade to student if not released
    if (isOwner && grade && !grade.release.released) {
      grade = null;
    }

    res.json({ submission, grade });
  } catch (error) {
    console.error('Error fetching grade:', error);
    res.status(500).json({ error: 'Failed to fetch grade' });
  }
});

// POST /api/grading/submission/:submissionId - Create or update grade
router.post('/submission/:submissionId', auth, upload.array('attachments', 3), async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId)
      .populate('assignment');

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check if user is instructor or admin
    const isInstructor = submission.assignment.instructor.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Can only grade submitted assignments
    if (submission.status !== 'submitted') {
      return res.status(400).json({ error: 'Can only grade submitted assignments' });
    }

    const {
      rubricScores,
      overallFeedback,
      strengths,
      improvements,
      nextSteps,
      autoGraded = false,
      releaseImmediately = false
    } = req.body;

    // Find or create grade
    let grade = await Grade.findOne({ submission: submission._id });

    if (!grade) {
      grade = new Grade({
        submission: submission._id,
        assignment: submission.assignment._id,
        student: submission.student,
        grader: req.user.id,
        grading: {
          startedAt: new Date(),
          autoGraded
        }
      });
    }

    // Process rubric scores
    if (rubricScores) {
      try {
        const scores = JSON.parse(rubricScores);
        grade.rubricResults = scores;

        // Calculate total score from rubric
        const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
        grade.scores.earned = totalScore;
        grade.scores.total = submission.assignment.points;
        grade.scores.percentage = (totalScore / submission.assignment.points) * 100;

      } catch (error) {
        return res.status(400).json({ error: 'Invalid rubric scores format' });
      }
    }

    // Add feedback
    if (overallFeedback) {
      grade.feedback.overall = overallFeedback;
    }

    if (strengths) {
      try {
        grade.feedback.strengths = JSON.parse(strengths);
      } catch (error) {
        grade.feedback.strengths = [strengths];
      }
    }

    if (improvements) {
      try {
        grade.feedback.improvements = JSON.parse(improvements);
      } catch (error) {
        grade.feedback.improvements = [improvements];
      }
    }

    if (nextSteps) {
      try {
        grade.feedback.nextSteps = JSON.parse(nextSteps);
      } catch (error) {
        grade.feedback.nextSteps = [nextSteps];
      }
    }

    // Add attachments
    if (req.files && req.files.length > 0) {
      const attachments = req.files.map(file => ({
        filename: file.originalname,
        url: `/media/grading/${file.filename}`,
        type: file.mimetype.startsWith('image/') ? 'image' : 'document'
      }));

      grade.feedback.attachments = attachments;
    }

    // Set grading status
    grade.status = 'completed';
    grade.grading.completedAt = new Date();

    // Set release schedule
    if (releaseImmediately) {
      grade.release.released = true;
      grade.release.releasedAt = new Date();
      grade.notifications.studentNotified = true;
      grade.notifications.notifiedAt = new Date();
    }

    await grade.save();

    // Update submission status
    await Submission.findByIdAndUpdate(submission._id, {
      status: 'graded',
      grade: grade._id
    });

    // Update assignment graded count
    await Assignment.findByIdAndUpdate(submission.assignment._id, {
      $inc: { gradedCount: 1 }
    });

    const populatedGrade = await Grade.findById(grade._id)
      .populate('grader', 'firstName lastName email')
      .populate('rubricResults.criterion');

    res.status(201).json(populatedGrade);
  } catch (error) {
    console.error('Error creating grade:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create grade' });
  }
});

// PUT /api/grading/:gradeId - Update grade
router.put('/:gradeId', auth, upload.array('attachments', 3), async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.gradeId)
      .populate('submission');

    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    // Check if user is instructor or admin
    const isInstructor = grade.submission.assignment.instructor.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      rubricScores,
      overallFeedback,
      strengths,
      improvements,
      nextSteps
    } = req.body;

    // Update rubric scores
    if (rubricScores) {
      try {
        const scores = JSON.parse(rubricScores);
        grade.rubricResults = scores;

        // Recalculate total score
        const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
        grade.scores.earned = totalScore;
        grade.scores.percentage = (totalScore / grade.scores.total) * 100;

      } catch (error) {
        return res.status(400).json({ error: 'Invalid rubric scores format' });
      }
    }

    // Update feedback
    if (overallFeedback !== undefined) {
      grade.feedback.overall = overallFeedback;
    }

    if (strengths !== undefined) {
      try {
        grade.feedback.strengths = JSON.parse(strengths);
      } catch (error) {
        grade.feedback.strengths = [strengths];
      }
    }

    if (improvements !== undefined) {
      try {
        grade.feedback.improvements = JSON.parse(improvements);
      } catch (error) {
        grade.feedback.improvements = [improvements];
      }
    }

    if (nextSteps !== undefined) {
      try {
        grade.feedback.nextSteps = JSON.parse(nextSteps);
      } catch (error) {
        grade.feedback.nextSteps = [nextSteps];
      }
    }

    // Update attachments
    if (req.files && req.files.length > 0) {
      const attachments = req.files.map(file => ({
        filename: file.originalname,
        url: `/media/grading/${file.filename}`,
        type: file.mimetype.startsWith('image/') ? 'image' : 'document'
      }));

      grade.feedback.attachments = attachments;
    }

    await grade.save();

    const populatedGrade = await Grade.findById(grade._id)
      .populate('grader', 'firstName lastName email')
      .populate('rubricResults.criterion');

    res.json(populatedGrade);
  } catch (error) {
    console.error('Error updating grade:', error);
    res.status(500).json({ error: 'Failed to update grade' });
  }
});

// POST /api/grading/:gradeId/penalty - Apply penalty
router.post('/:gradeId/penalty', auth, async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.gradeId)
      .populate('submission');

    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    // Check if user is instructor or admin
    const isInstructor = grade.submission.assignment.instructor.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { type, amount, reason } = req.body;

    if (!type || amount === undefined || !reason) {
      return res.status(400).json({ error: 'Penalty type, amount, and reason are required' });
    }

    grade.applyPenalty(type, amount, reason);
    await grade.save();

    res.json({ message: 'Penalty applied successfully', grade });
  } catch (error) {
    console.error('Error applying penalty:', error);
    res.status(500).json({ error: 'Failed to apply penalty' });
  }
});

// POST /api/grading/:gradeId/bonus - Apply bonus
router.post('/:gradeId/bonus', auth, async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.gradeId)
      .populate('submission');

    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    // Check if user is instructor or admin
    const isInstructor = grade.submission.assignment.instructor.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { type, amount, reason } = req.body;

    if (!type || amount === undefined || !reason) {
      return res.status(400).json({ error: 'Bonus type, amount, and reason are required' });
    }

    grade.applyBonus(type, amount, reason);
    await grade.save();

    res.json({ message: 'Bonus applied successfully', grade });
  } catch (error) {
    console.error('Error applying bonus:', error);
    res.status(500).json({ error: 'Failed to apply bonus' });
  }
});

// POST /api/grading/:gradeId/release - Release grade to student
router.post('/:gradeId/release', auth, async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.gradeId)
      .populate('submission');

    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    // Check if user is instructor or admin
    const isInstructor = grade.submission.assignment.instructor.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    grade.release.released = true;
    grade.release.releasedAt = new Date();
    grade.notifications.studentNotified = true;
    grade.notifications.notifiedAt = new Date();

    await grade.save();

    res.json({ message: 'Grade released successfully' });
  } catch (error) {
    console.error('Error releasing grade:', error);
    res.status(500).json({ error: 'Failed to release grade' });
  }
});

// POST /api/grading/:gradeId/schedule-release - Schedule grade release
router.post('/:gradeId/schedule-release', auth, async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.gradeId)
      .populate('submission');

    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    // Check if user is instructor or admin
    const isInstructor = grade.submission.assignment.instructor.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { releaseDate } = req.body;

    if (!releaseDate) {
      return res.status(400).json({ error: 'Release date is required' });
    }

    const releaseDateTime = new Date(releaseDate);
    if (releaseDateTime <= new Date()) {
      return res.status(400).json({ error: 'Release date must be in the future' });
    }

    grade.release.scheduled = true;
    grade.release.releaseDate = releaseDateTime;

    await grade.save();

    res.json({ message: 'Grade release scheduled successfully' });
  } catch (error) {
    console.error('Error scheduling grade release:', error);
    res.status(500).json({ error: 'Failed to schedule grade release' });
  }
});

// POST /api/grading/bulk - Bulk grading operations
router.post('/bulk', auth, async (req, res) => {
  try {
    const { submissionIds, action, data } = req.body;

    if (!submissionIds || !Array.isArray(submissionIds) || !action) {
      return res.status(400).json({ error: 'Submission IDs and action are required' });
    }

    // Verify user is instructor for all submissions
    const submissions = await Submission.find({ _id: { $in: submissionIds } })
      .populate('assignment');

    const isInstructor = submissions.every(sub => 
      sub.assignment.instructor.toString() === req.user.id
    );

    if (!isInstructor && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    let results = [];

    switch (action) {
      case 'release':
        // Release all grades
        for (const submissionId of submissionIds) {
          const grade = await Grade.findOne({ submission: submissionId });
          if (grade) {
            grade.release.released = true;
            grade.release.releasedAt = new Date();
            await grade.save();
            results.push({ submissionId, success: true });
          } else {
            results.push({ submissionId, success: false, error: 'Grade not found' });
          }
        }
        break;

      case 'apply-penalty':
        // Apply penalty to all
        const { penaltyType, penaltyAmount, penaltyReason } = data;
        for (const submissionId of submissionIds) {
          const grade = await Grade.findOne({ submission: submissionId });
          if (grade) {
            grade.applyPenalty(penaltyType, penaltyAmount, penaltyReason);
            await grade.save();
            results.push({ submissionId, success: true });
          } else {
            results.push({ submissionId, success: false, error: 'Grade not found' });
          }
        }
        break;

      case 'apply-bonus':
        // Apply bonus to all
        const { bonusType, bonusAmount, bonusReason } = data;
        for (const submissionId of submissionIds) {
          const grade = await Grade.findOne({ submission: submissionId });
          if (grade) {
            grade.applyBonus(bonusType, bonusAmount, bonusReason);
            await grade.save();
            results.push({ submissionId, success: true });
          } else {
            results.push({ submissionId, success: false, error: 'Grade not found' });
          }
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid bulk action' });
    }

    res.json({ message: 'Bulk operation completed', results });
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    res.status(500).json({ error: 'Failed to perform bulk operation' });
  }
});

// GET /api/grading/assignment/:assignmentId/analytics - Get grading analytics
router.get('/assignment/:assignmentId/analytics', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if user is instructor or admin
    const isInstructor = assignment.instructor.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const grades = await Grade.find({ assignment: assignment._id })
      .populate('student', 'firstName lastName email');

    const scores = grades.map(g => g.scores.percentage).filter(p => p !== null);
    const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const median = scores.length > 0 ? scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)] : 0;

    const distribution = {
      A: grades.filter(g => g.scores.percentage >= 90).length,
      B: grades.filter(g => g.scores.percentage >= 80 && g.scores.percentage < 90).length,
      C: grades.filter(g => g.scores.percentage >= 70 && g.scores.percentage < 80).length,
      D: grades.filter(g => g.scores.percentage >= 60 && g.scores.percentage < 70).length,
      F: grades.filter(g => g.scores.percentage < 60).length
    };

    const gradingProgress = {
      totalSubmissions: await Submission.countDocuments({ assignment: assignment._id }),
      graded: await Grade.countDocuments({ assignment: assignment._id }),
      released: await Grade.countDocuments({ assignment: assignment._id, 'release.released': true })
    };

    res.json({
      average: Math.round(average * 100) / 100,
      median,
      distribution,
      gradingProgress,
      totalGrades: grades.length
    });
  } catch (error) {
    console.error('Error fetching grading analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
