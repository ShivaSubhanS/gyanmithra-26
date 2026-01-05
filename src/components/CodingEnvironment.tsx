import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import '../monaco.setup'; // Import Monaco setup for LAN compatibility
import api from '../api';
import type { Question, TestResult } from '../types';
import './CodingEnvironment.css';

interface CodingEnvironmentProps {
  teamName: string;
  gmid: string;
  onLogout: () => void;
}

// Language options (without JavaScript)
const LANGUAGES = [
  { id: 71, name: 'Python 3', monaco: 'python' },
  { id: 62, name: 'Java', monaco: 'java' },
  { id: 54, name: 'C++', monaco: 'cpp' },
  { id: 50, name: 'C', monaco: 'c' }
];

export default function CodingEnvironment({ teamName, gmid, onLogout }: CodingEnvironmentProps) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState('');
  const [languageId, setLanguageId] = useState(71); // Default to Python 3
  const [timeLeft, setTimeLeft] = useState(60);
  const [eventTimeLeft, setEventTimeLeft] = useState<number | null>(null);
  const [shuffleTime, setShuffleTime] = useState(60);
  const [eventDuration, setEventDuration] = useState(300);
  const [currentRound, setCurrentRound] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [allCompleted, setAllCompleted] = useState(false);
  const [eventExpired, setEventExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [shuffling, setShuffling] = useState(false);

  const timerRef = useRef<number | null>(null);
  const eventTimerRef = useRef<number | null>(null);
  const autoSaveRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const codeRef = useRef(code);

  // Keep code ref updated
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await api.admin.getSettings();
        if (settings.shuffleTime) setShuffleTime(settings.shuffleTime);
        if (settings.eventDuration) setEventDuration(settings.eventDuration);
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);

  // Start or resume session
  const startSession = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.student.startSession(teamName, gmid);
      
      if (result.error) {
        alert(result.error);
        return;
      }

      setQuestion(result.question);
      setCode(result.code || '');
      setCompleted(result.completed);
      setCurrentRound(result.currentRound);
      setSessionStarted(true);
      
      // Set shuffle time and event duration from server
      const sTime = result.shuffleTime || 60;
      const eDuration = result.eventDuration || 300;
      setShuffleTime(sTime);
      setEventDuration(eDuration);

      // Calculate remaining shuffle time from roundStartTime
      if (result.roundStartTime) {
        const elapsed = Math.floor((Date.now() - new Date(result.roundStartTime).getTime()) / 1000);
        const remaining = Math.max(0, sTime - elapsed);
        setTimeLeft(remaining);
      } else {
        setTimeLeft(sTime);
      }
      
      // Calculate remaining event time from eventStartTime
      if (result.eventStartTime) {
        const eventElapsed = Math.floor((Date.now() - new Date(result.eventStartTime).getTime()) / 1000);
        const eventRemaining = Math.max(0, eDuration - eventElapsed);
        setEventTimeLeft(eventRemaining);
        
        if (eventRemaining <= 0) {
          setEventExpired(true);
        }
      } else {
        setEventTimeLeft(eDuration);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Failed to start session');
    } finally {
      setLoading(false);
    }
  }, [teamName, gmid]);

  // Auto-save code every 10 seconds
  useEffect(() => {
    if (!sessionStarted || completed || eventExpired) return;

    autoSaveRef.current = window.setInterval(async () => {
      try {
        await api.student.saveCode(teamName, gmid, codeRef.current);
        console.log('Code auto-saved');
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 10000);

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, [sessionStarted, completed, eventExpired, teamName, gmid]);

  // Shuffle Timer countdown
  useEffect(() => {
    if (!sessionStarted || completed || allCompleted || eventExpired) return;

    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - trigger shuffle
          handleTimerEnd();
          return shuffleTime;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionStarted, completed, allCompleted, eventExpired, shuffleTime]);

  // Event Timer countdown
  useEffect(() => {
    if (!sessionStarted || allCompleted || eventExpired || eventTimeLeft === null) return;

    eventTimerRef.current = window.setInterval(() => {
      setEventTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          // Event time's up - save and end
          handleEventEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (eventTimerRef.current) {
        clearInterval(eventTimerRef.current);
      }
    };
  }, [sessionStarted, allCompleted, eventExpired, eventTimeLeft]);

  // Handle event end - save code and mark as expired
  const handleEventEnd = async () => {
    try {
      // Save code before ending
      await api.student.saveCode(teamName, gmid, codeRef.current);
      // Mark event as expired
      await api.student.eventExpired(teamName, gmid, codeRef.current);
      setEventExpired(true);
    } catch (error) {
      console.error('Event end failed:', error);
    }
  };

  // Handle timer end - trigger shuffle
  const handleTimerEnd = async () => {
    setShuffling(true);
    
    try {
      // Save current code first
      await api.student.saveCode(teamName, gmid, codeRef.current);
      
      // Trigger shuffle
      await api.student.shuffle(teamName);
      
      // Wait a moment for shuffle to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fetch new state
      const state = await api.student.getState(teamName, gmid);
      
      if (state.success) {
        setQuestion(state.question);
        setCode(state.code || '');
        setCompleted(state.completed);
        setCurrentRound(state.currentRound);
        setAllCompleted(state.allCompleted);
        setTimeLeft(state.shuffleTime || shuffleTime);
        setResults([]);
        setShowResults(false);
      }
    } catch (error) {
      console.error('Shuffle failed:', error);
    } finally {
      setShuffling(false);
    }
  };

  // Poll for state changes (in case another team member triggers shuffle)
  useEffect(() => {
    if (!sessionStarted || completed || allCompleted || eventExpired) return;

    pollRef.current = window.setInterval(async () => {
      try {
        const state = await api.student.checkShuffle(teamName, gmid, currentRound);
        
        if (state.shuffleHappened) {
          setQuestion(state.question);
          setCode(state.code || '');
          setCompleted(state.completed);
          setCurrentRound(state.currentRound);
          
          // Recalculate time
          if (state.roundStartTime) {
            const sTime = state.shuffleTime || shuffleTime;
            const elapsed = Math.floor((Date.now() - new Date(state.roundStartTime).getTime()) / 1000);
            const remaining = Math.max(0, sTime - elapsed);
            setTimeLeft(remaining);
          }
        }
      } catch (error) {
        console.error('Poll failed:', error);
      }
    }, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [sessionStarted, completed, allCompleted, eventExpired, currentRound, teamName, gmid, shuffleTime]);

  // Run code
  const handleRunCode = async () => {
    if (running || !question || eventExpired) return;
    
    setRunning(true);
    setShowResults(true);
    setResults([]);

    try {
      // Save code first
      await api.student.saveCode(teamName, gmid, code);
      
      // Run code with selected language
      const result = await api.student.runCode(teamName, gmid, code, languageId);
      
      if (result.error) {
        setResults([{
          input: '',
          expectedOutput: '',
          actualOutput: result.error,
          passed: false,
          status: 'Error'
        }]);
      } else {
        setResults(result.results);
        
        if (result.allPassed) {
          setCompleted(true);
          setAllCompleted(result.allTeamCompleted);
        }
      }
    } catch (error) {
      console.error('Run failed:', error);
      setResults([{
        input: '',
        expectedOutput: '',
        actualOutput: 'Failed to connect to server',
        passed: false,
        status: 'Error'
      }]);
    } finally {
      setRunning(false);
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="coding-env">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!sessionStarted) {
    return (
      <div className="coding-env">
        <div className="start-screen">
          <h1>Brainwave Buzzer</h1>
          <p>Welcome, {gmid}!</p>
          <p>Team: {teamName}</p>
          <p className="instructions">
            You will be given a coding challenge. Complete it within {shuffleTime} seconds, 
            or your code will be shuffled to a teammate!
          </p>
          <button onClick={startSession} className="start-btn">
            Start Challenge
          </button>
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (eventExpired) {
    return (
      <div className="coding-env">
        <div className="completion-screen expired">
          <h1>⏰ Event Time Expired!</h1>
          <p>The event time has ended. Your code has been saved.</p>
          <button onClick={onLogout} className="logout-btn">
            Exit
          </button>
        </div>
      </div>
    );
  }

  if (allCompleted) {
    return (
      <div className="coding-env">
        <div className="completion-screen">
          <h1>🎉 Team Challenge Complete!</h1>
          <p>All team members have successfully completed their challenges!</p>
          <button onClick={onLogout} className="logout-btn">
            Exit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="coding-env">
      {shuffling && (
        <div className="shuffle-overlay">
          <div className="shuffle-content">
            <div className="shuffle-spinner"></div>
            <p>Shuffling code to teammates...</p>
          </div>
        </div>
      )}

      <header className="coding-header">
        <div className="header-left">
          <h1>Brainwave Buzzer</h1>
          <span className="team-info">{teamName} | {gmid}</span>
        </div>
        <div className="header-right">
          <div className="timer-group">
            <div className={`timer shuffle-timer ${timeLeft <= 10 ? 'timer-warning' : ''}`}>
              <span className="timer-label">Shuffle</span>
              <span className="timer-value">⏱️ {formatTime(timeLeft)}</span>
            </div>
            {eventTimeLeft !== null && (
              <div className={`timer event-timer ${eventTimeLeft <= 60 ? 'timer-warning' : ''}`}>
                <span className="timer-label">Event</span>
                <span className="timer-value">🏁 {formatTime(eventTimeLeft)}</span>
              </div>
            )}
          </div>
          {completed && <span className="completed-badge">✓ Completed</span>}
          <button onClick={onLogout} className="header-logout">
            Logout
          </button>
        </div>
      </header>

      <main className="coding-main">
        <aside className="left-panel">
          <div className="question-panel">
            <h2>{question?.title || 'Loading...'}</h2>
            <div className="question-description">
              <pre>{question?.description}</pre>
            </div>
            
            <div className="test-cases-preview">
              <h3>Sample Test Cases:</h3>
              {question?.testCases.slice(0, 2).map((tc, idx) => (
                <div key={idx} className="test-case-preview">
                  <div><strong>Input:</strong> <code>{tc.input}</code></div>
                  <div><strong>Expected:</strong> <code>{tc.expectedOutput}</code></div>
                </div>
              ))}
            </div>
          </div>

          {showResults && (
            <div className="results-panel">
              <h3>Test Results</h3>
              <div className="results-list">
                {results.map((result, idx) => (
                  <div 
                    key={idx} 
                    className={`result-item ${result.passed ? 'passed' : 'failed'}`}
                  >
                    <div className="result-header">
                      <span>Test Case {idx + 1}</span>
                      <span className={`result-badge ${result.passed ? 'badge-pass' : 'badge-fail'}`}>
                        {result.passed ? '✓ Passed' : '✗ Failed'}
                      </span>
                    </div>
                    <div className="result-details">
                      <div><strong>Input:</strong> <code>{result.input}</code></div>
                      <div><strong>Expected:</strong> <code>{result.expectedOutput}</code></div>
                      <div><strong>Output:</strong> <code>{result.actualOutput}</code></div>
                      {result.status && <div><strong>Status:</strong> {result.status}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className="editor-panel">
          <div className="editor-toolbar">
            <select
              value={languageId}
              onChange={(e) => setLanguageId(parseInt(e.target.value))}
              className="language-select"
              disabled={completed || eventExpired}
            >
              {LANGUAGES.map(lang => (
                <option key={lang.id} value={lang.id}>{lang.name}</option>
              ))}
            </select>
          </div>
          <div className="editor-container">
            <Editor
              height="100%"
              language={LANGUAGES.find(l => l.id === languageId)?.monaco || 'python'}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: completed || eventExpired,
                automaticLayout: true,
              }}
            />
          </div>

          <div className="editor-footer">
            <button 
              onClick={handleRunCode} 
              className="run-btn"
              disabled={running || completed || eventExpired}
            >
              {running ? '⏳ Running...' : '▶ Run Code'}
            </button>
            
            {completed && (
              <span className="success-message">
                ✓ All test cases passed! Waiting for teammates...
              </span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
