const mongoose = require('mongoose');

const rubricSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  totalPoints: {
    type: Number,
    required: true,
    min: 1
  },
  criteria: [{
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      maxlength: 1000
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    levels: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      description: {
        type: String,
        required: true,
        maxlength: 1000
      },
      points: {
        type: Number,
        required: true,
        min: 0
      }
    }],
    isRequired: {
      type: Boolean,
      default: true
    }
  }],
  gradingNotes: {
    allowComments: {
      type: Boolean,
      default: true
    },
    requireComments: {
      type: Boolean,
      default: false
    },
    maxCommentLength: {
      type: Number,
      default: 500
    }
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  templateCategory: {
    type: String,
    enum: ['essay', 'presentation', 'code', 'project', 'quiz', 'general']
  },
  usageCount: {
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

// Indexes
rubricSchema.index({ course: 1 });
rubricSchema.index({ instructor: 1 });
rubricSchema.index({ isTemplate: 1 });
rubricSchema.index({ templateCategory: 1 });

// Virtual to validate that criteria weights sum to 100
rubricSchema.virtual('isValidWeight').get(function() {
  const totalWeight = this.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  return Math.abs(totalWeight - 100) < 0.01; // Allow for floating point precision
});

// Pre-save middleware to validate weights
rubricSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  const totalWeight = this.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    return next(new Error('Criteria weights must sum to 100%'));
  }
  
  // Validate that total points matches sum of max points from criteria
  const maxPoints = this.criteria.reduce((sum, criterion) => {
    const criterionMax = Math.max(...criterion.levels.map(level => level.points));
    return sum + criterionMax;
  }, 0);
  
  if (Math.abs(this.totalPoints - maxPoints) > 0.01) {
    return next(new Error('Total points must match sum of maximum points from all criteria'));
  }
  
  next();
});

module.exports = mongoose.model('Rubric', rubricSchema);
