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

// Language options with default templates
const LANGUAGES = [
  { 
    id: 71, 
    name: 'Python 3', 
    monaco: 'python',
    template: '# Write your Python code here\n\ndef main():\n    # Your code goes here\n    pass\n\nif __name__ == "__main__":\n    main()'
  },
  { 
    id: 62, 
    name: 'Java', 
    monaco: 'java',
    template: '// Write your Java code here\n\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        // Your code goes here\n        \n    }\n}'
  },
  { 
    id: 54, 
    name: 'C++', 
    monaco: 'cpp',
    template: '// Write your C++ code here\n\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code goes here\n    \n    return 0;\n}'
  },
  { 
    id: 50, 
    name: 'C', 
    monaco: 'c',
    template: '// Write your C code here\n\n#include <stdio.h>\n\nint main() {\n    // Your code goes here\n    \n    return 0;\n}'
  }
];

export default function CodingEnvironment({ teamName, gmid, onLogout }: CodingEnvironmentProps) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState('');
  const [codeByLanguage, setCodeByLanguage] = useState<Record<number, string>>({});
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
  const languageIdRef = useRef(languageId);

  // Keep code ref updated
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // Keep languageId ref updated
  useEffect(() => {
    languageIdRef.current = languageId;
  }, [languageId]);

  // Sync code changes to codeByLanguage for current language
  useEffect(() => {
    if (code !== undefined && languageId) {
      setCodeByLanguage(prev => ({
        ...prev,
        [languageId]: code
      }));
    }
  }, [code, languageId]);

  // Handle language change - save current code and load code for new language
  const handleLanguageChange = (newLanguageId: number) => {
    // Save current code for current language (already done by effect above)
    
    // Load code for new language or use template
    const newCode = codeByLanguage[newLanguageId] || 
                    LANGUAGES.find(l => l.id === newLanguageId)?.template || '';
    
    // Switch to new language
    setLanguageId(newLanguageId);
    setCode(newCode);
  };

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
      
      // Load code by language from server
      const receivedCodeByLang = result.codeByLanguage || {};
      setCodeByLanguage(receivedCodeByLang);
      
      // Set current language and its code
      const currentLangId = result.languageId || 71;
      setLanguageId(currentLangId);
      
      // Get code for current language or use template
      const currentCode = receivedCodeByLang[currentLangId] || 
                          LANGUAGES.find(l => l.id === currentLangId)?.template || '';
      setCode(currentCode);
      
      setCompleted(result.completed);
      setCurrentRound(result.currentRound);
      setSessionStarted(true);
      
      // Set shuffle time and event duration from server
      const sTime = result.shuffleTime || 60;
      const eDuration = result.eventDuration || 300;
      setShuffleTime(sTime);
      setEventDuration(eDuration);

      // Use server-calculated remaining times for consistency across team members
      // This ensures all team members see the exact same countdown regardless of when they log in
      if (result.remainingShuffleTime !== undefined) {
        setTimeLeft(result.remainingShuffleTime);
      } else if (result.roundStartTime) {
        // Fallback to client calculation if server doesn't provide remainingShuffleTime
        const elapsed = Math.floor((Date.now() - new Date(result.roundStartTime).getTime()) / 1000);
        const remaining = Math.max(0, sTime - elapsed);
        setTimeLeft(remaining);
      } else {
        setTimeLeft(sTime);
      }
      
      // Use server-calculated remaining event time for consistency across team members
      if (result.remainingEventTime !== undefined) {
        setEventTimeLeft(result.remainingEventTime);
        if (result.remainingEventTime <= 0) {
          setEventExpired(true);
        }
      } else if (result.eventStartTime) {
        // Fallback to client calculation if server doesn't provide remainingEventTime
        const eventElapsed = Math.floor((Date.now() - new Date(result.eventStartTime).getTime()) / 1000);
        const eventRemaining = Math.max(0, eDuration - eventElapsed);
        setEventTimeLeft(eventRemaining);
        
        if (eventRemaining <= 0) {
          setEventExpired(true);
        }
      } else {
        // Don't set event time if session hasn't truly started yet
        setEventTimeLeft(null);
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
        await api.student.saveCode(teamName, gmid, codeRef.current, languageIdRef.current);
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
      await api.student.saveCode(teamName, gmid, codeRef.current, languageIdRef.current);
      // Mark event as expired
      await api.student.eventExpired(teamName, gmid);
      setEventExpired(true);
    } catch (error) {
      console.error('Event end failed:', error);
    }
  };

  // Handle timer end - trigger shuffle
  const handleTimerEnd = async () => {
    setShuffling(true);
    
    try {
      // Save current code and language first
      await api.student.saveCode(teamName, gmid, codeRef.current, languageIdRef.current);
      
      // Trigger shuffle
      await api.student.shuffle(teamName);
      
      // Wait a moment for shuffle to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fetch new state
      const state = await api.student.getState(teamName, gmid);
      
      if (state.success) {
        setQuestion(state.question);
        
        // Load code by language from server
        const receivedCodeByLang = state.codeByLanguage || {};
        setCodeByLanguage(receivedCodeByLang);
        
        // Set current language and its code
        const currentLangId = state.languageId || 71;
        setLanguageId(currentLangId);
        
        // Get code for current language or use template
        const currentCode = receivedCodeByLang[currentLangId] || 
                            LANGUAGES.find(l => l.id === currentLangId)?.template || '';
        setCode(currentCode);
        
        setCompleted(state.completed);
        setCurrentRound(state.currentRound);
        setAllCompleted(state.allCompleted);
        
        // Use server-calculated remaining time for consistency across team members
        if (state.remainingShuffleTime !== undefined) {
          setTimeLeft(state.remainingShuffleTime);
        } else {
          setTimeLeft(state.shuffleTime || shuffleTime);
        }
        
        // Also update event timer with server-calculated time
        if (state.remainingEventTime !== undefined) {
          setEventTimeLeft(state.remainingEventTime);
        }
        
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
          
          // Load code by language from server
          const receivedCodeByLang = state.codeByLanguage || {};
          setCodeByLanguage(receivedCodeByLang);
          
          // Set current language and its code
          const currentLangId = state.languageId || 71;
          setLanguageId(currentLangId);
          
          // Get code for current language or use template
          const currentCode = receivedCodeByLang[currentLangId] || 
                              LANGUAGES.find(l => l.id === currentLangId)?.template || '';
          setCode(currentCode);
          
          setCompleted(state.completed);
          setCurrentRound(state.currentRound);
          
          // Use server-calculated remaining time for consistency across team members
          if (state.remainingShuffleTime !== undefined) {
            setTimeLeft(state.remainingShuffleTime);
          } else if (state.roundStartTime) {
            // Fallback to client calculation if server doesn't provide remainingShuffleTime
            const sTime = state.shuffleTime || shuffleTime;
            const elapsed = Math.floor((Date.now() - new Date(state.roundStartTime).getTime()) / 1000);
            const remaining = Math.max(0, sTime - elapsed);
            setTimeLeft(remaining);
          }
          
          // Also update event timer with server-calculated time
          if (state.remainingEventTime !== undefined) {
            setEventTimeLeft(state.remainingEventTime);
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
      // Save code and language first
      await api.student.saveCode(teamName, gmid, code, languageId);
      
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
          <div className="welcome-info">
            <p className="player-info">Player: <strong>{gmid}</strong></p>
            <p className="team-info">Team: <strong>{teamName}</strong></p>
          </div>
          
          <div className="instructions">
            <h2>Challenge Rules & Instructions</h2>
            
            <div className="instruction-section">
              <h3>Objective</h3>
              <p>Solve coding problems as a team. Each member gets a different difficulty level:</p>
              <ul>
                <li><span className="diff-easy">Easy</span> - Member 1</li>
                <li><span className="diff-medium">Medium</span> - Member 2</li>
                <li><span className="diff-hard">Hard</span> - Member 3</li>
              </ul>
            </div>

            <div className="instruction-section">
              <h3>Time Limits</h3>
              <ul>
                <li><strong>Shuffle Timer:</strong> {shuffleTime} seconds - Complete your problem or code shuffles to next teammate</li>
                <li><strong>Event Timer:</strong> {Math.floor(eventDuration / 60)} minutes total - Complete all challenges before time runs out</li>
              </ul>
            </div>

            <div className="instruction-section">
              <h3>Coding Guidelines</h3>
              <ul>
                <li>Choose from <strong>4 languages:</strong> Python 3, Java, C++, C</li>
                <li>Each language has its own code editor - switch anytime!</li>
              </ul>
            </div>

            <div className="instruction-section">
              <h3>Code Shuffle</h3>
              <ul>
                <li>Happens automatically when shuffle timer hits 0</li>
                <li>Your code rotates to the next team member</li>
                <li>Continue where they left off or start fresh</li>
                <li>Code shuffle stops for a member if all test cases are passed</li>
              </ul>
            </div>

            <div className="instruction-section">
              <h3>Test Cases</h3>
              <ul>
                <li>Only <strong>first test case</strong> is visible (sample)</li>
                <li>Hidden test cases verify your solution</li>
                <li>Must pass <strong>ALL</strong> test cases to complete</li>
                <li>Full results shown after event ends</li>
              </ul>
            </div>

            <div className="instruction-section warning">
              <h3>Important Notes</h3>
              <ul>
                <li>Timers start when <strong>first team member</strong> clicks Start</li>
                <li>All 3 members must complete for team victory</li>
                <li>Work together, communicate, and help each other!</li>
              </ul>
            </div>
          </div>

          <div className="start-actions">
            <button onClick={startSession} className="start-btn" disabled={loading}>
              {loading ? 'Starting...' : ' Start Challenge'}
            </button>
            <button onClick={onLogout} className="logout-btn">
              ← Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (eventExpired) {
    return (
      <div className="coding-env">
        <div className="completion-screen expired">
          <h1> Event Time Expired!</h1>
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
          <h1> Team Challenge Complete!</h1>
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
            <div className="question-title-row">
              <h2>{question?.title || 'Loading...'}</h2>
              {question?.difficulty && (
                <span className={`difficulty-badge ${question.difficulty}`}>
                  {question.difficulty.toUpperCase()}
                </span>
              )}
            </div>
            <div className="question-description">
              <pre>{question?.description}</pre>
            </div>
            
            <div className="test-cases-preview">
              <h3>Sample Test Case:</h3>
              {question?.testCases.slice(0, 1).map((tc, idx) => (
                <div key={idx} className="test-case-preview">
                  <div><strong>Input:</strong> <code>{tc.input}</code></div>
                  <div><strong>Expected Output:</strong> <code>{tc.expectedOutput}</code></div>
                </div>
              ))}
              <p className="hidden-tests-note">
                💡 Note: There are {question?.testCases.length || 0} total test cases. 
                Only the first one is visible. Others are hidden.
              </p>
            </div>
          </div>

          {showResults && (
            <div className="results-panel">
              <h3>Test Results</h3>
              
              {/* Summary stats */}
              {results.length > 0 && (
                <div className="results-summary">
                  <div className="summary-stat">
                    <strong>Passed:</strong> {results.filter(r => r.passed).length} / {results.length}
                  </div>
                  {eventExpired && (
                    <div className="summary-stat score">
                      <strong>Final Score:</strong> {Math.round((results.filter(r => r.passed).length / results.length) * 100)}%
                    </div>
                  )}
                </div>
              )}
              
              <div className="results-list">
                {/* Show only first test case details during event */}
                {!eventExpired && results.slice(0, 1).map((result, idx) => (
                  <div 
                    key={idx} 
                    className={`result-item ${result.passed ? 'passed' : 'failed'}`}
                  >
                    <div className="result-header">
                      <span>Sample Test Case</span>
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
                
                {/* Show remaining hidden test results as pass/fail only during event */}
                {!eventExpired && results.length > 1 && (
                  <div className="hidden-tests-list">
                    {results.slice(1).map((result, idx) => (
                      <div 
                        key={idx + 1} 
                        className={`hidden-test-item ${result.passed ? 'passed' : 'failed'}`}
                      >
                        <span>Hidden Test Case {idx + 1}</span>
                        <span className={`result-badge ${result.passed ? 'badge-pass' : 'badge-fail'}`}>
                          {result.passed ? '✓ Passed' : '✗ Incorrect'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Show all test case details after event expires */}
                {eventExpired && results.map((result, idx) => (
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
              onChange={(e) => handleLanguageChange(parseInt(e.target.value))}
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
