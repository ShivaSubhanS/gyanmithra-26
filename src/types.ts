export interface TestCase {
  input: string;
  expectedOutput: string;
}

export interface Question {
  _id: string;
  title: string;
  description: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  testCases: TestCase[];
  createdAt: string;
}

export interface TeamMember {
  gmid: string;
  questionId: Question | null;
  code: string;
  completed: boolean;
  lastUpdated: string;
}

export interface Team {
  _id: string;
  teamName: string;
  members: TeamMember[];
  currentRound: number;
  roundStartTime: string | null;
  isActive: boolean;
  completedAt: string | null;
  createdAt: string;
}

export interface Submission {
  _id: string;
  teamName: string;
  gmid: string;
  questionId: Question;
  code: string;
  languageId: number;
  passed: boolean;
  totalTestCases: number;
  passedTestCases: number;
  submittedAt: string;
}

export interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  status: string;
  time?: string;
  memory?: number;
}

export interface UserSession {
  teamName: string;
  gmid: string;
  memberIndex: number;
}
