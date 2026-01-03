# 🧠 Brainwave Buzzer

A collaborative coding challenge platform where teams of 3 compete by solving coding problems with a twist - code gets shuffled between teammates every 60 seconds!

## Features

### Admin Features
- Register teams with 3 GMIDs each
- Add coding questions with multiple test cases
- View all teams and their progress
- View successful submissions
- Reset teams for new rounds

### Student Features
- Login with team name and GMID
- Get assigned a random coding question
- Monaco editor for writing code
- 60-second timer per round
- Auto-save code every 10 seconds
- Code shuffle between incomplete team members after each round
- Run code against Judge0 to check test cases

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Editor**: Monaco Editor
- **Backend**: Node.js + Express
- **Database**: MongoDB
- **Code Execution**: Judge0 (self-hosted)

## Project Structure

```
brainwave_buzzer/
├── src/                    # Frontend React application
│   ├── components/
│   │   ├── Login.tsx       # Student login page
│   │   ├── CodingEnvironment.tsx  # Main coding interface
│   │   └── AdminPanel.tsx  # Admin dashboard
│   ├── api.ts              # API client
│   ├── types.ts            # TypeScript interfaces
│   └── App.tsx             # Main app component
├── server/                 # Backend Express server
│   ├── index.js            # Main server file with all routes
│   ├── models.js           # MongoDB schemas
│   ├── .env                # Environment variables
│   └── package.json
└── package.json            # Frontend dependencies
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB running locally or remote
- Judge0 self-hosted on a Linux machine

### 1. Setup Judge0 (on Linux machine)

```bash
# Clone Judge0
git clone https://github.com/judge0/judge0.git
cd judge0

# Start Judge0 using Docker
docker-compose up -d

# Judge0 will be available at http://YOUR_LINUX_IP:2358
```

### 2. Setup MongoDB

Make sure MongoDB is running. You can use:
- Local MongoDB: `mongodb://localhost:27017/brainwave_buzzer`
- MongoDB Atlas (cloud)

### 3. Setup Backend Server

```bash
cd server
npm install

# Edit .env file with your configurations:
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/brainwave_buzzer
# JUDGE0_API_URL=http://YOUR_LINUX_MACHINE_IP:2358
# ADMIN_SECRET=your_admin_password

npm run dev
```

### 4. Setup Frontend

```bash
# In the root directory
npm install
npm run dev
```

### 5. Configure API URL

If your backend is not running on `localhost:5000`, update the `API_BASE_URL` in `src/api.ts`.

## Usage

### Admin Flow

1. Go to the app and click "Admin Panel"
2. Enter admin secret (default: `admin123`)
3. **Register Teams**: Add team name and 3 GMIDs
4. **Add Questions**: Create questions with title, description, and test cases
5. **Monitor**: View team progress and submissions

### Student Flow

1. Login with team name and GMID
2. Click "Start Challenge" to begin
3. A random question is assigned to each team member
4. Write code in the Monaco editor
5. Code auto-saves every 10 seconds
6. Click "Run Code" to test against all test cases
7. After 60 seconds, code shuffles to teammates (if not completed)
8. Continue coding until all test cases pass!

## How Code Shuffle Works

1. Each round lasts 60 seconds
2. When timer ends:
   - Code is saved to the database
   - Incomplete members' code/questions are rotated
   - Members who completed their question are excluded from shuffle
3. UI auto-refreshes with new code and question
4. Continue until all team members complete their questions

## API Endpoints

### Admin Routes
- `POST /api/admin/register-team` - Register new team
- `POST /api/admin/add-question` - Add new question
- `GET /api/admin/questions` - Get all questions
- `GET /api/admin/teams` - Get all teams
- `GET /api/admin/submissions` - Get successful submissions
- `POST /api/admin/reset-team/:teamName` - Reset team state

### Student Routes
- `POST /api/student/login` - Authenticate student
- `POST /api/student/start-session` - Start coding session
- `POST /api/student/get-state` - Get current state
- `POST /api/student/save-code` - Save code (auto-save)
- `POST /api/student/shuffle` - Trigger code shuffle
- `POST /api/student/run-code` - Execute code via Judge0
- `POST /api/student/check-shuffle` - Check if shuffle occurred

## Database Schema

### Questions Collection
```javascript
{
  title: String,
  description: String,
  testCases: [{ input: String, expectedOutput: String }],
  difficulty: 'easy' | 'medium' | 'hard',
  starterCode: String,
  languageId: Number
}
```

### Teams Collection
```javascript
{
  teamName: String,
  members: [{
    gmid: String,
    questionId: ObjectId,
    code: String,
    completed: Boolean
  }],
  currentRound: Number,
  roundStartTime: Date,
  isActive: Boolean
}
```

### Submissions Collection
```javascript
{
  teamName: String,
  gmid: String,
  questionId: ObjectId,
  code: String,
  passed: Boolean,
  submittedAt: Date
}
```

## Supported Languages (Judge0)

- JavaScript (Node.js) - ID: 63
- Python 3 - ID: 71
- Java - ID: 62
- C++ - ID: 54
- C - ID: 50

## License

MIT
