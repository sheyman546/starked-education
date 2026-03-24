const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  members: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['leader', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  maxMembers: {
    type: Number,
    required: true,
    min: 2,
    max: 10
  },
  status: {
    type: String,
    enum: ['forming', 'active', 'submitted', 'completed'],
    default: 'forming'
  },
  submission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission'
  },
  peerReviews: [{
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    completed: {
      type: Boolean,
      default: false
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String,
    submittedAt: Date
  }],
  invitations: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled'],
      default: 'pending'
    },
    message: String,
    sentAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: Date
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
groupSchema.index({ course: 1, assignment: 1 });
groupSchema.index({ members: 1 });
groupSchema.index({ leader: 1 });
groupSchema.index({ status: 1 });

// Virtual for checking if group is full
groupSchema.virtual('isFull').get(function() {
  return this.members.length >= this.maxMembers;
});

// Virtual for available spots
groupSchema.virtual('availableSpots').get(function() {
  return this.maxMembers - this.members.length;
});

// Pre-save middleware
groupSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Update status based on member count
  if (this.members.length >= 2 && this.status === 'forming') {
    this.status = 'active';
  }
  
  next();
});

// Method to add member
groupSchema.methods.addMember = function(student, role = 'member', invitedBy) {
  if (this.isFull) {
    throw new Error('Group is already full');
  }
  
  // Check if student is already a member
  if (this.members.some(member => member.student.toString() === student.toString())) {
    throw new Error('Student is already a member of this group');
  }
  
  this.members.push({
    student,
    role,
    joinedAt: new Date(),
    invitedBy
  });
  
  return this;
};

// Method to remove member
groupSchema.methods.removeMember = function(student) {
  const memberIndex = this.members.findIndex(member => member.student.toString() === student.toString());
  if (memberIndex === -1) {
    throw new Error('Student is not a member of this group');
  }
  
  this.members.splice(memberIndex, 1);
  
  // If removing leader, assign new leader or disband group
  if (this.leader.toString() === student.toString()) {
    if (this.members.length > 0) {
      this.leader = this.members[0].student;
      this.members[0].role = 'leader';
    } else {
      this.status = 'forming';
    }
  }
  
  return this;
};

// Method to invite member
groupSchema.methods.inviteMember = function(sender, recipient, message) {
  // Check if recipient is already a member
  if (this.members.some(member => member.student.toString() === recipient.toString())) {
    throw new Error('Student is already a member of this group');
  }
  
  // Check if there's already a pending invitation
  const existingInvitation = this.invitations.find(inv => 
    inv.recipient.toString() === recipient.toString() && inv.status === 'pending'
  );
  
  if (existingInvitation) {
    throw new Error('Student already has a pending invitation to this group');
  }
  
  this.invitations.push({
    sender,
    recipient,
    message,
    status: 'pending',
    sentAt: new Date()
  });
  
  return this;
};

module.exports = mongoose.model('Group', groupSchema);
