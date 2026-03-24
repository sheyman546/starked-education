const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000
  },
  instructions: {
    type: String,
    required: true,
    maxlength: 10000
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
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'file', 'code', 'video', 'audio', 'mixed'],
    required: true
  },
  submissionTypes: [{
    type: String,
    enum: ['text', 'file', 'code', 'video', 'audio', 'link']
  }],
  allowedFileTypes: [{
    type: String,
    match: /^[a-z0-9]+\/[a-z0-9\-\+\.]+$/
  }],
  maxFileSize: {
    type: Number,
    default: 50 * 1024 * 1024 // 50MB default
  },
  maxFiles: {
    type: Number,
    default: 5
  },
  rubric: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rubric'
  },
  points: {
    type: Number,
    required: true,
    min: 0
  },
  weight: {
    type: Number,
    default: 1.0,
    min: 0,
    max: 10
  },
  dueDate: {
    type: Date,
    required: true
  },
  lateSubmissionAllowed: {
    type: Boolean,
    default: true
  },
  latePenalty: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  lateDeadline: {
    type: Date
  },
  autoSaveEnabled: {
    type: Boolean,
    default: true
  },
  plagiarismDetection: {
    enabled: {
      type: Boolean,
      default: true
    },
    sensitivity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    checkAgainstInternet: {
      type: Boolean,
      default: true
    },
    checkAgainstPeers: {
      type: Boolean,
      default: true
    }
  },
  groupAssignment: {
    enabled: {
      type: Boolean,
      default: false
    },
    minGroupSize: {
      type: Number,
      min: 2,
      max: 10
    },
    maxGroupSize: {
      type: Number,
      min: 2,
      max: 10
    },
    allowSelfGrouping: {
      type: Boolean,
      default: true
    }
  },
  peerReview: {
    enabled: {
      type: Boolean,
      default: false
    },
    anonymous: {
      type: Boolean,
      default: true
    },
    reviewsPerStudent: {
      type: Number,
      min: 1,
      max: 5,
      default: 2
    },
    dueDate: Date
  },
  attempts: {
    allowed: {
      type: Number,
      default: 1,
      min: 1,
      max: 10
    },
    grading: {
      type: String,
      enum: ['highest', 'latest', 'average'],
      default: 'latest'
    }
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  submissionCount: {
    type: Number,
    default: 0
  },
  gradedCount: {
    type: Number,
    default: 0
  },
  averageGrade: {
    type: Number,
    default: 0
  },
  tags: [String],
  resources: [{
    title: String,
    type: {
      type: String,
      enum: ['file', 'link', 'text']
    },
    url: String,
    description: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
assignmentSchema.index({ course: 1, module: 1 });
assignmentSchema.index({ instructor: 1 });
assignmentSchema.index({ dueDate: 1 });
assignmentSchema.index({ isPublished: 1 });
assignmentSchema.index({ type: 1 });
assignmentSchema.index({ tags: 1 });
assignmentSchema.index({ title: 'text', description: 'text', instructions: 'text' });

// Virtual for checking if assignment is overdue
assignmentSchema.virtual('isOverdue').get(function() {
  return new Date() > this.dueDate;
});

// Virtual for checking if late submission is allowed
assignmentSchema.virtual('isLateSubmissionOpen').get(function() {
  if (!this.lateSubmissionAllowed || !this.lateDeadline) return false;
  return new Date() <= this.lateDeadline;
});

// Pre-save middleware
assignmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Set late deadline if not specified
  if (this.lateSubmissionAllowed && !this.lateDeadline) {
    this.lateDeadline = new Date(this.dueDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days after due date
  }
  
  next();
});

module.exports = mongoose.model('Assignment', assignmentSchema);
