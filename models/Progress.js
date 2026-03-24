const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  content: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started'
  },
  progress: {
    type: Number, // percentage 0-100
    min: 0,
    max: 100,
    default: 0
  },
  watchTime: {
    type: Number, // seconds watched
    default: 0
  },
  lastPosition: {
    type: Number, // last position in seconds for video/audio
    default: 0
  },
  completionDate: {
    type: Date
  },
  notes: [{
    timestamp: {
      type: Number, // timestamp in seconds for video/audio
      default: 0
    },
    text: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  bookmarks: [{
    timestamp: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    note: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  quizScores: [{
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content'
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    attempts: {
      type: Number,
      default: 0
    },
    completedAt: {
      type: Date,
      default: Date.now
    }
  }],
  startedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
progressSchema.index({ user: 1, course: 1 });
progressSchema.index({ user: 1, status: 1 });
progressSchema.index({ content: 1 });
progressSchema.index({ updatedAt: -1 });

progressSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.progress === 100 && this.status !== 'completed') {
    this.status = 'completed';
    this.completionDate = Date.now();
  } else if (this.progress > 0 && this.status === 'not_started') {
    this.status = 'in_progress';
  }
  next();
});

module.exports = mongoose.model('Progress', progressSchema);
