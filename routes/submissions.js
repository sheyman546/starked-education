const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const Grade = require('../models/Grade');
const Group = require('../models/Group');
const Course = require('../models/Course');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const plagiarismService = require('../services/plagiarismService');

// Configure multer for submission files
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../media/submissions', req.params.assignmentId);
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5
  }
});

// GET /api/submissions/student - Get student's submissions
router.get('/student', auth, async (req, res) => {
  try {
    const { courseId, status, page = 1, limit = 10 } = req.query;

    let query = { student: req.user.id };
    
    if (courseId) {
      query.assignment = { $in: await Assignment.find({ course: courseId }).distinct('_id') };
    }
    
    if (status) {
      query.status = status;
    }

    const submissions = await Submission.find(query)
      .populate('assignment', 'title dueDate points course')
      .populate('grade')
      .sort({ createdAt: -1 })
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
      }
    });
  } catch (error) {
    console.error('Error fetching student submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /api/submissions/:id - Get submission details
router.get('/:id', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('assignment', 'title dueDate points course instructor')
      .populate('student', 'firstName lastName email')
      .populate('grade')
      .populate('group', 'name members');

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check access permissions
    const isOwner = submission.student._id.toString() === req.user.id;
    const isInstructor = submission.assignment.instructor.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isInstructor && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't show grade to student if not released
    if (isOwner && submission.grade && !submission.grade.release.released) {
      submission.grade = null;
    }

    res.json(submission);
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// POST /api/submissions/assignment/:assignmentId - Create or update submission
router.post('/assignment/:assignmentId', auth, upload.array('files', 5), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if student is enrolled in course
    const course = await Course.findById(assignment.course);
    const isEnrolled = course.enrolledStudents.some(enrollment => 
      enrollment.student.toString() === req.user.id
    );

    if (!isEnrolled && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not enrolled in this course' });
    }

    // Check if submission deadline has passed
    const now = new Date();
    const isLate = now > assignment.dueDate;
    
    if (isLate && !assignment.lateSubmissionAllowed) {
      return res.status(400).json({ error: 'Late submissions not allowed' });
    }

    if (isLate && assignment.lateDeadline && now > assignment.lateDeadline) {
      return res.status(400).json({ error: 'Late submission deadline has passed' });
    }

    // Find existing submission or create new one
    let submission = await Submission.findOne({
      assignment: assignment._id,
      student: req.user.id,
      status: { $in: ['draft', 'submitted'] }
    });

    if (!submission) {
      submission = new Submission({
        assignment: assignment._id,
        student: req.user.id,
        attempt: 1
      });
    }

    // Update submission content
    const { text, code, links, submit = false } = req.body;

    if (text) {
      submission.content.text = text;
    }

    if (code) {
      try {
        const codeData = JSON.parse(code);
        submission.content.code = codeData;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid code data format' });
      }
    }

    if (links) {
      try {
        const linksData = JSON.parse(links);
        submission.content.links = linksData;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid links data format' });
      }
    }

    // Add uploaded files
    if (req.files && req.files.length > 0) {
      const files = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/media/submissions/${assignment._id}/${file.filename}`
      }));

      submission.content.files = files;
    }

    // Check file limits
    const fileCheck = submission.exceedsFileLimits();
    if (fileCheck.exceedsSize) {
      return res.status(400).json({ 
        error: `File size limit exceeded. Maximum: ${assignment.maxFileSize / 1024 / 1024}MB` 
      });
    }

    if (fileCheck.exceedsCount) {
      return res.status(400).json({ 
        error: `File count limit exceeded. Maximum: ${assignment.maxFiles} files` 
      });
    }

    submission.lastModified = new Date();

    if (submit) {
      submission.status = 'submitted';
      submission.submissionDate = new Date();
      submission.isLate = isLate;

      // Trigger plagiarism detection if enabled
      if (assignment.plagiarismDetection.enabled) {
        submission.plagiarism.status = 'pending';
        // Queue plagiarism check (would be handled by background job)
        plagiarismService.checkSubmission(submission._id);
      }

      // Update assignment submission count
      await Assignment.findByIdAndUpdate(assignment._id, {
        $inc: { submissionCount: 1 }
      });
    }

    await submission.save();

    const populatedSubmission = await Submission.findById(submission._id)
      .populate('assignment', 'title dueDate points');

    res.status(201).json(populatedSubmission);
  } catch (error) {
    console.error('Error creating submission:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create submission' });
  }
});

// PUT /api/submissions/:id - Update submission (only if draft)
router.put('/:id', auth, upload.array('files', 5), async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check if user owns this submission
    if (submission.student.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Can only update draft submissions
    if (submission.status !== 'draft') {
      return res.status(400).json({ error: 'Cannot update submitted assignment' });
    }

    // Update submission content
    const { text, code, links } = req.body;

    if (text !== undefined) {
      submission.content.text = text;
    }

    if (code !== undefined) {
      try {
        const codeData = JSON.parse(code);
        submission.content.code = codeData;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid code data format' });
      }
    }

    if (links !== undefined) {
      try {
        const linksData = JSON.parse(links);
        submission.content.links = linksData;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid links data format' });
      }
    }

    // Add uploaded files
    if (req.files && req.files.length > 0) {
      const files = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/media/submissions/${submission.assignment}/${file.filename}`
      }));

      submission.content.files = files;
    }

    submission.lastModified = new Date();
    await submission.save();

    res.json(submission);
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({ error: 'Failed to update submission' });
  }
});

// POST /api/submissions/:id/submit - Submit draft
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check if user owns this submission
    if (submission.student.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (submission.status !== 'draft') {
      return res.status(400).json({ error: 'Submission already submitted' });
    }

    const assignment = await Assignment.findById(submission.assignment);
    const now = new Date();
    const isLate = now > assignment.dueDate;

    if (isLate && !assignment.lateSubmissionAllowed) {
      return res.status(400).json({ error: 'Late submissions not allowed' });
    }

    submission.status = 'submitted';
    submission.submissionDate = new Date();
    submission.isLate = isLate;

    // Trigger plagiarism detection if enabled
    if (assignment.plagiarismDetection.enabled) {
      submission.plagiarism.status = 'pending';
      plagiarismService.checkSubmission(submission._id);
    }

    await submission.save();

    // Update assignment submission count
    await Assignment.findByIdAndUpdate(assignment._id, {
      $inc: { submissionCount: 1 }
    });

    res.json({ message: 'Submission submitted successfully' });
  } catch (error) {
    console.error('Error submitting assignment:', error);
    res.status(500).json({ error: 'Failed to submit assignment' });
  }
});

// POST /api/submissions/:id/auto-save - Auto-save draft
router.post('/:id/auto-save', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check if user owns this submission
    if (submission.student.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only auto-save drafts
    if (submission.status !== 'draft') {
      return res.status(400).json({ error: 'Cannot auto-save submitted assignment' });
    }

    const { content } = req.body;

    submission.autoSaveData = {
      content,
      lastSaved: new Date()
    };

    await submission.save();

    res.json({ message: 'Auto-saved successfully', lastSaved: submission.autoSaveData.lastSaved });
  } catch (error) {
    console.error('Error auto-saving submission:', error);
    res.status(500).json({ error: 'Failed to auto-save' });
  }
});

// DELETE /api/submissions/:id - Delete submission (only drafts)
router.delete('/:id', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check if user owns this submission
    if (submission.student.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Can only delete draft submissions
    if (submission.status !== 'draft') {
      return res.status(400).json({ error: 'Cannot delete submitted assignment' });
    }

    // Delete associated files
    if (submission.content.files && submission.content.files.length > 0) {
      for (const file of submission.content.files) {
        try {
          const filePath = path.join(__dirname, '../media/submissions', submission.assignment, file.filename);
          await fs.unlink(filePath);
        } catch (error) {
          console.error('Error deleting file:', error);
        }
      }
    }

    await Submission.findByIdAndDelete(submission._id);

    res.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

// GET /api/submissions/:id/download/:filename - Download submission file
router.get('/:id/download/:filename', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check access permissions
    const isOwner = submission.student.toString() === req.user.id;
    const isInstructor = (await Assignment.findById(submission.assignment)).instructor.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isInstructor && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const file = submission.content.files.find(f => f.filename === req.params.filename);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(__dirname, '../media/submissions', submission.assignment, file.filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(filePath, file.originalName);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

module.exports = router;
