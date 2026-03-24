const express = require('express');
const router = express.Router();
const Rubric = require('../models/Rubric');
const Assignment = require('../models/Assignment');
const Course = require('../models/Course');
const auth = require('../middleware/auth');

// GET /api/rubrics/course/:courseId - Get rubrics for a course
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { template, page = 1, limit = 10 } = req.query;

    let query = { course: courseId };
    
    if (template === 'true') {
      query.isTemplate = true;
    } else if (template === 'false') {
      query.isTemplate = false;
    }

    const rubrics = await Rubric.find(query)
      .populate('instructor', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Rubric.countDocuments(query);

    res.json({
      rubrics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching rubrics:', error);
    res.status(500).json({ error: 'Failed to fetch rubrics' });
  }
});

// GET /api/rubrics/templates - Get rubric templates
router.get('/templates', auth, async (req, res) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;

    let query = { isTemplate: true };
    
    if (category) {
      query.templateCategory = category;
    }

    const rubrics = await Rubric.find(query)
      .populate('instructor', 'firstName lastName email')
      .sort({ usageCount: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Rubric.countDocuments(query);

    res.json({
      rubrics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching rubric templates:', error);
    res.status(500).json({ error: 'Failed to fetch rubric templates' });
  }
});

// GET /api/rubrics/:id - Get rubric details
router.get('/:id', auth, async (req, res) => {
  try {
    const rubric = await Rubric.findById(req.params.id)
      .populate('instructor', 'firstName lastName email')
      .populate('course', 'title');

    if (!rubric) {
      return res.status(404).json({ error: 'Rubric not found' });
    }

    // Check access permissions
    const isInstructor = rubric.instructor._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // For non-instructors, check if they're enrolled in the course
    let hasAccess = isInstructor || isAdmin;
    if (!hasAccess) {
      const course = await Course.findById(rubric.course._id);
      hasAccess = course.enrolledStudents.some(enrollment => 
        enrollment.student.toString() === req.user.id
      );
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(rubric);
  } catch (error) {
    console.error('Error fetching rubric:', error);
    res.status(500).json({ error: 'Failed to fetch rubric' });
  }
});

// POST /api/rubrics - Create new rubric
router.post('/', auth, async (req, res) => {
  try {
    // Only instructors and admins can create rubrics
    if (!['instructor', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rubricData = {
      ...req.body,
      instructor: req.user.id
    };

    // Validate course access
    const course = await Course.findById(rubricData.course);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only course instructors can create rubrics' });
    }

    const rubric = new Rubric(rubricData);
    await rubric.save();

    const populatedRubric = await Rubric.findById(rubric._id)
      .populate('instructor', 'firstName lastName email');

    res.status(201).json(populatedRubric);
  } catch (error) {
    console.error('Error creating rubric:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create rubric' });
  }
});

// PUT /api/rubrics/:id - Update rubric
router.put('/:id', auth, async (req, res) => {
  try {
    const rubric = await Rubric.findById(req.params.id);
    if (!rubric) {
      return res.status(404).json({ error: 'Rubric not found' });
    }

    // Check if user is instructor or admin
    if (rubric.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if rubric is used in any assignment
    const assignmentCount = await Assignment.countDocuments({ rubric: rubric._id });
    if (assignmentCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot modify rubric that is already used in assignments' 
      });
    }

    Object.assign(rubric, req.body);
    await rubric.save();

    const updatedRubric = await Rubric.findById(rubric._id)
      .populate('instructor', 'firstName lastName email');

    res.json(updatedRubric);
  } catch (error) {
    console.error('Error updating rubric:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update rubric' });
  }
});

// DELETE /api/rubrics/:id - Delete rubric
router.delete('/:id', auth, async (req, res) => {
  try {
    const rubric = await Rubric.findById(req.params.id);
    if (!rubric) {
      return res.status(404).json({ error: 'Rubric not found' });
    }

    // Check if user is instructor or admin
    if (rubric.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if rubric is used in any assignment
    const assignmentCount = await Assignment.countDocuments({ rubric: rubric._id });
    if (assignmentCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete rubric that is used in assignments' 
      });
    }

    await Rubric.findByIdAndDelete(rubric._id);

    res.json({ message: 'Rubric deleted successfully' });
  } catch (error) {
    console.error('Error deleting rubric:', error);
    res.status(500).json({ error: 'Failed to delete rubric' });
  }
});

// POST /api/rubrics/:id/duplicate - Duplicate rubric
router.post('/:id/duplicate', auth, async (req, res) => {
  try {
    const originalRubric = await Rubric.findById(req.params.id);
    if (!originalRubric) {
      return res.status(404).json({ error: 'Rubric not found' });
    }

    // Check access permissions
    const hasAccess = originalRubric.instructor.toString() === req.user.id || 
                     originalRubric.isTemplate || 
                     req.user.role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { title, courseId } = req.body;

    if (!title || !courseId) {
      return res.status(400).json({ error: 'Title and course ID are required' });
    }

    // Validate course access
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create duplicate
    const duplicateData = {
      title,
      description: originalRubric.description,
      course: courseId,
      instructor: req.user.id,
      totalPoints: originalRubric.totalPoints,
      criteria: originalRubric.criteria,
      gradingNotes: originalRubric.gradingNotes,
      isTemplate: false
    };

    const duplicateRubric = new Rubric(duplicateData);
    await duplicateRubric.save();

    // Increment usage count of original if it's a template
    if (originalRubric.isTemplate) {
      await Rubric.findByIdAndUpdate(originalRubric._id, {
        $inc: { usageCount: 1 }
      });
    }

    const populatedDuplicate = await Rubric.findById(duplicateRubric._id)
      .populate('instructor', 'firstName lastName email');

    res.status(201).json(populatedDuplicate);
  } catch (error) {
    console.error('Error duplicating rubric:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to duplicate rubric' });
  }
});

// POST /api/rubrics/:id/make-template - Convert rubric to template
router.post('/:id/make-template', auth, async (req, res) => {
  try {
    const rubric = await Rubric.findById(req.params.id);
    if (!rubric) {
      return res.status(404).json({ error: 'Rubric not found' });
    }

    // Check if user is instructor or admin
    if (rubric.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { templateCategory } = req.body;

    rubric.isTemplate = true;
    if (templateCategory) {
      rubric.templateCategory = templateCategory;
    }

    await rubric.save();

    res.json({ message: 'Rubric converted to template successfully' });
  } catch (error) {
    console.error('Error converting rubric to template:', error);
    res.status(500).json({ error: 'Failed to convert rubric to template' });
  }
});

// GET /api/rubrics/categories - Get template categories
router.get('/categories', auth, async (req, res) => {
  try {
    const categories = await Rubric.distinct('templateCategory', {
      isTemplate: true
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;
