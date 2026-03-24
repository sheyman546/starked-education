const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  attempt: {
    type: Number,
    required: true,
    default: 1
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'graded', 'returned', 'late', 'flagged'],
    default: 'draft'
  },
  content: {
    text: {
      type: String,
      maxlength: 50000
    },
    files: [{
      filename: String,
      originalName: String,
      mimeType: String,
      size: Number,
      url: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    code: [{
      language: String,
      code: String,
      filename: String
    }],
    links: [{
      title: String,
      url: String,
      description: String
    }],
    video: [{
      title: String,
      url: String,
      duration: Number,
      thumbnail: String
    }],
    audio: [{
      title: String,
      url: String,
      duration: Number,
      transcript: String
    }]
  },
  submissionDate: {
    type: Date
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  isLate: {
    type: Boolean,
    default: false
  },
  latePenaltyApplied: {
    type: Number,
    default: 0
  },
  plagiarism: {
    checked: {
      type: Boolean,
      default: false
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    report: {
      sources: [{
        url: String,
        similarity: Number,
        words: Number
      }],
      flaggedSections: [{
        text: String,
        similarity: Number,
        source: String
      }]
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'error'],
      default: 'pending'
    }
  },
  grade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grade'
  },
  feedback: {
    instructorComments: {
      type: String,
      maxlength: 2000
    },
    audioFeedback: {
      url: String,
      duration: Number
    },
    annotations: [{
      type: {
        type: String,
        enum: ['highlight', 'comment', 'correction']
      },
      position: {
        start: Number,
        end: Number,
        page: Number
      },
      content: String,
      author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    rubricScores: [{
      criterionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      levelId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      score: Number,
      feedback: String
    }]
  },
  peerReviews: [{
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    anonymous: {
      type: Boolean,
      default: true
    },
    completed: {
      type: Boolean,
      default: false
    },
  submittedAt: Date,
    comments: String,
    rubricScores: [{
      criterionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      levelId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      score: Number,
      feedback: String
    }],
    overallRating: {
      type: Number,
      min: 1,
      max: 5
    }
  }],
  autoSaveData: {
    content: mongoose.Schema.Types.Mixed,
    lastSaved: {
      type: Date,
      default: Date.now
    }
  },
  version: {
    type: Number,
    default: 1
  },
  submissionIP: String,
  submissionMetadata: {
    browser: String,
    os: String,
    device: String,
    location: String
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

// Indexes
submissionSchema.index({ assignment: 1, student: 1 });
submissionSchema.index({ student: 1 });
submissionSchema.index({ assignment: 1, status: 1 });
submissionSchema.index({ submissionDate: 1 });
submissionSchema.index({ 'plagiarism.status': 1 });
submissionSchema.index({ 'plagiarism.score': 1 });

// Virtual for checking if submission is late
submissionSchema.virtual('isLateSubmission').get(function() {
  if (!this.submissionDate || !this.assignment.dueDate) return false;
  return this.submissionDate > this.assignment.dueDate;
});

// Pre-save middleware
submissionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Check if submission is late when submitted
  if (this.status === 'submitted' && this.submissionDate && this.assignment.dueDate) {
    this.isLate = this.submissionDate > this.assignment.dueDate;
    if (this.isLate && this.assignment.latePenalty > 0) {
      this.latePenaltyApplied = this.assignment.latePenalty;
    }
  }
  
  next();
});

// Method to calculate total file size
submissionSchema.methods.getTotalFileSize = function() {
  return this.content.files.reduce((total, file) => total + file.size, 0);
};

// Method to check if submission exceeds file limits
submissionSchema.methods.exceedsFileLimits = function() {
  const totalSize = this.getTotalFileSize();
  const fileCount = this.content.files.length;
  
  return {
    exceedsSize: totalSize > (this.assignment.maxFileSize || 50 * 1024 * 1024),
    exceedsCount: fileCount > (this.assignment.maxFiles || 5),
    totalSize,
    fileCount
  };
};

module.exports = mongoose.model('Submission', submissionSchema);
