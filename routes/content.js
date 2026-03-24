const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const Course = require('../models/Course');
const Module = require('../models/Module');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = file.mimetype.startsWith('video/') ? 'media/videos/' :
                     file.mimetype.startsWith('audio/') ? 'media/audio/' :
                     file.mimetype.startsWith('image/') ? 'media/images/' :
                     'media/documents/';
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|wmv|mp3|wav|pdf|doc|docx|ppt|pptx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, video, audio, and document files are allowed'));
    }
  }
});

// Get all content for a course
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { moduleId } = req.query;
    
    let query = { course: courseId, isPublished: true };
    if (moduleId) {
      query.module = moduleId;
    }
    
    const content = await Content.find(query)
      .populate('module', 'title order')
      .sort({ 'module.order': 1, order: 1 });
    
    res.json(content);
  } catch (error) {
    console.error('Error fetching course content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Search content
router.get('/search', auth, async (req, res) => {
  try {
    const { q, type, difficulty, tags, page = 1, limit = 20 } = req.query;
    
    let query = { isPublished: true };
    
    if (q) {
      query.$text = { $search: q };
    }
    
    if (type) {
      query.type = type;
    }
    
    if (difficulty) {
      query['metadata.difficulty'] = difficulty;
    }
    
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query['metadata.tags'] = { $in: tagArray };
    }
    
    const skip = (page - 1) * limit;
    
    const content = await Content.find(query)
      .populate('course', 'title')
      .populate('module', 'title')
      .sort({ viewCount: -1, averageRating: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Content.countDocuments(query);
    
    res.json({
      content,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error searching content:', error);
    res.status(500).json({ error: 'Failed to search content' });
  }
});

// Get content recommendations based on user progress
router.get('/recommendations/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    
    // Get user's completed content and interests
    const userProgress = await Progress.find({ user: userId, completed: true })
      .populate({
        path: 'content',
        populate: [
          { path: 'course', select: 'title metadata.tags' },
          { path: 'module', select: 'title' }
        ]
      });
    
    // Extract tags and types from completed content
    const userTags = new Set();
    const userTypes = new Set();
    
    userProgress.forEach(progress => {
      if (progress.content.metadata.tags) {
        progress.content.metadata.tags.forEach(tag => userTags.add(tag));
      }
      userTypes.add(progress.content.type);
    });
    
    // Find similar content
    const recommendations = await Content.find({
      isPublished: true,
      _id: { $nin: userProgress.map(p => p.content._id) },
      $or: [
        { 'metadata.tags': { $in: Array.from(userTags) } },
        { type: { $in: Array.from(userTypes) } }
      ]
    })
    .populate('course', 'title')
    .populate('module', 'title')
    .sort({ averageRating: -1, viewCount: -1 })
    .limit(parseInt(limit));
    
    res.json(recommendations);
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Get content analytics
router.get('/:id/analytics', auth, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id)
      .populate('course', 'title instructor');
    
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Check if user has permission (instructor or admin)
    if (content.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    // Get progress analytics
    const progressStats = await Progress.aggregate([
      { $match: { content: content._id } },
      {
        $group: {
          _id: null,
          totalViews: { $sum: 1 },
          completedViews: { $sum: { $cond: ['$completed', 1, 0] } },
          averageCompletionTime: { $avg: '$timeSpent' },
          averageWatchTime: { $avg: '$watchTime' }
        }
      }
    ]);
    
    // Get daily views for the last 30 days
    const dailyViews = await Progress.aggregate([
      {
        $match: {
          content: content._id,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          views: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    res.json({
      content: {
        id: content._id,
        title: content.title,
        type: content.type,
        viewCount: content.viewCount,
        completionCount: content.completionCount,
        averageRating: content.averageRating
      },
      analytics: {
        ...progressStats[0],
        completionRate: progressStats[0] ? (progressStats[0].completedViews / progressStats[0].totalViews) * 100 : 0,
        dailyViews
      }
    });
  } catch (error) {
    console.error('Error getting content analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Get single content by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id)
      .populate('course', 'title instructor')
      .populate('module', 'title order');
    
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Increment view count
    await Content.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
    
    res.json(content);
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Create new content
router.post('/', auth, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
  { name: 'document', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'subtitle', maxCount: 5 },
  { name: 'transcript', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, description, type, course, module, order, duration, metadata, isPremium } = req.body;
    
    // Verify user has permission to create content for this course
    const courseDoc = await Course.findById(course);
    if (!courseDoc || (courseDoc.instructor.toString() !== req.user.id && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized to create content for this course' });
    }
    
    const files = [];
    
    // Process uploaded files
    if (req.files) {
      Object.keys(req.files).forEach(fieldname => {
        const fieldFiles = req.files[fieldname];
        if (Array.isArray(fieldFiles)) {
          fieldFiles.forEach(file => {
            const fileType = fieldname === 'video' ? 'video' :
                           fieldname === 'audio' ? 'audio' :
                           fieldname === 'document' ? 'document' :
                           fieldname === 'thumbnail' ? 'thumbnail' :
                           fieldname === 'subtitle' ? 'subtitle' :
                           fieldname === 'transcript' ? 'transcript' : 'unknown';
            
            files.push({
              type: fileType,
              url: `/media/${fieldname}s/${file.filename}`,
              format: path.extname(file.originalname).substring(1),
              size: file.size,
              language: fileType === 'subtitle' ? req.body.subtitleLanguage || 'en' : undefined
            });
          });
        }
      });
    }
    
    const content = new Content({
      title,
      description,
      type,
      course,
      module,
      order,
      duration: duration ? parseInt(duration) : undefined,
      files,
      metadata: metadata ? JSON.parse(metadata) : {},
      isPremium: isPremium === 'true'
    });
    
    await content.save();
    
    // Update module lesson count
    await Module.findByIdAndUpdate(module, { $inc: { lessonsCount: 1 } });
    
    res.status(201).json(content);
  } catch (error) {
    console.error('Error creating content:', error);
    res.status(500).json({ error: 'Failed to create content' });
  }
});

// Update content
router.put('/:id', auth, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
  { name: 'document', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'subtitle', maxCount: 5 },
  { name: 'transcript', maxCount: 1 }
]), async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Verify user has permission to update this content
    const course = await Course.findById(content.course);
    if (!course || (course.instructor.toString() !== req.user.id && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized to update this content' });
    }
    
    const updates = {};
    const allowedFields = ['title', 'description', 'type', 'order', 'duration', 'metadata', 'isPremium', 'isPublished'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'metadata') {
          updates[field] = JSON.parse(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    });
    
    // Process new files if uploaded
    if (req.files && Object.keys(req.files).length > 0) {
      const newFiles = [];
      Object.keys(req.files).forEach(fieldname => {
        const fieldFiles = req.files[fieldname];
        if (Array.isArray(fieldFiles)) {
          fieldFiles.forEach(file => {
            const fileType = fieldname === 'video' ? 'video' :
                           fieldname === 'audio' ? 'audio' :
                           fieldname === 'document' ? 'document' :
                           fieldname === 'thumbnail' ? 'thumbnail' :
                           fieldname === 'subtitle' ? 'subtitle' :
                           fieldname === 'transcript' ? 'transcript' : 'unknown';
            
            newFiles.push({
              type: fileType,
              url: `/media/${fieldname}s/${file.filename}`,
              format: path.extname(file.originalname).substring(1),
              size: file.size,
              language: fileType === 'subtitle' ? req.body.subtitleLanguage || 'en' : undefined
            });
          });
        }
      });
      
      updates.files = [...content.files.filter(f => !['video', 'audio', 'document', 'thumbnail'].includes(f.type)), ...newFiles];
      updates.version = content.version + 1;
    }
    
    const updatedContent = await Content.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    
    res.json(updatedContent);
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({ error: 'Failed to update content' });
  }
});

// Delete content
router.delete('/:id', auth, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Verify user has permission to delete this content
    const course = await Course.findById(content.course);
    if (!course || (course.instructor.toString() !== req.user.id && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized to delete this content' });
    }
    
    await Content.findByIdAndDelete(req.params.id);
    
    // Update module lesson count
    await Module.findByIdAndUpdate(content.module, { $inc: { lessonsCount: -1 } });
    
    res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

// Search content
router.get('/search/:query', auth, async (req, res) => {
  try {
    const { query } = req.params;
    const { type, course, limit = 20, page = 1 } = req.query;
    
    let searchQuery = {
      $text: { $search: query },
      isPublished: true
    };
    
    if (type) {
      searchQuery.type = type;
    }
    
    if (course) {
      searchQuery.course = course;
    }
    
    const skip = (page - 1) * limit;
    
    const content = await Content.find(searchQuery)
      .populate('course', 'title')
      .populate('module', 'title')
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Content.countDocuments(searchQuery);
    
    res.json({
      content,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error searching content:', error);
    res.status(500).json({ error: 'Failed to search content' });
  }
});

// Get content statistics
router.get('/stats/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const stats = await Content.aggregate([
      { $match: { course: mongoose.Types.ObjectId(courseId) } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          avgRating: { $avg: '$averageRating' },
          totalViews: { $sum: '$viewCount' },
          totalCompletions: { $sum: '$completionCount' }
        }
      }
    ]);
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching content stats:', error);
    res.status(500).json({ error: 'Failed to fetch content statistics' });
  }
});

module.exports = router;
