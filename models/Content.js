const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['video', 'audio', 'text', 'interactive', 'quiz', 'document', 'code'],
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true
  },
  order: {
    type: Number,
    required: true
  },
  duration: {
    type: Number, // in seconds
    required: function() {
      return ['video', 'audio'].includes(this.type);
    }
  },
  files: [{
    type: {
      type: String,
      enum: ['video', 'audio', 'document', 'thumbnail', 'subtitle', 'transcript'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    format: String,
    size: Number,
    quality: String, // for video: '720p', '1080p', etc.
    language: String // for subtitles
  }],
  metadata: {
    resolution: String, // for video
    bitrate: Number, // for video/audio
    codec: String,
    frameRate: Number,
    pages: Number, // for documents
    wordCount: Number, // for text content
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced']
    },
    tags: [String],
    prerequisites: [String]
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  version: {
    type: Number,
    default: 1
  },
  viewCount: {
    type: Number,
    default: 0
  },
  completionCount: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
contentSchema.index({ course: 1, module: 1, order: 1 });
contentSchema.index({ type: 1 });
contentSchema.index({ isPublished: 1 });
contentSchema.index({ tags: 1 });
contentSchema.index({ title: 'text', description: 'text' });

// Update the updatedAt field before saving
contentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Content', contentSchema);
