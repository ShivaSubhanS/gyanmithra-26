import { useState } from 'react';
import api from '../api';
import './Login.css';

interface LoginProps {
  onLogin: (teamName: string, gmid: string) => void;
  onAdminLogin: () => void;
}

export default function Login({ onLogin, onAdminLogin }: LoginProps) {
  const [teamName, setTeamName] = useState('');
  const [gmid, setGmid] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.student.login(teamName, gmid);
      
      if (result.error) {
        console.log("Login error:", result.error);
        setError(result.error);
      } else {
        console.log("Login successful:", result);
        onLogin(teamName, gmid);
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Brainwave Buzzer</h1>
          <p>Collaborative Coding Challenge</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="teamName">Team Name</label>
            <input
              type="text"
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter your team name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="gmid">GMID</label>
            <input
              type="text"
              id="gmid"
              value={gmid}
              onChange={(e) => setGmid(e.target.value)}
              placeholder="Enter your GMID"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Start Coding'}
          </button>
        </form>

        <div className="admin-link">
          <button onClick={onAdminLogin} className="admin-btn">
            Admin Panel →
          </button>
        </div>
      </div>
    </div>
  );
}
