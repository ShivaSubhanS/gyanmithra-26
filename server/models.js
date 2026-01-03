import mongoose from 'mongoose';

// Question Schema
const questionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  testCases: [{
    input: {
      type: String,
      required: true
    },
    expectedOutput: {
      type: String,
      required: true
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Team Schema
const teamSchema = new mongoose.Schema({
  teamName: {
    type: String,
    required: true,
    unique: true
  },
  members: [{
    gmid: {
      type: String,
      required: true
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null
    },
    code: {
      type: String,
      default: ''
    },
    completed: {
      type: Boolean,
      default: false
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],
  currentRound: {
    type: Number,
    default: 1
  },
  roundStartTime: {
    type: Date,
    default: null
  },
  eventStartTime: {
    type: Date,
    default: null
  },
  shuffleTime: {
    type: Number,
    default: 60
  },
  eventDuration: {
    type: Number,
    default: 300
  },
  isActive: {
    type: Boolean,
    default: false
  },
  eventExpired: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Submission Schema (for tracking completed submissions)
const submissionSchema = new mongoose.Schema({
  teamName: {
    type: String,
    required: true
  },
  gmid: {
    type: String,
    required: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  code: {
    type: String,
    required: true
  },
  languageId: {
    type: Number,
    default: 71
  },
  passed: {
    type: Boolean,
    default: false
  },
  totalTestCases: {
    type: Number,
    default: 0
  },
  passedTestCases: {
    type: Number,
    default: 0
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

// Settings Schema (global event settings)
const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global'
  },
  shuffleTime: {
    type: Number,
    default: 60
  },
  eventDuration: {
    type: Number,
    default: 300
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export const Question = mongoose.model('Question', questionSchema);
export const Team = mongoose.model('Team', teamSchema);
export const Submission = mongoose.model('Submission', submissionSchema);
export const Settings = mongoose.model('Settings', settingsSchema);
