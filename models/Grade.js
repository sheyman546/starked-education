const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  submission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
    unique: true
  },
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
  grader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'returned', 'appealed'],
    default: 'pending'
  },
  scores: {
    total: {
      type: Number,
      required: true,
      min: 0
    },
    earned: {
      type: Number,
      required: true,
      min: 0
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    weighted: {
      type: Number,
      min: 0
    }
  },
  rubricResults: [{
    criterion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rubric.criteria',
      required: true
    },
    level: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    score: {
      type: Number,
      required: true,
      min: 0
    },
    maxScore: {
      type: Number,
      required: true,
      min: 0
    },
    feedback: {
      type: String,
      maxlength: 1000
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  }],
  feedback: {
    overall: {
      type: String,
      maxlength: 2000
    },
    strengths: [String],
    improvements: [String],
    nextSteps: [String],
    audio: {
      url: String,
      duration: Number,
      transcript: String
    },
    attachments: [{
      filename: String,
      url: String,
      type: {
        type: String,
        enum: ['image', 'document', 'video', 'audio']
      }
    }]
  },
  grading: {
    startedAt: Date,
    completedAt: Date,
    timeSpent: Number, // in minutes
    autoGraded: {
      type: Boolean,
      default: false
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  penalties: [{
    type: {
      type: String,
      enum: ['late', 'plagiarism', 'format', 'other']
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }],
  bonuses: [{
    type: {
      type: String,
      enum: ['early', 'extra_credit', 'participation', 'other']
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }],
  moderation: {
    requested: {
      type: Boolean,
      default: false
    },
    requestedAt: Date,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    moderator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    moderatedAt: Date,
    originalScore: Number,
    moderatedScore: Number,
    moderatorComments: String
  },
  release: {
    scheduled: {
      type: Boolean,
      default: false
    },
    releaseDate: Date,
    released: {
      type: Boolean,
      default: false
    },
    releasedAt: Date
  },
  notifications: {
    studentNotified: {
      type: Boolean,
      default: false
    },
    notifiedAt: Date
  },
  statistics: {
    classAverage: Number,
    classRank: Number,
    percentile: Number,
    distribution: {
      a: Number,
      b: Number,
      c: Number,
      d: Number,
      f: Number
    }
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
gradeSchema.index({ submission: 1 }, { unique: true });
gradeSchema.index({ assignment: 1, student: 1 });
gradeSchema.index({ grader: 1 });
gradeSchema.index({ status: 1 });
gradeSchema.index({ 'scores.percentage': 1 });
gradeSchema.index({ 'grading.completedAt': 1 });

// Virtual for letter grade
gradeSchema.virtual('letterGrade').get(function() {
  const percentage = this.scores.percentage;
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
});

// Virtual for GPA points
gradeSchema.virtual('gpaPoints').get(function() {
  const percentage = this.scores.percentage;
  if (percentage >= 97) return 4.0;
  if (percentage >= 93) return 3.7;
  if (percentage >= 90) return 3.3;
  if (percentage >= 87) return 3.0;
  if (percentage >= 83) return 2.7;
  if (percentage >= 80) return 2.3;
  if (percentage >= 77) return 2.0;
  if (percentage >= 73) return 1.7;
  if (percentage >= 70) return 1.3;
  if (percentage >= 67) return 1.0;
  if (percentage >= 60) return 0.7;
  return 0.0;
});

// Pre-save middleware
gradeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate percentage if not set
  if (this.scores.total > 0 && this.scores.earned >= 0) {
    this.scores.percentage = (this.scores.earned / this.scores.total) * 100;
  }
  
  // Calculate weighted score
  if (this.assignment && this.assignment.weight) {
    this.scores.weighted = this.scores.earned * this.assignment.weight;
  }
  
  // Calculate grading time
  if (this.grading.startedAt && this.grading.completedAt) {
    this.grading.timeSpent = Math.round((this.grading.completedAt - this.grading.startedAt) / (1000 * 60));
  }
  
  next();
});

// Method to apply penalty
gradeSchema.methods.applyPenalty = function(type, amount, reason) {
  this.penalties.push({
    type,
    amount,
    reason,
    appliedAt: new Date()
  });
  
  // Recalculate earned score
  const totalPenalties = this.penalties.reduce((sum, penalty) => sum + penalty.amount, 0);
  const totalBonuses = this.bonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
  
  const rubricScore = this.rubricResults.reduce((sum, result) => sum + result.score, 0);
  this.scores.earned = Math.max(0, rubricScore - totalPenalties + totalBonuses);
  
  return this;
};

// Method to apply bonus
gradeSchema.methods.applyBonus = function(type, amount, reason) {
  this.bonuses.push({
    type,
    amount,
    reason,
    appliedAt: new Date()
  });
  
  // Recalculate earned score
  const totalPenalties = this.penalties.reduce((sum, penalty) => sum + penalty.amount, 0);
  const totalBonuses = this.bonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
  
  const rubricScore = this.rubricResults.reduce((sum, result) => sum + result.score, 0);
  this.scores.earned = Math.max(0, rubricScore - totalPenalties + totalBonuses);
  
  return this;
};

module.exports = mongoose.model('Grade', gradeSchema);
