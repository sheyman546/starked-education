const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const Course = require('../models/Course');
const Progress = require('../models/Progress');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get content analytics (instructor/admin only)
router.get('/content/:contentId', auth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.id;
    
    const content = await Content.findById(contentId).populate('course', 'instructor');
    
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Check permissions
    if (content.course.instructor.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get progress data for this content
    const progressStats = await Progress.aggregate([
      { $match: { content: mongoose.Types.ObjectId(contentId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgProgress: { $avg: '$progress' },
          avgWatchTime: { $avg: '$watchTime' }
        }
      }
    ]);
    
    // Get completion rate
    const totalStarted = await Progress.countDocuments({ content: contentId });
    const totalCompleted = await Progress.countDocuments({ 
      content: contentId, 
      status: 'completed' 
    });
    const completionRate = totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0;
    
    // Get engagement metrics
    const notesCount = await Progress.aggregate([
      { $match: { content: contentId } },
      { $project: { notesCount: { $size: '$notes' } } },
      { $group: { _id: null, totalNotes: { $sum: '$notesCount' } } }
    ]);
    
    const bookmarksCount = await Progress.aggregate([
      { $match: { content: contentId } },
      { $project: { bookmarksCount: { $size: '$bookmarks' } } },
      { $group: { _id: null, totalBookmarks: { $sum: '$bookmarksCount' } } }
    ]);
    
    // Get watch time distribution
    const watchTimeDistribution = await Progress.aggregate([
      { $match: { content: contentId, watchTime: { $gt: 0 } } },
      {
        $bucket: {
          groupBy: '$watchTime',
          boundaries: [0, 60, 300, 600, 1800, 3600, Infinity],
          default: 'other',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);
    
    res.json({
      content: {
        id: content._id,
        title: content.title,
        type: content.type,
        duration: content.duration,
        viewCount: content.viewCount,
        completionCount: content.completionCount
      },
      stats: {
        totalStarted,
        totalCompleted,
        completionRate,
        progressStats,
        engagement: {
          totalNotes: notesCount[0]?.totalNotes || 0,
          totalBookmarks: bookmarksCount[0]?.totalBookmarks || 0
        },
        watchTimeDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching content analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get course analytics (instructor/admin only)
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Check permissions
    if (course.instructor.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get enrollment over time
    const enrollmentOverTime = await User.aggregate([
      { $unwind: '$enrolledCourses' },
      { $match: { 'enrolledCourses.course': mongoose.Types.ObjectId(courseId) } },
      {
        $group: {
          _id: {
            year: { $year: '$enrolledCourses.enrolledAt' },
            month: { $month: '$enrolledCourses.enrolledAt' },
            day: { $dayOfMonth: '$enrolledCourses.enrolledAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    // Get completion statistics
    const completionStats = await Progress.aggregate([
      { $match: { course: mongoose.Types.ObjectId(courseId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgProgress: { $avg: '$progress' }
        }
      }
    ]);
    
    // Get content performance
    const contentPerformance = await Content.aggregate([
      { $match: { course: mongoose.Types.ObjectId(courseId) } },
      {
        $lookup: {
          from: 'progresses',
          localField: '_id',
          foreignField: 'content',
          as: 'progressData'
        }
      },
      {
        $project: {
          title: 1,
          type: 1,
          duration: 1,
          viewCount: 1,
          completionCount: 1,
          averageRating: 1,
          ratingCount: 1,
          totalStarted: { $size: '$progressData' },
          totalCompleted: {
            $size: {
              $filter: {
                input: '$progressData',
                cond: { $eq: ['$$this.status', 'completed'] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          completionRate: {
            $cond: {
              if: { $eq: ['$totalStarted', 0] },
              then: 0,
              else: { $multiply: [{ $divide: ['$totalCompleted', '$totalStarted'] }, 100] }
            }
          }
        }
      },
      { $sort: { completionRate: -1 } }
    ]);
    
    // Get learning stats
    const learningStats = await Progress.aggregate([
      { $match: { course: mongoose.Types.ObjectId(courseId) } },
      {
        $group: {
          _id: null,
          totalWatchTime: { $sum: '$watchTime' },
          avgWatchTime: { $avg: '$watchTime' },
          totalNotes: { $sum: { $size: '$notes' } },
          totalBookmarks: { $sum: { $size: '$bookmarks' } }
        }
      }
    ]);
    
    // Get student demographics
    const studentDemographics = await User.aggregate([
      { $unwind: '$enrolledCourses' },
      { $match: { 'enrolledCourses.course': mongoose.Types.ObjectId(courseId) } },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          avgProgress: { $avg: '$enrolledCourses.progress' }
        }
      }
    ]);
    
    res.json({
      course: {
        id: course._id,
        title: course.title,
        enrolledStudents: course.enrolledStudents,
        rating: course.rating
      },
      analytics: {
        enrollmentOverTime,
        completionStats,
        contentPerformance,
        learningStats: learningStats[0] || {},
        studentDemographics: studentDemographics[0] || {}
      }
    });
  } catch (error) {
    console.error('Error fetching course analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get platform analytics (admin only)
router.get('/platform', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // User statistics
    const userStats = await User.aggregate([
      {
        $facet: {
          totalUsers: [{ $count: 'count' }],
          newUsers: [
            { $match: { createdAt: { $gte: startDate } } },
            { $count: 'count' }
          ],
          activeUsers: [
            { $match: { 'learningStats.lastActiveDate': { $gte: startDate } } },
            { $count: 'count' }
          ],
          usersByRole: [
            { $group: { _id: '$role', count: { $sum: 1 } } }
          ]
        }
      }
    ]);
    
    // Course statistics
    const courseStats = await Course.aggregate([
      {
        $facet: {
          totalCourses: [{ $count: 'count' }],
          publishedCourses: [
            { $match: { isPublished: true } },
            { $count: 'count' }
          ],
          coursesByCategory: [
            { $match: { isPublished: true } },
            { $group: { _id: '$category', count: { $sum: 1 } } }
          ],
          coursesByLevel: [
            { $match: { isPublished: true } },
            { $group: { _id: '$level', count: { $sum: 1 } } }
          ]
        }
      }
    ]);
    
    // Content statistics
    const contentStats = await Content.aggregate([
      {
        $facet: {
          totalContent: [{ $count: 'count' }],
          contentByType: [
            { $group: { _id: '$type', count: { $sum: 1 } } }
          ],
          avgRating: [{ $group: { _id: null, avgRating: { $avg: '$averageRating' } } }],
          totalViews: [{ $group: { _id: null, totalViews: { $sum: '$viewCount' } } }],
          totalCompletions: [{ $group: { _id: null, totalCompletions: { $sum: '$completionCount' } } }]
        }
      }
    ]);
    
    // Learning statistics
    const learningStats = await Progress.aggregate([
      {
        $facet: {
          totalProgress: [{ $count: 'count' }],
          completionRate: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          totalWatchTime: [{ $group: { _id: null, totalWatchTime: { $sum: '$watchTime' } } }],
          avgProgress: [{ $group: { _id: null, avgProgress: { $avg: '$progress' } } }]
        }
      }
    ]);
    
    // Growth metrics
    const growthMetrics = await Promise.all([
      // Daily new users
      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ]),
      
      // Daily course enrollments
      User.aggregate([
        { $unwind: '$enrolledCourses' },
        { $match: { 'enrolledCourses.enrolledAt': { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$enrolledCourses.enrolledAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ]),
      
      // Daily content completions
      Progress.aggregate([
        { $match: { completionDate: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$completionDate' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ])
    ]);
    
    res.json({
      period,
      userStats: userStats[0],
      courseStats: courseStats[0],
      contentStats: contentStats[0],
      learningStats: learningStats[0],
      growthMetrics: {
        newUsers: growthMetrics[0],
        enrollments: growthMetrics[1],
        completions: growthMetrics[2]
      }
    });
  } catch (error) {
    console.error('Error fetching platform analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get learning analytics for user
router.get('/learning', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // Learning activity over time
    const activityOverTime = await Progress.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId), updatedAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
          studyTime: { $sum: '$watchTime' },
          lessonsCompleted: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          notesAdded: { $sum: { $size: '$notes' } },
          bookmarksAdded: { $sum: { $size: '$bookmarks' } }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    // Progress by course
    const progressByCourse = await Progress.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'courses',
          localField: 'course',
          foreignField: '_id',
          as: 'courseInfo'
        }
      },
      { $unwind: '$courseInfo' },
      {
        $group: {
          _id: '$course',
          courseTitle: { $first: '$courseInfo.title' },
          totalLessons: { $sum: 1 },
          completedLessons: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalWatchTime: { $sum: '$watchTime' },
          avgProgress: { $avg: '$progress' },
          completionRate: {
            $avg: { $cond: [{ $eq: ['$status', 'completed'] }, 100, '$progress'] }
          }
        }
      },
      { $sort: { completionRate: -1 } }
    ]);
    
    // Learning patterns
    const learningPatterns = await Progress.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId), watchTime: { $gt: 0 } } },
      {
        $project: {
          hourOfDay: { $hour: '$updatedAt' },
          dayOfWeek: { $dayOfWeek: '$updatedAt' },
          watchTime: 1
        }
      },
      {
        $facet: {
          byHour: [
            { $group: { _id: '$hourOfDay', totalWatchTime: { $sum: '$watchTime' } } },
            { $sort: { '_id': 1 } }
          ],
          byDayOfWeek: [
            { $group: { _id: '$dayOfWeek', totalWatchTime: { $sum: '$watchTime' } } },
            { $sort: { '_id': 1 } }
          ]
        }
      }
    ]);
    
    // Content type preferences
    const contentTypePreferences = await Progress.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'contents',
          localField: 'content',
          foreignField: '_id',
          as: 'contentInfo'
        }
      },
      { $unwind: '$contentInfo' },
      {
        $group: {
          _id: '$contentInfo.type',
          count: { $sum: 1 },
          totalWatchTime: { $sum: '$watchTime' },
          avgProgress: { $avg: '$progress' },
          completionRate: {
            $avg: { $cond: [{ $eq: ['$status', 'completed'] }, 100, '$progress'] }
          }
        }
      },
      { $sort: { totalWatchTime: -1 } }
    ]);
    
    // User's current streak
    const user = await User.findById(userId, 'learningStats');
    
    res.json({
      period,
      userStats: user.learningStats,
      activityOverTime,
      progressByCourse,
      learningPatterns: learningPatterns[0],
      contentTypePreferences
    });
  } catch (error) {
    console.error('Error fetching learning analytics:', error);
    res.status(500).json({ error: 'Failed to fetch learning analytics' });
  }
});

module.exports = router;
