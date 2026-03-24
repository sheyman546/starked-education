const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const Rubric = require('../models/Rubric');
const Submission = require('../models/Submission');
const Grade = require('../models/Grade');
const Group = require('../models/Group');
const Course = require('../models/Course');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../media/assignments');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|mp4|mp3|wav|py|js|html|css|java|cpp|c/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, documents, videos, audio, and code files are allowed.'));
    }
  }
});

// GET /api/assignments - Get all assignments for a course
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { status, type, page = 1, limit = 10 } = req.query;

    // Verify user has access to course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const query = { course: courseId };
    
    if (status) {
      query.isPublished = status === 'published';
    }
    
    if (type) {
      query.type = type;
    }

    const assignments = await Assignment.find(query)
      .populate('instructor', 'firstName lastName email')
      .populate('rubric', 'title totalPoints')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Assignment.countDocuments(query);

    res.json({
      assignments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// GET /api/assignments/:id - Get assignment details
router.get('/:id', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('instructor', 'firstName lastName email')
      .populate('rubric')
      .populate('course', 'title');

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if user has access to this assignment
    const course = await Course.findById(assignment.course._id);
    const hasAccess = course.enrolledStudents.includes(req.user.id) || 
                     course.instructor.toString() === req.user.id ||
                     req.user.role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user's submission if student
    let userSubmission = null;
    if (req.user.role === 'student') {
      userSubmission = await Submission.findOne({
        assignment: assignment._id,
        student: req.user.id
      }).populate('grade');
    }

    res.json({
      assignment,
      userSubmission,
      canSubmit: !assignment.isOverdue || assignment.isLateSubmissionOpen,
      isLate: assignment.isOverdue
    });
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// POST /api/assignments - Create new assignment
router.post('/', auth, async (req, res) => {
  try {
    // Only instructors and admins can create assignments
    if (!['instructor', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const assignmentData = {
      ...req.body,
      instructor: req.user.id
    };

    // Validate course exists and user is instructor
    const course = await Course.findById(assignmentData.course);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only course instructors can create assignments' });
    }

    const assignment = new Assignment(assignmentData);
    await assignment.save();

    // Update course with new assignment reference
    await Course.findByIdAndUpdate(assignmentData.course, {
      $push: { assignments: assignment._id }
    });

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate('instructor', 'firstName lastName email')
      .populate('rubric');

    res.status(201).json(populatedAssignment);
  } catch (error) {
    console.error('Error creating assignment:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// PUT /api/assignments/:id - Update assignment
router.put('/:id', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if user is instructor or admin
    if (assignment.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't allow changes if students have already submitted
    const submissionCount = await Submission.countDocuments({ 
      assignment: assignment._id,
      status: 'submitted'
    });

    if (submissionCount > 0 && !['isPublished', 'isVisible'].includes(Object.keys(req.body)[0])) {
      return res.status(400).json({ 
        error: 'Cannot modify assignment after students have submitted' 
      });
    }

    Object.assign(assignment, req.body);
    await assignment.save();

    const updatedAssignment = await Assignment.findById(assignment._id)
      .populate('instructor', 'firstName lastName email')
      .populate('rubric');

    res.json(updatedAssignment);
  } catch (error) {
    console.error('Error updating assignment:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// DELETE /api/assignments/:id - Delete assignment
router.delete('/:id', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if user is instructor or admin
    if (assignment.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if there are any submissions
    const submissionCount = await Submission.countDocuments({ 
      assignment: assignment._id 
    });

    if (submissionCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete assignment with existing submissions' 
      });
    }

    await Assignment.findByIdAndDelete(assignment._id);

    // Remove assignment reference from course
    await Course.findByIdAndUpdate(assignment.course, {
      $pull: { assignments: assignment._id }
    });

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// POST /api/assignments/:id/publish - Publish assignment
router.post('/:id/publish', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if user is instructor or admin
    if (assignment.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    assignment.isPublished = true;
    await assignment.save();

    res.json({ message: 'Assignment published successfully' });
  } catch (error) {
    console.error('Error publishing assignment:', error);
    res.status(500).json({ error: 'Failed to publish assignment' });
  }
});

// GET /api/assignments/:id/submissions - Get all submissions for an assignment
router.get('/:id/submissions', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if user is instructor or admin
    if (assignment.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status, page = 1, limit = 20, search } = req.query;
    
    let query = { assignment: assignment._id };
    
    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { 'content.text': { $regex: search, $options: 'i' } }
      ];
    }

    const submissions = await Submission.find(query)
      .populate('student', 'firstName lastName email')
      .populate('grade')
      .sort({ submissionDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Submission.countDocuments(query);

    res.json({
      submissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        total: await Submission.countDocuments({ assignment: assignment._id }),
        submitted: await Submission.countDocuments({ assignment: assignment._id, status: 'submitted' }),
        graded: await Submission.countDocuments({ assignment: assignment._id, status: 'graded' }),
        late: await Submission.countDocuments({ assignment: assignment._id, isLate: true })
      }
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /api/assignments/:id/analytics - Get assignment analytics
router.get('/:id/analytics', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if user is instructor or admin
    if (assignment.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const submissions = await Submission.find({ assignment: assignment._id })
      .populate('grade');

    const grades = submissions
      .filter(s => s.grade)
      .map(s => s.grade.scores.percentage);

    const averageGrade = grades.length > 0 
      ? grades.reduce((a, b) => a + b, 0) / grades.length 
      : 0;

    const gradeDistribution = {
      A: grades.filter(g => g >= 90).length,
      B: grades.filter(g => g >= 80 && g < 90).length,
      C: grades.filter(g => g >= 70 && g < 80).length,
      D: grades.filter(g => g >= 60 && g < 70).length,
      F: grades.filter(g => g < 60).length
    };

    const submissionTimeline = await Submission.aggregate([
      { $match: { assignment: assignment._id } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$submissionDate"
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalSubmissions: submissions.length,
      submittedCount: submissions.filter(s => s.status === 'submitted').length,
      gradedCount: submissions.filter(s => s.status === 'graded').length,
      lateCount: submissions.filter(s => s.isLate).length,
      averageGrade: Math.round(averageGrade * 100) / 100,
      gradeDistribution,
      submissionTimeline,
      plagiarismStats: {
        checked: submissions.filter(s => s.plagiarism.checked).length,
        flagged: submissions.filter(s => s.plagiarism.score > 75).length
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
