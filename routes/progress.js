const express = require('express');
const router = express.Router();
const Progress = require('../models/Progress');
const Content = require('../models/Content');
const Course = require('../models/Course');
const auth = require('../middleware/auth');

// Get user's progress for a course
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    const progress = await Progress.find({ 
      user: userId, 
      course: courseId 
    })
    .populate('content', 'title type duration order')
    .populate('module', 'title order')
    .sort({ 'module.order': 1, 'content.order': 1 });
    
    // Calculate overall course progress
    const totalContent = await Content.countDocuments({ 
      course: courseId, 
      isPublished: true 
    });
    
    const completedContent = await Progress.countDocuments({ 
      user: userId, 
      course: courseId, 
      status: 'completed' 
    });
    
    const overallProgress = totalContent > 0 ? (completedContent / totalContent) * 100 : 0;
    
    res.json({
      progress,
      overallProgress,
      totalContent,
      completedContent
    });
  } catch (error) {
    console.error('Error fetching course progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Get user's progress for specific content
router.get('/content/:contentId', auth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.id;
    
    const progress = await Progress.findOne({ 
      user: userId, 
      content: contentId 
    })
    .populate('content', 'title type duration')
    .populate('course', 'title');
    
    if (!progress) {
      // Create initial progress record
      const content = await Content.findById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }
      
      const newProgress = new Progress({
        user: userId,
        course: content.course,
        module: content.module,
        content: contentId,
        status: 'not_started'
      });
      
      await newProgress.save();
      return res.json(newProgress);
    }
    
    res.json(progress);
  } catch (error) {
    console.error('Error fetching content progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Update progress for content
router.put('/content/:contentId', auth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.id;
    const { progress, lastPosition, watchTime } = req.body;
    
    let progressRecord = await Progress.findOne({ 
      user: userId, 
      content: contentId 
    });
    
    if (!progressRecord) {
      const content = await Content.findById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }
      
      progressRecord = new Progress({
        user: userId,
        course: content.course,
        module: content.module,
        content: contentId,
        status: 'not_started'
      });
    }
    
    // Update progress fields
    if (progress !== undefined) {
      progressRecord.progress = Math.min(100, Math.max(0, progress));
    }
    
    if (lastPosition !== undefined) {
      progressRecord.lastPosition = lastPosition;
    }
    
    if (watchTime !== undefined) {
      progressRecord.watchTime += watchTime;
    }
    
    await progressRecord.save();
    
    // Update user's learning stats
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, {
      $inc: { 'learningStats.totalWatchTime': watchTime || 0 },
      'learningStats.lastActiveDate': new Date()
    });
    
    res.json(progressRecord);
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Mark content as completed
router.post('/content/:contentId/complete', auth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.id;
    
    const progress = await Progress.findOneAndUpdate(
      { user: userId, content: contentId },
      { 
        progress: 100, 
        status: 'completed',
        completionDate: new Date()
      },
      { new: true, upsert: true }
    );
    
    // Update content completion count
    await Content.findByIdAndUpdate(contentId, { $inc: { completionCount: 1 } });
    
    // Update user's learning stats
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, {
      $inc: { 'learningStats.lessonsCompleted': 1 }
    });
    
    // Check if course is completed
    const course = await Course.findById(progress.course);
    const totalContent = await Content.countDocuments({ 
      course: progress.course, 
      isPublished: true 
    });
    
    const completedContent = await Progress.countDocuments({ 
      user: userId, 
      course: progress.course, 
      status: 'completed' 
    });
    
    const courseProgress = (completedContent / totalContent) * 100;
    
    if (courseProgress === 100) {
      // Mark course as completed
      await User.findByIdAndUpdate(userId, {
        $push: { 
          completedCourses: {
            course: progress.course,
            completedAt: new Date()
          }
        },
        $inc: { 'learningStats.coursesCompleted': 1 }
      });
    }
    
    res.json({ 
      progress,
      courseProgress,
      courseCompleted: courseProgress === 100
    });
  } catch (error) {
    console.error('Error marking content as completed:', error);
    res.status(500).json({ error: 'Failed to mark content as completed' });
  }
});

// Add note to content
router.post('/content/:contentId/notes', auth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.id;
    const { timestamp, text } = req.body;
    
    const progress = await Progress.findOneAndUpdate(
      { user: userId, content: contentId },
      { 
        $push: { 
          notes: { timestamp, text }
        }
      },
      { new: true, upsert: true }
    );
    
    res.json(progress);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Add bookmark to content
router.post('/content/:contentId/bookmarks', auth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.id;
    const { timestamp, title, note } = req.body;
    
    const progress = await Progress.findOneAndUpdate(
      { user: userId, content: contentId },
      { 
        $push: { 
          bookmarks: { timestamp, title, note }
        }
      },
      { new: true, upsert: true }
    );
    
    // Also add to user's global bookmarks
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, {
      $push: { 
        bookmarks: { 
          content: contentId, 
          timestamp 
        }
      }
    });
    
    res.json(progress);
  } catch (error) {
    console.error('Error adding bookmark:', error);
    res.status(500).json({ error: 'Failed to add bookmark' });
  }
});

// Get all user bookmarks
router.get('/bookmarks', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const bookmarks = await Progress.find({ 
      user: userId,
      'bookmarks.0': { $exists: true }
    })
    .populate('content', 'title type thumbnail')
    .populate('course', 'title')
    .select('bookmarks content course');
    
    const allBookmarks = [];
    bookmarks.forEach(progress => {
      progress.bookmarks.forEach(bookmark => {
        allBookmarks.push({
          ...bookmark.toObject(),
          content: progress.content,
          course: progress.course
        });
      });
    });
    
    // Sort by creation date (newest first)
    allBookmarks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(allBookmarks);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

// Get user's learning statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const stats = await Progress.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalWatchTime: { $sum: '$watchTime' },
          avgProgress: { $avg: '$progress' }
        }
      }
    ]);
    
    const User = require('../models/User');
    const user = await User.findById(userId, 'learningStats');
    
    // Get recent activity
    const recentActivity = await Progress.find({ user: userId })
      .populate('content', 'title type')
      .populate('course', 'title')
      .sort({ updatedAt: -1 })
      .limit(10);
    
    // Get learning streak
    const streak = await calculateLearningStreak(userId);
    
    res.json({
      stats,
      learningStats: user.learningStats,
      recentActivity,
      streak
    });
  } catch (error) {
    console.error('Error fetching learning stats:', error);
    res.status(500).json({ error: 'Failed to fetch learning stats' });
  }
});

// Helper function to calculate learning streak
async function calculateLearningStreak(userId) {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const activity = await Progress.find({
      user: userId,
      updatedAt: { $gte: thirtyDaysAgo }
    }).select('updatedAt');
    
    if (activity.length === 0) return 0;
    
    // Group activity by day
    const activityDays = new Set();
    activity.forEach(item => {
      const date = new Date(item.updatedAt).toDateString();
      activityDays.add(date);
    });
    
    let streak = 0;
    let currentDate = new Date(today);
    
    while (activityDays.has(currentDate.toDateString())) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return streak;
  } catch (error) {
    console.error('Error calculating learning streak:', error);
    return 0;
  }
}

module.exports = router;
