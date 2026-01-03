import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Question, Team, Submission, Settings } from './models.js';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

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
    const { title, description, testCases, adminSecret } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const question = new Question({
      title,
      description,
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
    const questions = await Question.find().sort({ createdAt: -1 });
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
    const { adminSecret, title, description, testCases } = req.body;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (title) question.title = title;
    if (description) question.description = description;
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
    const teams = await Team.find().populate('members.questionId');
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
      .sort({ submittedAt: -1 });
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

    team.members.forEach(member => {
      member.questionId = null;
      member.code = '';
      member.completed = false;
    });
    team.currentRound = 1;
    team.roundStartTime = null;
    team.isActive = false;
    team.completedAt = null;

    await team.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STUDENT ROUTES ====================

// Student login
app.post('/api/student/login', async (req, res) => {
  try {
    const { teamName, gmid } = req.body;

    const team = await Team.findOne({ teamName });
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

    // Get global settings
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = { shuffleTime: 60, eventDuration: 300 };
    }

    // If session already active, return current state
    if (team.isActive) {
      const memberIndex = team.members.findIndex(m => m.gmid === gmid);
      const member = team.members[memberIndex];
      const question = await Question.findById(member.questionId);
      
      return res.json({
        success: true,
        alreadyActive: true,
        question,
        code: member.code,
        completed: member.completed,
        roundStartTime: team.roundStartTime,
        currentRound: team.currentRound,
        eventStartTime: team.eventStartTime,
        shuffleTime: settings.shuffleTime,
        eventDuration: settings.eventDuration,
        eventExpired: team.eventExpired
      });
    }

    // Get random questions for each member
    const questions = await Question.aggregate([{ $sample: { size: 3 } }]);
    
    if (questions.length < 3) {
      return res.status(400).json({ error: 'Not enough questions in database. Need at least 3.' });
    }

    // Assign questions to members
    for (let i = 0; i < team.members.length; i++) {
      team.members[i].questionId = questions[i]._id;
      team.members[i].code = '';
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
    const memberQuestion = questions[memberIndex];

    res.json({
      success: true,
      question: memberQuestion,
      code: team.members[memberIndex].code,
      completed: false,
      roundStartTime: team.roundStartTime,
      currentRound: team.currentRound,
      eventStartTime: team.eventStartTime,
      shuffleTime: settings.shuffleTime,
      eventDuration: settings.eventDuration,
      eventExpired: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current state (for polling/refresh)
app.post('/api/student/get-state', async (req, res) => {
  try {
    const { teamName, gmid } = req.body;

    const team = await Team.findOne({ teamName }).populate('members.questionId');
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get global settings
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = { shuffleTime: 60, eventDuration: 300 };
    }

    const memberIndex = team.members.findIndex(m => m.gmid === gmid);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const member = team.members[memberIndex];
    
    res.json({
      success: true,
      question: member.questionId,
      code: member.code,
      completed: member.completed,
      roundStartTime: team.roundStartTime,
      currentRound: team.currentRound,
      isActive: team.isActive,
      allCompleted: team.members.every(m => m.completed),
      eventStartTime: team.eventStartTime,
      shuffleTime: settings.shuffleTime,
      eventDuration: settings.eventDuration,
      eventExpired: team.eventExpired
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save code (auto-save every 10 seconds)
app.post('/api/student/save-code', async (req, res) => {
  try {
    const { teamName, gmid, code } = req.body;

    const team = await Team.findOne({ teamName });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const memberIndex = team.members.findIndex(m => m.gmid === gmid);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Don't save if already completed
    if (team.members[memberIndex].completed) {
      return res.json({ success: true, message: 'Already completed' });
    }

    team.members[memberIndex].code = code;
    team.members[memberIndex].lastUpdated = new Date();
    await team.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Shuffle code between team members (called when timer ends)
app.post('/api/student/shuffle', async (req, res) => {
  try {
    const { teamName } = req.body;

    const team = await Team.findOne({ teamName }).populate('members.questionId');
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get indices of members who haven't completed
    const incompleteIndices = team.members
      .map((m, i) => (!m.completed ? i : -1))
      .filter(i => i !== -1);

    // If all completed or only one incomplete, no shuffle needed
    if (incompleteIndices.length <= 1) {
      team.roundStartTime = new Date();
      team.currentRound += 1;
      await team.save();
      return res.json({ success: true, message: 'No shuffle needed' });
    }

    // Create a shuffled version of the incomplete members' data
    const shuffledData = incompleteIndices.map(i => ({
      questionId: team.members[i].questionId,
      code: team.members[i].code
    }));

    // Rotate the data (shift by 1)
    const rotatedData = [...shuffledData.slice(1), shuffledData[0]];

    // Apply the rotated data back to incomplete members
    incompleteIndices.forEach((memberIdx, dataIdx) => {
      team.members[memberIdx].questionId = rotatedData[dataIdx].questionId._id || rotatedData[dataIdx].questionId;
      team.members[memberIdx].code = rotatedData[dataIdx].code;
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
    const { teamName, gmid, code, languageId } = req.body;

    const team = await Team.findOne({ teamName }).populate('members.questionId');
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const memberIndex = team.members.findIndex(m => m.gmid === gmid);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const member = team.members[memberIndex];
    const question = member.questionId;

    if (!question || !question.testCases || question.testCases.length === 0) {
      return res.status(400).json({ error: 'No test cases found for this question' });
    }

    const results = [];
    let passedCount = 0;
    const totalTestCases = question.testCases.length;
    const usedLanguageId = languageId || 71; // Default to Python 3

    // Run each test case
    for (const testCase of question.testCases) {
      try {
        // Submit to Judge0
        const submitResponse = await axios.post(
          `${process.env.JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`,
          {
            source_code: code,
            language_id: usedLanguageId,
            stdin: testCase.input,
            expected_output: testCase.expectedOutput
          },
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );

        const result = submitResponse.data;
        const passed = result.status?.id === 3 && 
                       result.stdout?.trim() === testCase.expectedOutput.trim();

        results.push({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: result.stdout || result.stderr || result.compile_output || 'No output',
          passed,
          status: result.status?.description || 'Unknown',
          time: result.time,
          memory: result.memory
        });

        if (passed) passedCount++;
      } catch (judgeError) {
        results.push({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: 'Judge0 Error: ' + judgeError.message,
          passed: false,
          status: 'Error'
        });
      }
    }

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
      team.members[memberIndex].code = code;
      await team.save();

      // Check if all team members completed
      const allCompleted = team.members.every(m => m.completed);
      if (allCompleted) {
        team.completedAt = new Date();
        await team.save();
      }
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

    const team = await Team.findOne({ teamName }).populate('members.questionId');
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get global settings
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = { shuffleTime: 60, eventDuration: 300 };
    }

    const memberIndex = team.members.findIndex(m => m.gmid === gmid);
    const member = team.members[memberIndex];

    // Check if round changed (meaning shuffle happened)
    const shuffleHappened = team.currentRound > clientRound;

    res.json({
      success: true,
      currentRound: team.currentRound,
      shuffleHappened,
      question: member.questionId,
      code: member.code,
      completed: member.completed,
      roundStartTime: team.roundStartTime,
      eventStartTime: team.eventStartTime,
      shuffleTime: settings.shuffleTime,
      eventDuration: settings.eventDuration,
      eventExpired: team.eventExpired
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event expired - auto submit
app.post('/api/student/event-expired', async (req, res) => {
  try {
    const { teamName, gmid, code } = req.body;

    const team = await Team.findOne({ teamName });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Save final code
    const memberIndex = team.members.findIndex(m => m.gmid === gmid);
    if (memberIndex !== -1) {
      team.members[memberIndex].code = code;
      team.members[memberIndex].lastUpdated = new Date();
    }

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
