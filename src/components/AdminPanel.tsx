import { useState, useEffect, useRef } from 'react';
import api from '../api';
import type { Question, Team, Submission } from '../types';
import './AdminPanel.css';

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'teams' | 'questions' | 'submissions' | 'settings'>('teams');
  const [adminSecret, setAdminSecret] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Teams state
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeam, setNewTeam] = useState({ teamName: '', gmid1: '', gmid2: '', gmid3: '' });
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editForm, setEditForm] = useState({ teamName: '', gmid1: '', gmid2: '', gmid3: '' });
  const [teamSearch, setTeamSearch] = useState('');

  // Global Settings state
  const [shuffleTime, setShuffleTime] = useState(60);
  const [eventDuration, setEventDuration] = useState(300);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState({
    title: '',
    description: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    testCases: [{ input: '', expectedOutput: '' }]
  });
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editQuestionForm, setEditQuestionForm] = useState({
    title: '',
    description: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    testCases: [{ input: '', expectedOutput: '' }]
  });
  const [questionSearch, setQuestionSearch] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Submissions state
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'passed' | 'failed'>('all');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      fetchSettings();
    }
  }, [isAuthenticated, activeTab]);

  const fetchSettings = async () => {
    try {
      const data = await api.admin.getSettings();
      if (data.shuffleTime) setShuffleTime(data.shuffleTime);
      if (data.eventDuration) setEventDuration(data.eventDuration);
    } catch (error) {
      console.error('Failed to fetch settings');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'teams') {
        const data = await api.admin.getTeams();
        setTeams(data);
      } else if (activeTab === 'questions') {
        const data = await api.admin.getQuestions();
        setQuestions(data);
      } else if (activeTab === 'submissions') {
        const data = await api.admin.getSubmissions();
        setSubmissions(data);
      }
    } catch (error) {
      showMessage('error', 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleLogin = async () => {
    if (!adminSecret) {
      showMessage('error', 'Please enter admin secret');
      return;
    }

    setLoading(true);
    try {
      // Try to fetch teams with the provided secret - if it works, the secret is valid
      const result = await api.admin.registerTeam('__validation__', 'test1', 'test2', 'test3', adminSecret, 60, 300);
      
      // If we get an unauthorized error, the password is wrong
      if (result.error === 'Unauthorized') {
        showMessage('error', 'Invalid admin secret');
        setAdminSecret('');
      } else if (result.error === 'Team name already exists' || result.success) {
        // If we get team exists or success, the password is correct
        setIsAuthenticated(true);
        // Delete the validation team if it was created
        if (result.success) {
          await api.admin.deleteTeam('__validation__', adminSecret);
        }
      } else {
        showMessage('error', 'Invalid admin secret');
        setAdminSecret('');
      }
    } catch (error) {
      showMessage('error', 'Failed to validate admin secret');
      setAdminSecret('');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.admin.registerTeam(
        newTeam.teamName,
        newTeam.gmid1,
        newTeam.gmid2,
        newTeam.gmid3,
        adminSecret,
        shuffleTime,
        eventDuration
      );

      if (result.error) {
        showMessage('error', result.error);
      } else {
        showMessage('success', 'Team registered successfully!');
        setNewTeam({ teamName: '', gmid1: '', gmid2: '', gmid3: '' });
        fetchData();
      }
    } catch (error) {
      showMessage('error', 'Failed to register team');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamName: string) => {
    if (!confirm(`Are you sure you want to delete team "${teamName}"?`)) return;
    
    try {
      const result = await api.admin.deleteTeam(teamName, adminSecret);
      if (result.error) {
        showMessage('error', result.error);
      } else {
        showMessage('success', 'Team deleted successfully!');
        fetchData();
      }
    } catch (error) {
      showMessage('error', 'Failed to delete team');
    }
  };

  const handleDeleteAllTeams = async () => {
    if (!confirm('Are you sure you want to delete ALL teams? This action cannot be undone!')) return;
    
    try {
      const result = await api.admin.deleteAllTeams(adminSecret);
      if (result.error) {
        showMessage('error', result.error);
      } else {
        showMessage('success', 'All teams deleted successfully!');
        fetchData();
      }
    } catch (error) {
      showMessage('error', 'Failed to delete all teams');
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setEditForm({
      teamName: team.teamName,
      gmid1: team.members[0]?.gmid || '',
      gmid2: team.members[1]?.gmid || '',
      gmid3: team.members[2]?.gmid || ''
    });
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    
    setLoading(true);
    try {
      const result = await api.admin.updateTeam(editingTeam.teamName, {
        newTeamName: editForm.teamName,
        gmid1: editForm.gmid1,
        gmid2: editForm.gmid2,
        gmid3: editForm.gmid3
      }, adminSecret);

      if (result.error) {
        showMessage('error', result.error);
      } else {
        showMessage('success', 'Team updated successfully!');
        setEditingTeam(null);
        fetchData();
      }
    } catch (error) {
      showMessage('error', 'Failed to update team');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const result = await api.admin.saveSettings(shuffleTime, eventDuration, adminSecret);
      if (result.error) {
        showMessage('error', result.error);
      } else {
        showMessage('success', 'Settings saved successfully!');
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
      }
    } catch (error) {
      showMessage('error', 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const downloadTeamsCSV = () => {
    const headers = ['Team Name', 'GMID 1', 'GMID 2', 'GMID 3', 'Status'];
    const rows = teams.map(team => [
      team.teamName,
      team.members[0]?.gmid || '',
      team.members[1]?.gmid || '',
      team.members[2]?.gmid || '',
      team.isActive ? 'Active' : 'Inactive'
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teams.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.admin.addQuestion(newQuestion, adminSecret);

      if (result.error) {
        showMessage('error', result.error);
      } else {
        showMessage('success', 'Question added successfully!');
        setNewQuestion({
          title: '',
          description: '',
          difficulty: 'medium',
          testCases: [{ input: '', expectedOutput: '' }]
        });
        fetchData();
      }
    } catch (error) {
      showMessage('error', 'Failed to add question');
    } finally {
      setLoading(false);
    }
  };

  // Parse CSV and upload questions
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        showMessage('error', 'CSV file is empty or has no data rows');
        return;
      }

      // Parse header to find test case columns
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const titleIdx = header.indexOf('q_title');
      const descIdx = header.indexOf('q_description');
      const difficultyIdx = header.indexOf('q_difficulty');
      
      if (titleIdx === -1 || descIdx === -1) {
        showMessage('error', 'CSV must have q_title and q_description columns');
        return;
      }

      // Find test case columns (tc1_inp, tc1_out, tc2_inp, tc2_out, etc.)
      const testCaseCols: { inputIdx: number; outputIdx: number }[] = [];
      let tcNum = 1;
      while (true) {
        const inpIdx = header.indexOf(`tc${tcNum}_inp`);
        const outIdx = header.indexOf(`tc${tcNum}_out`);
        if (inpIdx === -1 || outIdx === -1) break;
        testCaseCols.push({ inputIdx: inpIdx, outputIdx: outIdx });
        tcNum++;
      }

      if (testCaseCols.length === 0) {
        showMessage('error', 'CSV must have at least tc1_inp and tc1_out columns');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // Process each data row
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVRow(lines[i]);
        if (row.length < Math.max(titleIdx, descIdx, ...testCaseCols.map(tc => Math.max(tc.inputIdx, tc.outputIdx))) + 1) {
          errorCount++;
          continue;
        }

        const title = row[titleIdx]?.trim();
        const description = row[descIdx]?.trim();
        const difficulty = difficultyIdx !== -1 ? row[difficultyIdx]?.trim().toLowerCase() : 'medium';

        if (!title || !description) {
          errorCount++;
          continue;
        }

        // Validate difficulty
        const validDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';

        // Extract test cases
        const testCases: { input: string; expectedOutput: string }[] = [];
        for (const tc of testCaseCols) {
          const input = row[tc.inputIdx]?.trim();
          const output = row[tc.outputIdx]?.trim();
          if (input !== undefined && output !== undefined && (input || output)) {
            testCases.push({ input, expectedOutput: output });
          }
        }

        if (testCases.length === 0) {
          errorCount++;
          continue;
        }

        try {
          const result = await api.admin.addQuestion({
            title,
            description,
            difficulty: validDifficulty,
            testCases
          }, adminSecret);

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      showMessage('success', `Imported ${successCount} questions${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
      fetchData();
    } catch (error) {
      showMessage('error', 'Failed to parse CSV file');
    } finally {
      setLoading(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  // Helper to parse CSV row (handles quoted values)
  const parseCSVRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const addTestCase = () => {
    setNewQuestion({
      ...newQuestion,
      testCases: [...newQuestion.testCases, { input: '', expectedOutput: '' }]
    });
  };

  const removeTestCase = (index: number) => {
    if (newQuestion.testCases.length <= 1) return;
    setNewQuestion({
      ...newQuestion,
      testCases: newQuestion.testCases.filter((_, i) => i !== index)
    });
  };

  const updateTestCase = (index: number, field: 'input' | 'expectedOutput', value: string) => {
    const updated = [...newQuestion.testCases];
    updated[index][field] = value;
    setNewQuestion({ ...newQuestion, testCases: updated });
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    setLoading(true);
    try {
      const result = await api.admin.deleteQuestion(id, adminSecret);
      if (result.error) {
        showMessage('error', result.error);
      } else {
        showMessage('success', 'Question deleted successfully!');
        fetchData();
      }
    } catch (error) {
      showMessage('error', 'Failed to delete question');
    } finally {
      setLoading(false);
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setEditQuestionForm({
      title: question.title,
      description: question.description,
      difficulty: question.difficulty || 'medium',
      testCases: question.testCases
    });
  };

  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    setLoading(true);
    try {
      const result = await api.admin.editQuestion(editingQuestion._id, editQuestionForm, adminSecret);
      if (result.error) {
        showMessage('error', result.error);
      } else {
        showMessage('success', 'Question updated successfully!');
        setEditingQuestion(null);
        fetchData();
      }
    } catch (error) {
      showMessage('error', 'Failed to update question');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllQuestions = async () => {
    if (!confirm('Are you sure you want to delete ALL questions? This action cannot be undone!')) return;
    
    setLoading(true);
    try {
      const result = await api.admin.deleteAllQuestions(adminSecret);
      if (result.error) {
        showMessage('error', result.error);
      } else {
        showMessage('success', 'All questions deleted successfully!');
        fetchData();
      }
    } catch (error) {
      showMessage('error', 'Failed to delete all questions');
    } finally {
      setLoading(false);
    }
  };

  const downloadQuestionsCSV = () => {
    // Find max test cases count
    const maxTC = Math.max(...questions.map(q => q.testCases.length), 1);
    
    // Build header with dynamic test case columns
    const headers = ['q_title', 'q_description'];
    for (let i = 1; i <= maxTC; i++) {
      headers.push(`tc${i}_inp`, `tc${i}_out`);
    }
    
    const rows = questions.map(q => {
      const row = [
        `"${q.title.replace(/"/g, '""')}"`,
        `"${q.description.replace(/"/g, '""')}"`
      ];
      for (let i = 0; i < maxTC; i++) {
        if (q.testCases[i]) {
          row.push(`"${q.testCases[i].input.replace(/"/g, '""')}"`, `"${q.testCases[i].expectedOutput.replace(/"/g, '""')}"`);
        } else {
          row.push('', '');
        }
      }
      return row;
    });
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSubmissionsCSV = () => {
    const headers = ['Team Name', 'GMID', 'Question Title', 'Language', 'Status', 'Passed TC', 'Total TC', 'Submitted At'];
    const langNames: Record<number, string> = { 71: 'Python 3', 62: 'Java', 54: 'C++', 50: 'C' };
    
    const rows = submissions.map(sub => [
      sub.teamName,
      sub.gmid,
      sub.questionId?.title || 'Unknown',
      langNames[sub.languageId] || `Lang ${sub.languageId}`,
      sub.passed ? 'All Passed' : 'Partial',
      sub.passedTestCases || 0,
      sub.totalTestCases || 0,
      new Date(sub.submittedAt).toLocaleString()
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'submissions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered data getters
  const filteredTeams = teams.filter(t => 
    t.teamName.toLowerCase().includes(teamSearch.toLowerCase()) ||
    t.members.some(m => m.gmid.toLowerCase().includes(teamSearch.toLowerCase()))
  );

  const filteredQuestions = questions.filter(q =>
    q.title.toLowerCase().includes(questionSearch.toLowerCase()) ||
    q.description.toLowerCase().includes(questionSearch.toLowerCase())
  );

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = 
      sub.teamName.toLowerCase().includes(submissionSearch.toLowerCase()) ||
      sub.gmid.toLowerCase().includes(submissionSearch.toLowerCase()) ||
      (sub.questionId?.title || '').toLowerCase().includes(submissionSearch.toLowerCase());
    
    const matchesFilter = 
      submissionFilter === 'all' ||
      (submissionFilter === 'passed' && sub.passed) ||
      (submissionFilter === 'failed' && !sub.passed);
    
    return matchesSearch && matchesFilter;
  });

  const handleDeleteAllSubmissions = async () => {
    if (!confirm('Are you sure you want to delete ALL submissions? This action cannot be undone!')) return;
    
    setLoading(true);
    try {
      const result = await api.admin.deleteAllSubmissions(adminSecret);
      if (result.error) {
        showMessage('error', result.error);
      } else {
        showMessage('success', 'All submissions deleted successfully!');
        fetchData();
      }
    } catch (error) {
      showMessage('error', 'Failed to delete all submissions');
    } finally {
      setLoading(false);
    }
  };

  const updateEditQuestionTestCase = (index: number, field: 'input' | 'expectedOutput', value: string) => {
    const updated = [...editQuestionForm.testCases];
    updated[index][field] = value;
    setEditQuestionForm({ ...editQuestionForm, testCases: updated });
  };

  const addEditQuestionTestCase = () => {
    setEditQuestionForm({
      ...editQuestionForm,
      testCases: [...editQuestionForm.testCases, { input: '', expectedOutput: '' }]
    });
  };

  const removeEditQuestionTestCase = (index: number) => {
    if (editQuestionForm.testCases.length <= 1) return;
    setEditQuestionForm({
      ...editQuestionForm,
      testCases: editQuestionForm.testCases.filter((_, i) => i !== index)
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-panel">
        <div className="admin-login">
          <h1>🔐 Admin Login</h1>
          {message.text && (
            <div className={`message ${message.type}`}>
              {message.text}
            </div>
          )}
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Enter admin secret"
            disabled={loading}
          />
          <div className="admin-login-actions">
            <button onClick={handleLogin} className="login-btn" disabled={loading}>
              {loading ? 'Validating...' : 'Login'}
            </button>
            <button onClick={onBack} className="back-btn" disabled={loading}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <h1>🛠️ Admin Panel</h1>
        <button onClick={onBack} className="back-btn">← Back to Home</button>
      </header>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <nav className="admin-tabs">
        <button
          className={activeTab === 'teams' ? 'active' : ''}
          onClick={() => setActiveTab('teams')}
        >
          👥 Teams
        </button>
        <button
          className={activeTab === 'questions' ? 'active' : ''}
          onClick={() => setActiveTab('questions')}
        >
          📝 Questions
        </button>
        <button
          className={activeTab === 'submissions' ? 'active' : ''}
          onClick={() => setActiveTab('submissions')}
        >
          📊 Submissions
        </button>
        <button
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
      </nav>

      <main className="admin-content">
        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="tab-content">
            <section className="form-section">
              <h2>Register New Team</h2>
              <form onSubmit={handleRegisterTeam} className="admin-form">
                <div className="form-row">
                  <input
                    type="text"
                    value={newTeam.teamName}
                    onChange={(e) => setNewTeam({ ...newTeam, teamName: e.target.value })}
                    placeholder="Team Name"
                    required
                  />
                </div>
                <div className="form-row three-col">
                  <input
                    type="text"
                    value={newTeam.gmid1}
                    onChange={(e) => setNewTeam({ ...newTeam, gmid1: e.target.value })}
                    placeholder="GMID 1"
                    required
                  />
                  <input
                    type="text"
                    value={newTeam.gmid2}
                    onChange={(e) => setNewTeam({ ...newTeam, gmid2: e.target.value })}
                    placeholder="GMID 2"
                    required
                  />
                  <input
                    type="text"
                    value={newTeam.gmid3}
                    onChange={(e) => setNewTeam({ ...newTeam, gmid3: e.target.value })}
                    placeholder="GMID 3"
                    required
                  />
                </div>
                <button type="submit" disabled={loading}>
                  {loading ? 'Registering...' : 'Register Team'}
                </button>
              </form>
            </section>

            <section className="list-section">
              <div className="section-header">
                <h2>Registered Teams ({filteredTeams.length})</h2>
                <div className="section-actions">
                  <input
                    type="text"
                    placeholder="Search teams..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="search-input"
                  />
                  <button onClick={downloadTeamsCSV} className="action-btn csv-btn">
                    📥 Download CSV
                  </button>
                  <button onClick={handleDeleteAllTeams} className="action-btn danger-btn">
                    🗑️ Delete All
                  </button>
                </div>
              </div>
              <div className="teams-grid">
                {filteredTeams.map((team) => (
                  <div key={team._id} className="team-card">
                    <div className="team-header">
                      <h3>{team.teamName}</h3>
                      <span className={`status-badge ${team.isActive ? 'active' : 'inactive'}`}>
                        {team.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="team-members">
                      {team.members.map((member, idx) => (
                        <div key={idx} className="member">
                          <span className="gmid">{member.gmid}</span>
                          {member.completed && <span className="completed">✓</span>}
                        </div>
                      ))}
                    </div>
                    <div className="team-actions">
                      <button 
                        onClick={() => handleEditTeam(team)}
                        className="edit-btn"
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteTeam(team.teamName)}
                        className="delete-btn"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Edit Team Modal */}
            {editingTeam && (
              <div className="modal-overlay" onClick={() => setEditingTeam(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h2>Edit Team: {editingTeam.teamName}</h2>
                  <form onSubmit={handleUpdateTeam} className="admin-form">
                    <div className="input-group">
                      <label>Team Name</label>
                      <input
                        type="text"
                        value={editForm.teamName}
                        onChange={(e) => setEditForm({ ...editForm, teamName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-row three-col">
                      <div className="input-group">
                        <label>GMID 1</label>
                        <input
                          type="text"
                          value={editForm.gmid1}
                          onChange={(e) => setEditForm({ ...editForm, gmid1: e.target.value })}
                          required
                        />
                      </div>
                      <div className="input-group">
                        <label>GMID 2</label>
                        <input
                          type="text"
                          value={editForm.gmid2}
                          onChange={(e) => setEditForm({ ...editForm, gmid2: e.target.value })}
                          required
                        />
                      </div>
                      <div className="input-group">
                        <label>GMID 3</label>
                        <input
                          type="text"
                          value={editForm.gmid3}
                          onChange={(e) => setEditForm({ ...editForm, gmid3: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="modal-actions">
                      <button type="button" onClick={() => setEditingTeam(null)} className="cancel-btn">
                        Cancel
                      </button>
                      <button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="tab-content">
            <section className="form-section">
              <div className="form-header">
                <h2>Add New Question</h2>
                <div className="upload-section">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    ref={csvInputRef}
                    style={{ display: 'none' }}
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="upload-btn">
                    📤 Upload CSV
                  </label>
                </div>
              </div>
              <form onSubmit={handleAddQuestion} className="admin-form question-form">
                <input
                  type="text"
                  value={newQuestion.title}
                  onChange={(e) => setNewQuestion({ ...newQuestion, title: e.target.value })}
                  placeholder="Question Title"
                  required
                />
                
                <textarea
                  value={newQuestion.description}
                  onChange={(e) => setNewQuestion({ ...newQuestion, description: e.target.value })}
                  placeholder="Question Description (include examples, constraints, etc.)"
                  rows={6}
                  required
                />

                <select
                  value={newQuestion.difficulty}
                  onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}
                  className="difficulty-select"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>

                <div className="test-cases-section">
                  <div className="section-header">
                    <h3>Test Cases</h3>
                    <button type="button" onClick={addTestCase} className="add-btn">
                      + Add Test Case
                    </button>
                  </div>
                  
                  {newQuestion.testCases.map((tc, idx) => (
                    <div key={idx} className="test-case-row">
                      <span className="tc-number">#{idx + 1}</span>
                      <input
                        type="text"
                        value={tc.input}
                        onChange={(e) => updateTestCase(idx, 'input', e.target.value)}
                        placeholder="Input"
                        required
                      />
                      <input
                        type="text"
                        value={tc.expectedOutput}
                        onChange={(e) => updateTestCase(idx, 'expectedOutput', e.target.value)}
                        placeholder="Expected Output"
                        required
                      />
                      {newQuestion.testCases.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeTestCase(idx)}
                          className="remove-btn"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Question'}
                </button>
              </form>
            </section>

            <section className="list-section">
              <div className="section-header">
                <h2>Questions ({filteredQuestions.length})</h2>
                <div className="section-actions">
                  <input
                    type="text"
                    placeholder="Search questions..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="search-input"
                  />
                  <button onClick={downloadQuestionsCSV} className="download-btn" disabled={questions.length === 0}>
                    📥 Download CSV
                  </button>
                  <button onClick={handleDeleteAllQuestions} className="delete-all-btn" disabled={questions.length === 0}>
                    🗑️ Delete All
                  </button>
                </div>
              </div>
              <div className="questions-list">
                {filteredQuestions.map((q) => (
                  <div key={q._id} className="question-card">
                    <div className="question-header">
                      <h3>{q.title}</h3>
                      <span className={`difficulty-badge ${q.difficulty || 'medium'}`}>
                        {(q.difficulty || 'medium').toUpperCase()}
                      </span>
                    </div>
                    <p className="question-desc">{q.description.slice(0, 150)}...</p>
                    <div className="question-meta">
                      <span>{q.testCases.length} test cases</span>
                    </div>
                    <div className="card-actions">
                      <button 
                        onClick={() => handleEditQuestion(q)}
                        className="edit-btn"
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteQuestion(q._id)}
                        className="delete-btn"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Edit Question Modal */}
            {editingQuestion && (
              <div className="modal-overlay" onClick={() => setEditingQuestion(null)}>
                <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                  <h2>Edit Question: {editingQuestion.title}</h2>
                  <form onSubmit={handleUpdateQuestion} className="admin-form question-form">
                    <div className="input-group">
                      <label>Title</label>
                      <input
                        type="text"
                        value={editQuestionForm.title}
                        onChange={(e) => setEditQuestionForm({ ...editQuestionForm, title: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="input-group">
                      <label>Description</label>
                      <textarea
                        value={editQuestionForm.description}
                        onChange={(e) => setEditQuestionForm({ ...editQuestionForm, description: e.target.value })}
                        rows={6}
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label>Difficulty</label>
                      <select
                        value={editQuestionForm.difficulty}
                        onChange={(e) => setEditQuestionForm({ ...editQuestionForm, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}
                        className="difficulty-select"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>

                    <div className="test-cases-section">
                      <div className="section-header">
                        <label>Test Cases</label>
                        <button type="button" onClick={addEditQuestionTestCase} className="add-btn">
                          + Add Test Case
                        </button>
                      </div>
                      
                      {editQuestionForm.testCases.map((tc, idx) => (
                        <div key={idx} className="test-case-row">
                          <span className="tc-number">#{idx + 1}</span>
                          <input
                            type="text"
                            value={tc.input}
                            onChange={(e) => updateEditQuestionTestCase(idx, 'input', e.target.value)}
                            placeholder="Input"
                            required
                          />
                          <input
                            type="text"
                            value={tc.expectedOutput}
                            onChange={(e) => updateEditQuestionTestCase(idx, 'expectedOutput', e.target.value)}
                            placeholder="Expected Output"
                            required
                          />
                          {editQuestionForm.testCases.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => removeEditQuestionTestCase(idx)}
                              className="remove-btn"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="modal-actions">
                      <button type="button" onClick={() => setEditingQuestion(null)} className="cancel-btn">
                        Cancel
                      </button>
                      <button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submissions Tab */}
        {activeTab === 'submissions' && (
          <div className="tab-content">
            <section className="list-section">
              <div className="section-header">
                <h2>All Submissions ({filteredSubmissions.length})</h2>
                <div className="section-actions">
                  <input
                    type="text"
                    placeholder="Search submissions..."
                    value={submissionSearch}
                    onChange={(e) => setSubmissionSearch(e.target.value)}
                    className="search-input"
                  />
                  <select
                    value={submissionFilter}
                    onChange={(e) => setSubmissionFilter(e.target.value as 'all' | 'passed' | 'failed')}
                    className="filter-select"
                  >
                    <option value="all">All Status</option>
                    <option value="passed">All Passed</option>
                    <option value="failed">Partial/Failed</option>
                  </select>
                  <button onClick={downloadSubmissionsCSV} className="download-btn" disabled={submissions.length === 0}>
                    📥 Download CSV
                  </button>
                  <button onClick={handleDeleteAllSubmissions} className="delete-all-btn" disabled={submissions.length === 0}>
                    🗑️ Delete All
                  </button>
                </div>
              </div>
              <div className="submissions-table">
                <table>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>GMID</th>
                      <th>Question</th>
                      <th>Language</th>
                      <th>Status</th>
                      <th>Test Cases</th>
                      <th>Submitted At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((sub) => {
                      const langNames: Record<number, string> = { 71: 'Python 3', 62: 'Java', 54: 'C++', 50: 'C' };
                      return (
                        <tr key={sub._id} className={sub.passed ? 'row-passed' : 'row-failed'}>
                          <td>{sub.teamName}</td>
                          <td>{sub.gmid}</td>
                          <td>{sub.questionId?.title || 'Unknown'}</td>
                          <td>{langNames[sub.languageId] || `Lang ${sub.languageId}`}</td>
                          <td>
                            <span className={`status-pill ${sub.passed ? 'status-passed' : 'status-partial'}`}>
                              {sub.passed ? '✓ All Passed' : '⚠ Partial'}
                            </span>
                          </td>
                          <td>{sub.passedTestCases || 0}/{sub.totalTestCases || 0}</td>
                          <td>{new Date(sub.submittedAt).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="tab-content">
            <section className="form-section">
              <h2>Event Settings</h2>
              <p className="settings-info">These settings apply to all teams during the event.</p>
              <div className="admin-form">
                <div className="form-row">
                  <div className="input-group">
                    <label>Shuffle Time (seconds)</label>
                    <input
                      type="number"
                      value={shuffleTime}
                      onChange={(e) => setShuffleTime(parseInt(e.target.value) || 60)}
                      min={10}
                      max={600}
                    />
                    <span className="input-hint">Time before code is shuffled to next teammate (10-600 seconds)</span>
                  </div>
                </div>
                <div className="form-row">
                  <div className="input-group">
                    <label>Event Duration (seconds)</label>
                    <input
                      type="number"
                      value={eventDuration}
                      onChange={(e) => setEventDuration(parseInt(e.target.value) || 300)}
                      min={60}
                      max={3600}
                    />
                    <span className="input-hint">Total time for the event from when first member starts (60-3600 seconds)</span>
                  </div>
                </div>
                <button onClick={handleSaveSettings} disabled={loading} className="save-settings-btn">
                  {loading ? 'Saving...' : settingsSaved ? '✓ Saved!' : 'Save Settings'}
                </button>
              </div>
            </section>

            <section className="form-section">
              <h2>Current Settings Summary</h2>
              <div className="settings-summary">
                <div className="setting-item">
                  <span className="setting-label">Shuffle Time:</span>
                  <span className="setting-value">{shuffleTime} seconds ({Math.floor(shuffleTime / 60)}m {shuffleTime % 60}s)</span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Event Duration:</span>
                  <span className="setting-value">{eventDuration} seconds ({Math.floor(eventDuration / 60)}m {eventDuration % 60}s)</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
