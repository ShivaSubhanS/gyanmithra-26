import { useState } from 'react';
import Login from './components/Login';
import CodingEnvironment from './components/CodingEnvironment';
import AdminPanel from './components/AdminPanel';
import './App.css';

type View = 'login' | 'coding' | 'admin';

function App() {
  const [view, setView] = useState<View>('login');
  const [session, setSession] = useState<{ teamName: string; gmid: string } | null>(null);

  const handleLogin = (teamName: string, gmid: string) => {
    setSession({ teamName, gmid });
    setView('coding');
  };

  const handleLogout = () => {
    setSession(null);
    setView('login');
  };

  const handleAdminLogin = () => {
    setView('admin');
  };

  const handleBackFromAdmin = () => {
    setView('login');
  };

  return (
    <div className="app">
      {view === 'login' && (
        <Login onLogin={handleLogin} onAdminLogin={handleAdminLogin} />
      )}
      
      {view === 'coding' && session && (
        <CodingEnvironment
          teamName={session.teamName}
          gmid={session.gmid}
          onLogout={handleLogout}
        />
      )}
      
      {view === 'admin' && (
        <AdminPanel onBack={handleBackFromAdmin} />
      )}
    </div>
  );
}

export default App;
