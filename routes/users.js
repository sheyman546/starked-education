const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Course = require('../models/Course');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Register user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role = 'student' } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create new user
    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      role
    });
    
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
        preferences: user.preferences,
        learningStats: user.learningStats
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('enrolledCourses.course', 'title thumbnail instructor')
      .populate('completedCourses.course', 'title thumbnail');
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, bio, avatar, preferences } = req.body;
    
    const updates = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (bio !== undefined) updates.bio = bio;
    if (avatar !== undefined) updates.avatar = avatar;
    if (preferences !== undefined) updates.preferences = preferences;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Enroll in course
router.post('/enroll/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Check if already enrolled
    const user = await User.findById(userId);
    const alreadyEnrolled = user.enrolledCourses.some(
      enrollment => enrollment.course.toString() === courseId
    );
    
    if (alreadyEnrolled) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }
    
    // Add course to enrolled courses
    await User.findByIdAndUpdate(userId, {
      $push: { 
        enrolledCourses: { 
          course: courseId,
          enrolledAt: new Date()
        }
      }
    });
    
    // Update course enrollment count
    await Course.findByIdAndUpdate(courseId, { $inc: { enrolledStudents: 1 } });
    
    res.json({ message: 'Successfully enrolled in course' });
  } catch (error) {
    console.error('Error enrolling in course:', error);
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
});

// Get enrolled courses
router.get('/enrolled', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'enrolledCourses.course',
        select: 'title thumbnail instructor price rating enrolledStudents'
      })
      .populate('enrolledCourses.course.instructor', 'firstName lastName avatar');
    
    res.json(user.enrolledCourses);
  } catch (error) {
    console.error('Error fetching enrolled courses:', error);
    res.status(500).json({ error: 'Failed to fetch enrolled courses' });
  }
});

// Get completed courses
router.get('/completed', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'completedCourses.course',
        select: 'title thumbnail instructor'
      })
      .populate('completedCourses.course.instructor', 'firstName lastName avatar');
    
    res.json(user.completedCourses);
  } catch (error) {
    console.error('Error fetching completed courses:', error);
    res.status(500).json({ error: 'Failed to fetch completed courses' });
  }
});

// Update course progress
router.put('/progress/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { progress } = req.body;
    
    await User.updateOne(
      { 
        _id: req.user.id,
        'enrolledCourses.course': courseId
      },
      { 
        $set: { 
          'enrolledCourses.$.progress': progress,
          'enrolledCourses.$.lastAccessed': new Date()
        }
      }
    );
    
    res.json({ message: 'Progress updated successfully' });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Get user's learning dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId)
      .populate({
        path: 'enrolledCourses.course',
        select: 'title thumbnail instructor'
      })
      .populate('enrolledCourses.course.instructor', 'firstName lastName avatar');
    
    // Get recent progress
    const Progress = require('../models/Progress');
    const recentProgress = await Progress.find({ user: userId })
      .populate('content', 'title type thumbnail')
      .populate('course', 'title')
      .sort({ updatedAt: -1 })
      .limit(5);
    
    // Get learning streak
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const activityDays = await Progress.distinct('updatedAt', {
      user: userId,
      updatedAt: { $gte: thirtyDaysAgo }
    });
    
    const uniqueDays = new Set(activityDays.map(date => new Date(date).toDateString()));
    let streak = 0;
    let currentDate = new Date(today);
    
    while (uniqueDays.has(currentDate.toDateString())) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    res.json({
      user: {
        learningStats: user.learningStats,
        enrolledCourses: user.enrolledCourses.slice(0, 3) // Recent 3 courses
      },
      recentProgress,
      streak
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Search users (admin only)
router.get('/search', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { query, role, limit = 20, page = 1 } = req.query;
    
    let searchQuery = {};
    
    if (query) {
      searchQuery.$or = [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (role) {
      searchQuery.role = role;
    }
    
    const skip = (page - 1) * limit;
    
    const users = await User.find(searchQuery)
      .select('username email firstName lastName role avatar learningStats createdAt')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments(searchQuery);
    
    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;
