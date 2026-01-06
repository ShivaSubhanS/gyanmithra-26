import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import { Question, Team, Submission, Settings } from './models.js';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(compression()); // Compress all responses for faster transfer
app.use(cors());
app.use(express.json({ limit: '1mb' })); // Limit request body size

// Connect to MongoDB with connection pooling for better performance
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 100,        // Maximum number of connections in the pool
  minPoolSize: 10,         // Minimum number of connections in the pool
  serverSelectionTimeoutMS: 5000,  // Timeout for server selection
  socketTimeoutMS: 45000,  // Socket timeout
})
  .then(() => console.log('Connected to MongoDB with connection pooling'))
  .catch(err => console.error('MongoDB connection error:', err));

// In-memory cache for settings to reduce DB calls (settings are rarely changed)
let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 60000; // 1 minute cache

async function getSettings() {
  const now = Date.now();
  if (settingsCache && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
    return settingsCache;
  }
  
  let settings = await Settings.findOne({ key: 'global' }).lean();
  if (!settings) {
    settings = { shuffleTime: 60, eventDuration: 300 };
  }
  
  settingsCache = settings;
  settingsCacheTime = now;
  return settings;
}

function invalidateSettingsCache() {
  settingsCache = null;
  settingsCacheTime = 0;
}

// ==================== ADMIN ROUTES ====================

// Register a new team
app.post('/api/admin/register-team', async (req, res) => {
  try {
    const { teamName, gmid1, gmid2, gmid3, adminSecret } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const existingTeam = await Team.findOne({ teamName });
    if (existingTeam) {
      return res.status(400).json({ error: 'Team name already exists' });
    }

    const team = new Team({
      teamName,
      members: [
        { gmid: gmid1 },
        { gmid: gmid2 },
        { gmid: gmid3 }
      ]
    });

    await team.save();
    res.json({ success: true, team });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new question
app.post('/api/admin/add-question', async (req, res) => {
  try {
    const { title, description, difficulty, testCases, adminSecret } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const question = new Question({
      title,
      description,
      difficulty: difficulty || 'medium',
      testCases
    });

    await question.save();
    res.json({ success: true, question });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all questions
app.get('/api/admin/questions', async (req, res) => {
  try {
    const questions = await Question.find().sort({ createdAt: -1 }).lean();
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a question
app.delete('/api/admin/questions/:id', async (req, res) => {
  try {
    const { adminSecret } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Question.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Edit a question
app.put('/api/admin/questions/:id', async (req, res) => {
  try {
    const { adminSecret, title, description, difficulty, testCases } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (title) question.title = title;
    if (description) question.description = description;
    if (difficulty) question.difficulty = difficulty;
    if (testCases) question.testCases = testCases;

    await question.save();
    res.json({ success: true, question });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all questions
app.delete('/api/admin/all-questions', async (req, res) => {
  try {
    const { adminSecret } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Question.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all teams
app.get('/api/admin/teams', async (req, res) => {
  try {
    const teams = await Team.find().populate('assignedQuestions').lean();
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all submissions
app.get('/api/admin/submissions', async (req, res) => {
  try {
    const submissions = await Submission.find()
      .populate('questionId')
      .sort({ submittedAt: -1 })
      .lean();
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all submissions
app.delete('/api/admin/submissions', async (req, res) => {
  try {
    const { adminSecret } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Submission.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a team
app.delete('/api/admin/teams/:teamName', async (req, res) => {
  try {
    const { adminSecret } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Team.findOneAndDelete({ teamName: req.params.teamName });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all teams
app.delete('/api/admin/teams', async (req, res) => {
  try {
    const { adminSecret } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Team.deleteMany({});
    await Submission.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update team
app.put('/api/admin/teams/:teamName', async (req, res) => {
  try {
    const { adminSecret, newTeamName, gmid1, gmid2, gmid3 } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const team = await Team.findOne({ teamName: req.params.teamName });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (newTeamName) team.teamName = newTeamName;
    if (gmid1) team.members[0].gmid = gmid1;
    if (gmid2) team.members[1].gmid = gmid2;
    if (gmid3) team.members[2].gmid = gmid3;

    await team.save();
    res.json({ success: true, team });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get global settings (shuffle time and event duration)
app.get('/api/admin/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = await Settings.create({ key: 'global', shuffleTime: 60, eventDuration: 300 });
    }
    res.json({
      shuffleTime: settings.shuffleTime,
      eventDuration: settings.eventDuration
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save global settings
app.post('/api/admin/settings', async (req, res) => {
  try {
    const { shuffleTime, eventDuration, adminSecret } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = new Settings({ key: 'global' });
    }
    
    if (shuffleTime) settings.shuffleTime = shuffleTime;
    if (eventDuration) settings.eventDuration = eventDuration;
    settings.updatedAt = new Date();
    
    await settings.save();
    
    // Invalidate cache when settings change
    invalidateSettingsCache();
    
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset a team (for admin)
app.post('/api/admin/reset-team/:teamName', async (req, res) => {
  try {
    const { adminSecret } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const team = await Team.findOne({ teamName: req.params.teamName });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Reset member indices and completion status
    team.members.forEach(member => {
      member.currentQuestionIndex = null;
      member.languageId = 71;  // Reset to default Python
      member.completed = false;
      member.lastUpdated = new Date();
    });
    // Clear team-level questions, code, and language tracking
    team.assignedQuestions = [];
    team.codeByQuestion = new Map();
    team.questionLanguages = new Map();
    team.currentRound = 1;
    team.roundStartTime = null;
    team.eventStartTime = null;  // Reset event start time
    team.isActive = false;
    team.eventExpired = false;  // Reset event expired flag
    team.completedAt = null;

    await team.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset all teams (for admin)
app.post('/api/admin/reset-all-teams', async (req, res) => {
  try {
    const { adminSecret } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Use updateMany for bulk operation - much faster than loop
    const result = await Team.updateMany(
      {},
      {
        $set: {
          'members.$[].currentQuestionIndex': null,
          'members.$[].languageId': 71,
          'members.$[].completed': false,
          'members.$[].lastUpdated': new Date(),
          assignedQuestions: [],
          codeByQuestion: {},
          questionLanguages: {},
          currentRound: 1,
          roundStartTime: null,
          eventStartTime: null,
          isActive: false,
          eventExpired: false,
          completedAt: null
        }
      }
    );

    res.json({ success: true, count: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STUDENT ROUTES ====================

// Student login
app.post('/api/student/login', async (req, res) => {
  try {
    const { teamName, gmid } = req.body;

    const team = await Team.findOne({ teamName }).lean();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const memberIndex = team.members.findIndex(m => m.gmid === gmid);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'GMID not found in this team' });
    }

    res.json({ 
      success: true, 
      teamName: team.teamName,
      gmid: gmid,
      memberIndex,
      isActive: team.isActive
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start session (assign random questions to all team members)
app.post('/api/student/start-session', async (req, res) => {
  try {
    const { teamName, gmid } = req.body;

    const team = await Team.findOne({ teamName });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get global settings from cache
    const settings = await getSettings();

    // If session already active, return current state
    if (team.isActive) {
      const memberIndex = team.members.findIndex(m => m.gmid === gmid);
      const member = team.members[memberIndex];
      
      // Get question by member's current index
      const questionId = team.assignedQuestions[member.currentQuestionIndex];
      const question = await Question.findById(questionId);
      
      // Get code for this question from team's codeByQuestion
      const questionIdStr = questionId.toString();
      const codeForQuestion = team.codeByQuestion?.get(questionIdStr) || {};
      const codeByLanguage = codeForQuestion instanceof Map 
        ? Object.fromEntries(codeForQuestion) 
        : codeForQuestion;
      
      // Get the last used language for THIS question (not the member's preference)
      const questionLanguageId = team.questionLanguages?.get(questionIdStr) || 71;
      
      // Calculate remaining times on server side to ensure consistency across all team members
      let remainingShuffleTime = settings.shuffleTime;
      let remainingEventTime = settings.eventDuration;
      
      if (team.roundStartTime) {
        const elapsedShuffle = Math.floor((Date.now() - new Date(team.roundStartTime).getTime()) / 1000);
        remainingShuffleTime = Math.max(0, settings.shuffleTime - elapsedShuffle);
      }
      
      if (team.eventStartTime) {
        const elapsedEvent = Math.floor((Date.now() - new Date(team.eventStartTime).getTime()) / 1000);
        remainingEventTime = Math.max(0, settings.eventDuration - elapsedEvent);
      }
      
      return res.json({
        success: true,
        alreadyActive: true,
        question,
        questionId: questionIdStr,
        codeByLanguage,
        languageId: questionLanguageId,
        completed: member.completed,
        roundStartTime: team.roundStartTime,
        currentRound: team.currentRound,
        eventStartTime: team.eventStartTime,
        shuffleTime: settings.shuffleTime,
        eventDuration: settings.eventDuration,
        eventExpired: team.eventExpired,
        remainingShuffleTime,
        remainingEventTime
      });
    }

    // Get random questions - one easy, one medium, one hard
    const easyQuestions = await Question.find({ difficulty: 'easy' }).lean();
    const mediumQuestions = await Question.find({ difficulty: 'medium' }).lean();
    const hardQuestions = await Question.find({ difficulty: 'hard' }).lean();
    
    if (easyQuestions.length < 1 || mediumQuestions.length < 1 || hardQuestions.length < 1) {
      return res.status(400).json({ 
        error: 'Not enough questions in database. Need at least 1 easy, 1 medium, and 1 hard question.' 
      });
    }

    // Pick random questions from each difficulty
    const selectedQuestions = [
      easyQuestions[Math.floor(Math.random() * easyQuestions.length)],
      mediumQuestions[Math.floor(Math.random() * mediumQuestions.length)],
      hardQuestions[Math.floor(Math.random() * hardQuestions.length)]
    ];

    // Store question IDs at team level
    team.assignedQuestions = selectedQuestions.map(q => q._id);
    
    // Initialize empty code storage and default language for each question
    team.codeByQuestion = new Map();
    team.questionLanguages = new Map();
    selectedQuestions.forEach(q => {
      const qIdStr = q._id.toString();
      team.codeByQuestion.set(qIdStr, new Map());
      team.questionLanguages.set(qIdStr, 71); // Default to Python
    });

    // Assign question indices to members (0=easy, 1=medium, 2=hard)
    for (let i = 0; i < team.members.length; i++) {
      team.members[i].currentQuestionIndex = i;
      team.members[i].completed = false;
    }

    team.isActive = true;
    team.roundStartTime = new Date();
    team.eventStartTime = new Date();
    team.currentRound = 1;
    team.eventExpired = false;

    await team.save();

    // Return the question for the current user
    const memberIndex = team.members.findIndex(m => m.gmid === gmid);
    const memberQuestion = selectedQuestions[memberIndex];

    // Calculate remaining times on server side to ensure consistency across all team members
    const remainingShuffleTime = settings.shuffleTime; // Just started, so full time
    const remainingEventTime = settings.eventDuration; // Just started, so full time

    res.json({
      success: true,
      question: memberQuestion,
      questionId: memberQuestion._id.toString(),
      codeByLanguage: {},
      languageId: team.members[memberIndex].languageId || 71,
      completed: false,
      roundStartTime: team.roundStartTime,
      currentRound: team.currentRound,
      eventStartTime: team.eventStartTime,
      shuffleTime: settings.shuffleTime,
      eventDuration: settings.eventDuration,
      eventExpired: false,
      remainingShuffleTime,
      remainingEventTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current state (for polling/refresh)
app.post('/api/student/get-state', async (req, res) => {
  try {
    const { teamName, gmid } = req.body;

    const team = await Team.findOne({ teamName }).populate('assignedQuestions').lean();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get global settings from cache
    const settings = await getSettings();

    const memberIndex = team.members.findIndex(m => m.gmid === gmid);
    const member = team.members[memberIndex];
    
    // Get question by member's current index
    const question = team.assignedQuestions?.[member.currentQuestionIndex] || null;
    const questionIdStr = question?._id?.toString() || '';
    
    // Get code for this question from team's codeByQuestion
    const codeByLanguage = team.codeByQuestion?.[questionIdStr] || {};
    
    // Get the last used language for THIS question
    const questionLanguageId = team.questionLanguages?.[questionIdStr] || 71;
    
    // Calculate remaining times on server side to ensure consistency across all team members
    let remainingShuffleTime = settings.shuffleTime;
    let remainingEventTime = settings.eventDuration;
    
    if (team.roundStartTime) {
      const elapsedShuffle = Math.floor((Date.now() - new Date(team.roundStartTime).getTime()) / 1000);
      remainingShuffleTime = Math.max(0, settings.shuffleTime - elapsedShuffle);
    }
    
    if (team.eventStartTime) {
      const elapsedEvent = Math.floor((Date.now() - new Date(team.eventStartTime).getTime()) / 1000);
      remainingEventTime = Math.max(0, settings.eventDuration - elapsedEvent);
    }
    
    res.json({
      success: true,
      question,
      questionId: questionIdStr,
      codeByLanguage,
      languageId: questionLanguageId,
      completed: member.completed,
      roundStartTime: team.roundStartTime,
      currentRound: team.currentRound,
      isActive: team.isActive,
      allCompleted: team.members.every(m => m.completed),
      eventStartTime: team.eventStartTime,
      shuffleTime: settings.shuffleTime,
      eventDuration: settings.eventDuration,
      eventExpired: team.eventExpired,
      remainingShuffleTime,
      remainingEventTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save code (auto-save every 10 seconds)
// Code is stored by questionId at team level, not per member
app.post('/api/student/save-code', async (req, res) => {
  try {
    const { teamName, gmid, code, languageId, questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({ error: 'questionId is required' });
    }

    // Update code in team's codeByQuestion and track language for this question
    const result = await Team.updateOne(
      { 
        teamName,
        'members.gmid': gmid,
        'members.completed': { $ne: true }  // Don't update if already completed
      },
      {
        $set: {
          [`codeByQuestion.${questionId}.${languageId}`]: code,
          [`questionLanguages.${questionId}`]: languageId, // Track last used language for this question
          'members.$.lastUpdated': new Date()
        }
      }
    );

    // If no document was modified, check if it's because they're completed
    if (result.matchedCount === 0) {
      const team = await Team.findOne({ teamName, 'members.gmid': gmid }).lean();
      if (team) {
        const member = team.members.find(m => m.gmid === gmid);
        if (member && member.completed) {
          return res.json({ success: true, message: 'Already completed' });
        }
      }
      return res.status(404).json({ error: 'Team or member not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Shuffle questions between team members (called when timer ends)
// Only rotates the question index - no code data movement needed!
app.post('/api/student/shuffle', async (req, res) => {
  try {
    const { teamName } = req.body;

    const team = await Team.findOne({ teamName });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get indices of members who haven't completed
    const incompleteMembers = team.members
      .map((m, i) => ({ memberIdx: i, questionIdx: m.currentQuestionIndex, completed: m.completed }))
      .filter(m => !m.completed);

    // If all completed or only one incomplete, no shuffle needed
    if (incompleteMembers.length <= 1) {
      team.roundStartTime = new Date();
      team.currentRound += 1;
      await team.save();
      return res.json({ success: true, message: 'No shuffle needed' });
    }

    // Get the question indices of incomplete members
    const questionIndices = incompleteMembers.map(m => m.questionIdx);
    
    // Rotate the question indices (shift by 1): [0, 1, 2] -> [1, 2, 0]
    const rotatedIndices = [...questionIndices.slice(1), questionIndices[0]];

    // Apply the rotated indices back to incomplete members
    // This is all that's needed - code stays with its question!
    incompleteMembers.forEach((m, i) => {
      team.members[m.memberIdx].currentQuestionIndex = rotatedIndices[i];
    });

    team.roundStartTime = new Date();
    team.currentRound += 1;
    await team.save();

    res.json({ success: true, shuffled: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run code against Judge0
app.post('/api/student/run-code', async (req, res) => {
  try {
    const { teamName, gmid, code, languageId, questionId } = req.body;

    const team = await Team.findOne({ teamName }).populate('assignedQuestions');
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const memberIndex = team.members.findIndex(m => m.gmid === gmid);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const member = team.members[memberIndex];
    
    // Get question by member's current index
    const question = team.assignedQuestions[member.currentQuestionIndex];

    if (!question || !question.testCases || question.testCases.length === 0) {
      return res.status(400).json({ error: 'No test cases found for this question' });
    }

    const totalTestCases = question.testCases.length;
    const usedLanguageId = languageId || 71; // Default to Python 3

    // Run all test cases concurrently
    const results = await Promise.all(
      question.testCases.map(async (testCase) => {
        try {
          // Submit to Judge0
          const submitResponse = await axios.post(
            `${process.env.JUDGE0_API_URL}/submissions/?wait=true`,
            {
              language_id: usedLanguageId,
              source_code: code,
              stdin: testCase.input
            },
            {
              headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'BrainwaveBuzzer/1.0'
              },
              timeout: 30000  // 30 second timeout to prevent hanging
            }
          );

          const result = submitResponse.data;
          
          // Judge0 status codes: 3 = Accepted (correct output)
          const actualOutput = (result.stdout || result.stderr || result.compile_output || '').trim();
          const expectedOutput = testCase.expectedOutput.trim();
          const passed = result.status?.id === 3 && actualOutput === expectedOutput;

          return {
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: actualOutput || 'No output',
            passed,
            status: result.status?.description || 'Unknown',
            time: result.time,
            memory: result.memory
          };
        } catch (judgeError) {
          console.error('Judge0 API Error:', judgeError.response?.data || judgeError.message);
          return {
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: `Judge0 Error: ${judgeError.response?.data?.message || judgeError.message}`,
            passed: false,
            status: 'Error'
          };
        }
      })
    );

    const passedCount = results.filter(r => r.passed).length;
    const allPassed = passedCount === totalTestCases;

    // Save submission record only if at least 1 test case passed
    if (passedCount >= 1) {
      const submission = new Submission({
        teamName,
        gmid,
        questionId: question._id,
        code,
        languageId: usedLanguageId,
        passed: allPassed,
        totalTestCases,
        passedTestCases: passedCount
      });
      await submission.save();
    }

    // If all test cases passed, mark as completed
    if (allPassed) {
      team.members[memberIndex].completed = true;
      // Note: code is already saved in codeByQuestion via save-code endpoint
      
      // Check if all team members completed
      const allCompleted = team.members.every(m => m.completed);
      if (allCompleted) {
        team.completedAt = new Date();
      }
      
      // Single save for all changes
      await team.save();
    }

    res.json({
      success: true,
      results,
      allPassed,
      passedCount,
      totalTestCases,
      completed: allPassed,
      allTeamCompleted: team.members.every(m => m.completed)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if shuffle is needed (called by client to check)
app.post('/api/student/check-shuffle', async (req, res) => {
  try {
    const { teamName, gmid, clientRound } = req.body;

    const team = await Team.findOne({ teamName }).populate('assignedQuestions').lean();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get global settings from cache
    const settings = await getSettings();

    const memberIndex = team.members.findIndex(m => m.gmid === gmid);
    const member = team.members[memberIndex];

    // Check if round changed (meaning shuffle happened)
    const shuffleHappened = team.currentRound > clientRound;

    // Get question by member's current index
    const question = team.assignedQuestions?.[member.currentQuestionIndex] || null;
    const questionIdStr = question?._id?.toString() || '';
    
    // Get code for this question from team's codeByQuestion
    const codeByLanguage = team.codeByQuestion?.[questionIdStr] || {};

    // Get the last used language for THIS question
    const questionLanguageId = team.questionLanguages?.[questionIdStr] || 71;

    // Calculate remaining times on server side to ensure consistency across all team members
    let remainingShuffleTime = settings.shuffleTime;
    let remainingEventTime = settings.eventDuration;
    
    if (team.roundStartTime) {
      const elapsedShuffle = Math.floor((Date.now() - new Date(team.roundStartTime).getTime()) / 1000);
      remainingShuffleTime = Math.max(0, settings.shuffleTime - elapsedShuffle);
    }
    
    if (team.eventStartTime) {
      const elapsedEvent = Math.floor((Date.now() - new Date(team.eventStartTime).getTime()) / 1000);
      remainingEventTime = Math.max(0, settings.eventDuration - elapsedEvent);
    }

    res.json({
      success: true,
      currentRound: team.currentRound,
      shuffleHappened,
      question,
      questionId: questionIdStr,
      codeByLanguage,
      languageId: questionLanguageId,
      completed: member.completed,
      roundStartTime: team.roundStartTime,
      eventStartTime: team.eventStartTime,
      shuffleTime: settings.shuffleTime,
      eventDuration: settings.eventDuration,
      eventExpired: team.eventExpired,
      remainingShuffleTime,
      remainingEventTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event expired - auto submit
app.post('/api/student/event-expired', async (req, res) => {
  try {
    const { teamName, gmid } = req.body;

    const team = await Team.findOne({ teamName });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Mark event as expired (code is already saved via auto-save)
    team.eventExpired = true;
    await team.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
