// API configuration
const API_BASE_URL = `http://${window.location.hostname}:5000/api`;

export const api = {
  // Admin endpoints
  admin: {
    registerTeam: async (teamName: string, gmid1: string, gmid2: string, gmid3: string, adminSecret: string, shuffleTime?: number, eventDuration?: number) => {
      const response = await fetch(`${API_BASE_URL}/admin/register-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, gmid1, gmid2, gmid3, adminSecret, shuffleTime, eventDuration })
      });
      return response.json();
    },

    addQuestion: async (question: {
      title: string;
      description: string;
      difficulty?: string;
      testCases: { input: string; expectedOutput: string }[];
    }, adminSecret: string) => {
      const response = await fetch(`${API_BASE_URL}/admin/add-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...question, adminSecret })
      });
      return response.json();
    },

    getQuestions: async () => {
      const response = await fetch(`${API_BASE_URL}/admin/questions`);
      return response.json();
    },

    deleteQuestion: async (id: string, adminSecret: string) => {
      const response = await fetch(`${API_BASE_URL}/admin/questions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSecret })
      });
      return response.json();
    },

    editQuestion: async (id: string, question: {
      title?: string;
      description?: string;
      difficulty?: string;
      testCases?: { input: string; expectedOutput: string }[];
    }, adminSecret: string) => {
      const response = await fetch(`${API_BASE_URL}/admin/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...question, adminSecret })
      });
      return response.json();
    },

    deleteAllQuestions: async (adminSecret: string) => {
      const response = await fetch(`${API_BASE_URL}/admin/all-questions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSecret })
      });
      return response.json();
    },

    getTeams: async () => {
      const response = await fetch(`${API_BASE_URL}/admin/teams`);
      return response.json();
    },

    getSubmissions: async () => {
      const response = await fetch(`${API_BASE_URL}/admin/submissions`);
      return response.json();
    },

    deleteAllSubmissions: async (adminSecret: string) => {
      const response = await fetch(`${API_BASE_URL}/admin/submissions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSecret })
      });
      return response.json();
    },

    deleteTeam: async (teamName: string, adminSecret: string) => {
      const response = await fetch(`${API_BASE_URL}/admin/teams/${teamName}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSecret })
      });
      return response.json();
    },

    deleteAllTeams: async (adminSecret: string) => {
      const response = await fetch(`${API_BASE_URL}/admin/teams`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSecret })
      });
      return response.json();
    },

    updateTeam: async (teamName: string, data: { newTeamName?: string; gmid1?: string; gmid2?: string; gmid3?: string }, adminSecret: string) => {
      const response = await fetch(`${API_BASE_URL}/admin/teams/${teamName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, adminSecret })
      });
      return response.json();
    },

    getSettings: async () => {
      const response = await fetch(`${API_BASE_URL}/admin/settings`);
      return response.json();
    },

    saveSettings: async (shuffleTime: number, eventDuration: number, adminSecret: string) => {
      const response = await fetch(`${API_BASE_URL}/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shuffleTime, eventDuration, adminSecret })
      });
      return response.json();
    },

    resetTeam: async (teamName: string, adminSecret: string) => {
      const response = await fetch(`${API_BASE_URL}/admin/reset-team/${teamName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSecret })
      });
      return response.json();
    }
  },

  // Student endpoints
  student: {
    login: async (teamName: string, gmid: string) => {
      const response = await fetch(`${API_BASE_URL}/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, gmid })
      });
      return response.json();
    },

    startSession: async (teamName: string, gmid: string) => {
      const response = await fetch(`${API_BASE_URL}/student/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, gmid })
      });
      return response.json();
    },

    getState: async (teamName: string, gmid: string) => {
      const response = await fetch(`${API_BASE_URL}/student/get-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, gmid })
      });
      return response.json();
    },

    saveCode: async (teamName: string, gmid: string, code: string, languageId?: number) => {
      const response = await fetch(`${API_BASE_URL}/student/save-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, gmid, code, languageId })
      });
      return response.json();
    },

    shuffle: async (teamName: string) => {
      const response = await fetch(`${API_BASE_URL}/student/shuffle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName })
      });
      return response.json();
    },

    runCode: async (teamName: string, gmid: string, code: string, languageId?: number) => {
      const response = await fetch(`${API_BASE_URL}/student/run-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, gmid, code, languageId })
      });
      return response.json();
    },

    checkShuffle: async (teamName: string, gmid: string, clientRound: number) => {
      const response = await fetch(`${API_BASE_URL}/student/check-shuffle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, gmid, clientRound })
      });
      return response.json();
    },

    eventExpired: async (teamName: string, gmid: string) => {
      const response = await fetch(`${API_BASE_URL}/student/event-expired`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, gmid })
      });
      return response.json();
    }
  }
};

export default api;
