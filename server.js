const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const contentRoutes = require('./routes/content');
const mediaRoutes = require('./routes/media');
const progressRoutes = require('./routes/progress');
const userRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const assignmentRoutes = require('./routes/assignments');
const submissionRoutes = require('./routes/submissions');
const gradingRoutes = require('./routes/grading');
const rubricRoutes = require('./routes/rubrics');
const bookmarkRoutes = require('./routes/bookmarks');
const offlineRoutes = require('./routes/offline');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for media content
app.use('/media', express.static(path.join(__dirname, 'media')));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/starked-education', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// API Routes
app.use('/api/content', contentRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/grading', gradingRoutes);
app.use('/api/rubrics', rubricRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/offline', offlineRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
