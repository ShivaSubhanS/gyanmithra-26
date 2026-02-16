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
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
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
    unique: true,
    index: true  // Index for faster lookups
  },
  members: [{
    gmid: {
      type: String,
      required: true
    },
    // Index pointing to assignedQuestions array (0, 1, or 2)
    currentQuestionIndex: {
      type: Number,
      default: null
    },
    // Currently selected language for this member
    languageId: {
      type: Number,
      default: 71
    },
    completed: {
      type: Boolean,
      default: false
    },
    // Track which question indices this member has already worked on
    questionHistory: {
      type: [Number],
      default: []
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],
  // Questions assigned to this team (array of 3 question IDs)
  assignedQuestions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  // Code stored by question ID, then by language ID
  // Structure: { "questionId1": { "71": "python code", "62": "java code" }, ... }
  codeByQuestion: {
    type: Map,
    of: {
      type: Map,
      of: String
    },
    default: {}
  },
  // Track last used language for each question
  // Structure: { "questionId1": 71, "questionId2": 62, ... }
  questionLanguages: {
    type: Map,
    of: Number,
    default: {}
  },
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
  // NOTE: shuffleTime and eventDuration removed - always use global Settings
  isActive: {
    type: Boolean,
    default: false,
    index: true  // Index for filtering active teams
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
    required: true,
    index: true  // Index for faster lookups
  },
  gmid: {
    type: String,
    required: true,
    index: true  // Index for faster lookups
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
    index: true,  // Index for faster lookups
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
