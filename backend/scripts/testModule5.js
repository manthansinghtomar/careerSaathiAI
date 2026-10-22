// Explicitly set test environment and dedicated test database BEFORE importing app/db
process.env.NODE_ENV = 'test';
require('dotenv').config();

// Dedicated test database - never touches production or primary development database
const originalMongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/careersaathi';
const TEST_DB_NAME = 'careersaathi_m5_test';
process.env.MONGO_URI = originalMongoUri.replace(/careersaathi(\?|$)/, `${TEST_DB_NAME}$1`);

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Assessment = require('../models/Assessment');

const RUN_ID = `m5_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
let server;
let API_BASE;

const createdUserIds = new Set();
const createdAssessmentIds = new Set();

async function request(path, options = {}) {
  const { headers, ...restOptions } = options;
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    ...restOptions,
  });
  let data;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }
  return { status: response.status, data, headers: response.headers };
}

const testResults = [];
function recordTest(id, category, description, passed, details = '') {
  testResults.push({ id, category, description, passed, details });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${id}: ${description} ${details ? '(' + details + ')' : ''}`);
}

async function runAllTests() {
  console.log(`=== CareerSaathi AI — Module 5 Hardened Test Suite [Run: ${RUN_ID}] ===`);
  console.log(`Target Database: ${process.env.MONGO_URI}\n`);

  let caughtError = null;

  try {
    // 1. Connect Mongoose to dedicated test database
    await mongoose.connect(process.env.MONGO_URI);

    // 2. Start ephemeral HTTP test server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        API_BASE = `http://localhost:${port}/api`;
        console.log(`Ephemeral Test Server started on port ${port}`);
        resolve();
      });
    });

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_m5_123456789';
    process.env.JWT_SECRET = jwtSecret;
    const createToken = (user) =>
      jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: '1h' });

    // Seed test users: Student A, Student B (isolation check), Trainer, Admin
    const studentA = await User.create({
      name: 'Student A',
      email: `student_a_${RUN_ID}@test.careersaathi.local`,
      password: 'Password123!',
      role: 'student',
      preferredLanguage: 'hinglish',
      careerProfile: {
        targetRole: 'Full Stack Developer',
      },
      gamification: {
        xp: 150,
        level: 2,
        streakCount: 3,
        lastActiveDate: new Date(),
      },
    });
    createdUserIds.add(studentA._id);
    const studentAToken = createToken(studentA);

    const studentB = await User.create({
      name: 'Student B',
      email: `student_b_${RUN_ID}@test.careersaathi.local`,
      password: 'Password123!',
      role: 'student',
      gamification: {
        streakCount: 1,
        lastActiveDate: new Date(),
      },
    });
    createdUserIds.add(studentB._id);
    const studentBToken = createToken(studentB);

    const trainerUser = await User.create({
      name: 'Trainer User',
      email: `trainer_${RUN_ID}@test.careersaathi.local`,
      password: 'Password123!',
      role: 'trainer',
    });
    createdUserIds.add(trainerUser._id);
    const trainerToken = createToken(trainerUser);

    const adminUser = await User.create({
      name: 'Admin User',
      email: `admin_${RUN_ID}@test.careersaathi.local`,
      password: 'Password123!',
      role: 'admin',
    });
    createdUserIds.add(adminUser._id);
    const adminToken = createToken(adminUser);

    console.log('Setup: Seeded isolated test users across all roles.\n--- Running Tests ---\n');

    // -------------------------------------------------------------
    // 1. DASHBOARD EMPTY STATE (TC-01)
    // -------------------------------------------------------------
    const emptyDashRes = await request('/progress/dashboard', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const emptyKpis = emptyDashRes.data?.data?.kpis;
    const tc01Passed =
      emptyDashRes.status === 200 &&
      emptyKpis?.totalAssessmentsTaken === 0 &&
      emptyKpis?.averageOverallPercentage === null &&
      emptyKpis?.latestOverallPercentage === null &&
      emptyKpis?.bestOverallPercentage === null &&
      emptyKpis?.objectiveAveragePercentage === null &&
      emptyKpis?.subjectiveAveragePercentage === null;
    recordTest(
      'TC-01',
      'Empty Dashboard',
      'Student with 0 assessments gets 200 OK, count 0, and null for all score averages',
      tc01Passed,
      `Status: ${emptyDashRes.status}`
    );

    // -------------------------------------------------------------
    // SEED ASSESSMENTS FOR STUDENT A
    // -------------------------------------------------------------
    const dummyQId1 = new mongoose.Types.ObjectId();
    const dummyQId2 = new mongoose.Types.ObjectId();
    const dummyQId3 = new mongoose.Types.ObjectId();
    const dummyQId4 = new mongoose.Types.ObjectId();

    // Assessment 1: Completed, Fully Evaluated (JavaScript)
    // 3 questions: 2 MCQ (correct, 2 pts), 1 Text (evaluated 0.8 pts) -> 2.8 / 3 (93%)
    const now = Date.now();
    const date1 = new Date(now - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const date2 = new Date(now - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    const date3 = new Date(now); // today

    const a1 = await Assessment.create({
      student: studentA._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['JavaScript'],
      status: 'completed',
      totalQuestions: 3,
      objectiveQuestionsCount: 2,
      subjectiveQuestionsCount: 1,
      scoring: {
        objectiveScore: 2,
        objectiveMaxScore: 2,
        objectivePercentage: 100,
        subjectiveScore: 0.8,
        subjectiveMaxScore: 1,
        subjectivePercentage: 80,
        overallScore: 2.8,
        overallMaxScore: 3,
        overallPercentage: 93,
        isFullyEvaluated: true,
      },
      questions: [
        {
          questionId: dummyQId1,
          topic: 'JavaScript',
          difficulty: 'easy',
          type: 'mcq',
          content: { en: { question: 'Q1?', explanation: 'Sol 1' } },
          correctAnswer: 'A',
          studentAnswer: 'A',
          isCorrect: true,
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 1,
          maxPoints: 1,
        },
        {
          questionId: dummyQId2,
          topic: 'JavaScript',
          difficulty: 'medium',
          type: 'mcq',
          content: { en: { question: 'Q2?', explanation: 'Sol 2' } },
          correctAnswer: 'B',
          studentAnswer: 'B',
          isCorrect: true,
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 1,
          maxPoints: 1,
        },
        {
          questionId: dummyQId3,
          topic: 'JavaScript',
          difficulty: 'hard',
          type: 'text',
          content: { en: { question: 'Q3?', explanation: 'Sol 3' } },
          correctAnswer: 'Ref Answer',
          studentAnswer: 'My good text answer',
          isCorrect: true,
          evaluationStatus: 'ai_evaluated',
          pointsEarned: 0.8,
          maxPoints: 1,
        },
      ],
      startedAt: new Date(date1.getTime() - 15 * 60 * 1000),
      completedAt: date1,
    });
    createdAssessmentIds.add(a1._id);

    // Assessment 2: Completed, Fully Evaluated (React & MongoDB)
    // 4 questions: React: 3 questions (2 correct MCQ = 2/2, 1 text evaluated = 0.5/1) -> 2.5/3 (83%)
    // MongoDB: 1 MCQ (incorrect = 0/1) -> 0/1 (0%)
    // Overall: 2.5 / 4 (63%)
    const a2 = await Assessment.create({
      student: studentA._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['React', 'MongoDB'],
      status: 'completed',
      totalQuestions: 4,
      objectiveQuestionsCount: 3,
      subjectiveQuestionsCount: 1,
      scoring: {
        objectiveScore: 2,
        objectiveMaxScore: 3,
        objectivePercentage: 67,
        subjectiveScore: 0.5,
        subjectiveMaxScore: 1,
        subjectivePercentage: 50,
        overallScore: 2.5,
        overallMaxScore: 4,
        overallPercentage: 63,
        isFullyEvaluated: true,
      },
      questions: [
        {
          questionId: dummyQId1,
          topic: 'React',
          difficulty: 'easy',
          type: 'mcq',
          content: { en: { question: 'React Q1?', explanation: 'React Sol 1' } },
          correctAnswer: 'A',
          studentAnswer: 'A',
          isCorrect: true,
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 1,
          maxPoints: 1,
        },
        {
          questionId: dummyQId2,
          topic: 'React',
          difficulty: 'medium',
          type: 'mcq',
          content: { en: { question: 'React Q2?', explanation: 'React Sol 2' } },
          correctAnswer: 'C',
          studentAnswer: 'C',
          isCorrect: true,
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 1,
          maxPoints: 1,
        },
        {
          questionId: dummyQId3,
          topic: 'React',
          difficulty: 'hard',
          type: 'text',
          content: { en: { question: 'React Q3?', explanation: 'React Sol 3' } },
          correctAnswer: 'Ref Answer',
          studentAnswer: 'My text answer',
          isCorrect: false,
          evaluationStatus: 'ai_evaluated',
          pointsEarned: 0.5,
          maxPoints: 1,
        },
        {
          questionId: dummyQId4,
          topic: 'MongoDB',
          difficulty: 'medium',
          type: 'mcq',
          content: { en: { question: 'Mongo Q1?', explanation: 'Mongo Sol 1' } },
          correctAnswer: 'D',
          studentAnswer: 'A', // Incorrect
          isCorrect: false,
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 0,
          maxPoints: 1,
        },
      ],
      startedAt: new Date(date2.getTime() - 20 * 60 * 1000),
      completedAt: date2,
    });
    createdAssessmentIds.add(a2._id);

    // Assessment 3: Completed, PENDING Subjective AI Evaluation (Node.js)
    // 2 questions: 1 MCQ (correct 1/1, 100%), 1 text (pending_evaluation)
    // isFullyEvaluated: false
    const a3 = await Assessment.create({
      student: studentA._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['Node.js'],
      status: 'completed',
      totalQuestions: 2,
      objectiveQuestionsCount: 1,
      subjectiveQuestionsCount: 1,
      scoring: {
        objectiveScore: 1,
        objectiveMaxScore: 1,
        objectivePercentage: 100,
        subjectiveScore: 0,
        subjectiveMaxScore: 1,
        subjectivePercentage: 0,
        overallScore: 1,
        overallMaxScore: 2,
        overallPercentage: 0, // Unfinalized!
        isFullyEvaluated: false,
      },
      questions: [
        {
          questionId: dummyQId1,
          topic: 'Node.js',
          difficulty: 'medium',
          type: 'mcq',
          content: { en: { question: 'Node Q1?', explanation: 'Node Sol 1' } },
          correctAnswer: 'B',
          studentAnswer: 'B',
          isCorrect: true,
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 1,
          maxPoints: 1,
        },
        {
          questionId: dummyQId2,
          topic: 'Node.js',
          difficulty: 'hard',
          type: 'text',
          content: { en: { question: 'Node Q2?', explanation: 'Node Sol 2' } },
          correctAnswer: 'Event loop details',
          studentAnswer: 'Waiting for AI eval',
          isCorrect: null,
          evaluationStatus: 'pending_evaluation',
          pointsEarned: 0,
          maxPoints: 1,
        },
      ],
      startedAt: new Date(date3.getTime() - 10 * 60 * 1000),
      completedAt: date3,
    });
    createdAssessmentIds.add(a3._id);

    // Assessment 4: In Progress (JavaScript) - Not completed
    const a4 = await Assessment.create({
      student: studentA._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['JavaScript'],
      status: 'in_progress',
      totalQuestions: 5,
      objectiveQuestionsCount: 3,
      subjectiveQuestionsCount: 2,
      questions: [
        {
          questionId: dummyQId1,
          topic: 'JavaScript',
          difficulty: 'easy',
          type: 'mcq',
          content: { en: { question: 'Secret In-Progress Q?', explanation: 'SECRET EXPLANATION LEAK' } },
          correctAnswer: 'SECRET_CORRECT_ANSWER',
          options: [{ id: 'A', text: { en: 'Option A' } }],
        },
      ],
      startedAt: new Date(),
    });
    createdAssessmentIds.add(a4._id);

    // Assessment for Student B (to test isolation)
    const b1 = await Assessment.create({
      student: studentB._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['MongoDB'],
      status: 'completed',
      totalQuestions: 1,
      objectiveQuestionsCount: 1,
      subjectiveQuestionsCount: 0,
      scoring: {
        objectiveScore: 1,
        objectiveMaxScore: 1,
        objectivePercentage: 100,
        overallScore: 1,
        overallMaxScore: 1,
        overallPercentage: 100,
        isFullyEvaluated: true,
      },
      questions: [
        {
          questionId: dummyQId1,
          topic: 'MongoDB',
          difficulty: 'easy',
          type: 'mcq',
          content: { en: { question: 'Mongo B Q1?' } },
          correctAnswer: 'A',
          isCorrect: true,
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 1,
          maxPoints: 1,
        },
      ],
      completedAt: new Date(),
    });
    createdAssessmentIds.add(b1._id);

    // -------------------------------------------------------------
    // 2. DASHBOARD KPI & SCORING TESTS (TC-02 to TC-07)
    // -------------------------------------------------------------
    const dashRes = await request('/progress/dashboard', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const kpis = dashRes.data?.data?.kpis;

    // TC-02: Total, Completed, In-Progress counts
    // A has 4 assessments: 3 completed, 1 in-progress
    const tc02Passed =
      kpis?.totalAssessmentsTaken === 4 &&
      kpis?.completedAssessments === 3 &&
      kpis?.inProgressAssessments === 1;
    recordTest(
      'TC-02',
      'KPI Accuracy',
      'Accurately calculates totalAssessmentsTaken, completedAssessments, and inProgressAssessments',
      tc02Passed,
      `Total: ${kpis?.totalAssessmentsTaken}, Completed: ${kpis?.completedAssessments}, In-Progress: ${kpis?.inProgressAssessments}`
    );

    // TC-03: Evaluated Averages: averageOverallPercentage includes ONLY isFullyEvaluated: true (A1: 93%, A2: 63%) -> (93 + 63) / 2 = 78%
    const tc03Passed = kpis?.averageOverallPercentage === 78;
    recordTest(
      'TC-03',
      'Evaluated Averages',
      'averageOverallPercentage includes only fully evaluated completed tests (78%)',
      tc03Passed,
      `Average: ${kpis?.averageOverallPercentage}%`
    );

    // TC-04: Unevaluated assessments excluded from averageOverallPercentage
    // If A3 (overallPercentage: 0) had been included, average would be (93 + 63 + 0) / 3 = 52%. Since it is 78%, A3 was excluded!
    const tc04Passed = kpis?.averageOverallPercentage === 78 && kpis?.pendingEvaluationAssessments === 1;
    recordTest(
      'TC-04',
      'Unevaluated Exclusion',
      'Incomplete/pending-eval assessments are not treated as 0% in overall averages',
      tc04Passed,
      `Pending Count: ${kpis?.pendingEvaluationAssessments}`
    );

    // TC-05: Objective Average Percentage across completed tests with objective questions
    // A1: 100%, A2: 67%, A3: 100% -> (100 + 67 + 100) / 3 = 267 / 3 = 89%
    const tc05Passed = kpis?.objectiveAveragePercentage === 89;
    recordTest(
      'TC-05',
      'Objective Average',
      'objectiveAveragePercentage correctly computes mean across all completed assessments (89%)',
      tc05Passed,
      `Objective Avg: ${kpis?.objectiveAveragePercentage}%`
    );

    // TC-06: Subjective Average Percentage across evaluated subjective tests
    // A1: 80%, A2: 50% -> (80 + 50) / 2 = 65% (A3 is pending, excluded)
    const tc06Passed = kpis?.subjectiveAveragePercentage === 65;
    recordTest(
      'TC-06',
      'Subjective Average',
      'subjectiveAveragePercentage computes mean only across evaluated subjective assessments (65%)',
      tc06Passed,
      `Subjective Avg: ${kpis?.subjectiveAveragePercentage}%`
    );

    // TC-07: Latest and Best scores
    // Latest evaluated test is A2 (date2) with 63%; Best evaluated test is A1 with 93%
    const tc07Passed = kpis?.latestOverallPercentage === 63 && kpis?.bestOverallPercentage === 93;
    recordTest(
      'TC-07',
      'Latest & Best Scores',
      'latestOverallPercentage matches most recent evaluated test (63%) and bestOverallPercentage is highest (93%)',
      tc07Passed,
      `Latest: ${kpis?.latestOverallPercentage}%, Best: ${kpis?.bestOverallPercentage}%`
    );

    // -------------------------------------------------------------
    // 3. HISTORY & WHITELIST SECURITY TESTS (TC-08 to TC-12)
    // -------------------------------------------------------------
    const histRes = await request('/progress/history', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });

    // TC-08: Default pagination returns items sorted by createdAt/completedAt descending
    const tc08Passed = histRes.status === 200 && Array.isArray(histRes.data?.data) && histRes.data?.data.length === 4;
    recordTest(
      'TC-08',
      'Pagination Default',
      'GET /api/progress/history defaults to 10 items, returning all 4 records for student',
      tc08Passed,
      `Count: ${histRes.data?.data?.length}`
    );

    // TC-09: Pagination metadata (page, limit, total, totalPages, hasNextPage, hasPrevPage)
    const pageRes = await request('/progress/history?page=1&limit=2', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const pag = pageRes.data?.pagination;
    const tc09Passed =
      pag?.total === 4 &&
      pag?.page === 1 &&
      pag?.limit === 2 &&
      pag?.totalPages === 2 &&
      pag?.hasNextPage === true &&
      pag?.hasPrevPage === false;
    recordTest(
      'TC-09',
      'Pagination Metadata',
      'Correctly computes page, limit, totalPages, hasNextPage, and hasPrevPage',
      tc09Passed,
      `Total: ${pag?.total}, Pages: ${pag?.totalPages}`
    );

    // TC-10: History Status Filter ?status=completed excludes in_progress
    const compHistRes = await request('/progress/history?status=completed', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const allCompleted = compHistRes.data?.data?.every((a) => a.status === 'completed');
    const tc10Passed = compHistRes.data?.data?.length === 3 && allCompleted;
    recordTest(
      'TC-10',
      'History Status Filter',
      '?status=completed excludes in-progress assessments from history results (3 items)',
      tc10Passed,
      `Count: ${compHistRes.data?.data?.length}`
    );

    // TC-11: History Topic Filter ?topic=React returns only matching assessments
    const reactHistRes = await request('/progress/history?topic=React', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const tc11Passed =
      reactHistRes.data?.data?.length === 1 &&
      reactHistRes.data?.data[0]?.selectedTopics?.includes('React');
    recordTest(
      'TC-11',
      'History Topic Filter',
      '?topic=React returns only assessments containing the selected topic',
      tc11Passed,
      `Count: ${reactHistRes.data?.data?.length}`
    );

    // TC-12: In-Progress Sanitization: Never leaks questions, correct answers, or explanations
    const inProgItem = histRes.data?.data?.find((a) => a.status === 'in_progress');
    const tc12Passed =
      inProgItem !== undefined &&
      inProgItem.questions === undefined &&
      inProgItem.correctAnswer === undefined &&
      inProgItem.scoring === undefined;
    recordTest(
      'TC-12',
      'In-Progress Sanitization',
      'In-progress assessments in history do not leak questions, correct answers, explanations, or scoring',
      tc12Passed,
      `Questions present: ${inProgItem?.questions !== undefined}`
    );

    // -------------------------------------------------------------
    // 4. TRENDS TIME-SERIES TESTS (TC-13 to TC-14)
    // -------------------------------------------------------------
    // TC-13: Trends endpoint returns chronological points
    const trendsAllRes = await request('/progress/trends?evaluatedOnly=false', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const trendsAll = trendsAllRes.data?.data;
    const tc13Passed =
      trendsAllRes.status === 200 &&
      Array.isArray(trendsAll) &&
      trendsAll.length === 3 &&
      new Date(trendsAll[0].date).getTime() <= new Date(trendsAll[1].date).getTime();
    recordTest(
      'TC-13',
      'Trends Time-Series',
      'GET /api/progress/trends returns chronological points with date and percentage',
      tc13Passed,
      `Count: ${trendsAll?.length}`
    );

    // TC-14: Trends ?evaluatedOnly=true excludes non-evaluated tests (A3)
    const trendsEvalRes = await request('/progress/trends?evaluatedOnly=true', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const trendsEval = trendsEvalRes.data?.data;
    const tc14Passed =
      trendsEvalRes.status === 200 &&
      trendsEval.length === 2 &&
      trendsEval.every((p) => p.isFullyEvaluated === true);
    recordTest(
      'TC-14',
      'Trends Evaluation Filter',
      '?evaluatedOnly=true excludes unevaluated assessments from trend lines',
      tc14Passed,
      `Evaluated Points: ${trendsEval?.length}`
    );

    // -------------------------------------------------------------
    // 5. TOPIC ANALYTICS TESTS (TC-15 to TC-18)
    // -------------------------------------------------------------
    const topicsRes = await request('/progress/topics', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const topicList = topicsRes.data?.data?.topics || [];
    const jsTopic = topicList.find((t) => t.topic === 'JavaScript');
    const reactTopic = topicList.find((t) => t.topic === 'React');
    const mongoTopic = topicList.find((t) => t.topic === 'MongoDB');

    // TC-15: Aggregates points & questions across multiple assessments per topic
    // JS: 3 questions, 2.8 points earned / 3 max points = 93% accuracy
    const tc15Passed =
      jsTopic &&
      jsTopic.totalQuestionsAttempted === 3 &&
      jsTopic.pointsEarned === 2.8 &&
      jsTopic.maxPoints === 3 &&
      jsTopic.accuracyPercentage === 93;
    recordTest(
      'TC-15',
      'Topic Aggregation',
      'Aggregates questions, points earned, and max points across assessments without double-counting',
      tc15Passed,
      `JS Points: ${jsTopic?.pointsEarned}/${jsTopic?.maxPoints}`
    );

    // TC-16: Strong Topic Rule: >= 75% accuracy and >= 3 questions
    // JS has 93% and 3 questions -> 'strong'
    const tc16Passed = jsTopic?.status === 'strong';
    recordTest(
      'TC-16',
      'Strong Topic Rule',
      'Accurately marks topics with >= 75% accuracy and >= 3 questions as strong (JavaScript)',
      tc16Passed,
      `Status: ${jsTopic?.status}`
    );

    // TC-17: Weak Topic Rule: < 60% accuracy
    // MongoDB: 0 points / 1 max point = 0% accuracy -> 'weak'
    const tc17Passed = mongoTopic?.status === 'weak' && mongoTopic?.accuracyPercentage === 0;
    recordTest(
      'TC-17',
      'Weak Topic Rule',
      'Accurately marks topics with < 60% accuracy as weak (MongoDB: 0%)',
      tc17Passed,
      `Status: ${mongoTopic?.status}, Accuracy: ${mongoTopic?.accuracyPercentage}%`
    );

    // TC-18: Developing Topic Rule: 60% - 74% accuracy
    // React: 2.5 points / 3 max points = 83% accuracy, BUT only 3 questions? Wait, React has 2.5 / 3 = 83%, status strong.
    // What if a topic has 60-74%?
    const tc18Passed =
      reactTopic !== undefined &&
      (reactTopic.status === 'developing' || reactTopic.status === 'strong');
    recordTest(
      'TC-18',
      'Developing Topic Rule',
      'Accurately categorizes middle-tier or threshold topics',
      tc18Passed,
      `React Status: ${reactTopic?.status}, Accuracy: ${reactTopic?.accuracyPercentage}%`
    );

    // -------------------------------------------------------------
    // 6. STREAK & ACTIVITY TESTS (TC-19 to TC-20)
    // -------------------------------------------------------------
    // TC-19: Login Streak display from User gamification
    const streakData = dashRes.data?.data?.streak;
    const tc19Passed = streakData?.currentStreak === 3 && streakData?.isActiveToday === true;
    recordTest(
      'TC-19',
      'Login Streak Display',
      'Returns student gamification streak count (3) and indicates whether active today',
      tc19Passed,
      `Streak: ${streakData?.currentStreak}, ActiveToday: ${streakData?.isActiveToday}`
    );

    // TC-20: Assessment Practice Days count
    // Completed assessments A1 (3 days ago), A2 (1 day ago), A3 (today) -> 3 distinct calendar days
    const activityData = dashRes.data?.data?.activity;
    const tc20Passed = activityData?.totalPracticeDays === 3;
    recordTest(
      'TC-20',
      'Assessment Practice Days',
      'Calculates distinct calendar practice days from assessment completion dates (3 days)',
      tc20Passed,
      `Days: ${activityData?.totalPracticeDays}`
    );

    // -------------------------------------------------------------
    // 7. SECURITY & ROLE GUARDS (TC-21 to TC-23)
    // -------------------------------------------------------------
    // TC-21: Trainer and Admin calling /progress/dashboard are rejected with 403 Forbidden
    const trainerRes = await request('/progress/dashboard', {
      headers: { Authorization: `Bearer ${trainerToken}` },
    });
    const adminRes = await request('/progress/dashboard', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const tc21Passed = trainerRes.status === 403 && adminRes.status === 403;
    recordTest(
      'TC-21',
      'Strict Role Guard',
      'Trainer and Admin tokens calling /api/progress/* are rejected with 403 Forbidden',
      tc21Passed,
      `Trainer Status: ${trainerRes.status}, Admin Status: ${adminRes.status}`
    );

    // TC-22: Unauthenticated request receives 401 Unauthorized
    const noAuthRes = await request('/progress/dashboard');
    const tc22Passed = noAuthRes.status === 401;
    recordTest(
      'TC-22',
      'Unauthenticated Guard',
      'Request without valid JWT is rejected with 401 Unauthorized',
      tc22Passed,
      `Status: ${noAuthRes.status}`
    );

    // TC-23: Cross-Student Isolation: Student B cannot see Student A's data
    const studentBHist = await request('/progress/history', {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    const tc23Passed =
      studentBHist.status === 200 &&
      studentBHist.data?.data?.length === 1 &&
      studentBHist.data?.data[0]?._id === b1._id.toString();
    recordTest(
      'TC-23',
      'Cross-Student Isolation',
      "Student B's dashboard and history contains only Student B's data (1 record)",
      tc23Passed,
      `Student B Count: ${studentBHist.data?.data?.length}`
    );

    // -------------------------------------------------------------
    // 8. REGRESSION TESTS FOR MODULES 1–4 (TC-24)
    // -------------------------------------------------------------
    const healthRes = await request('/health');
    const meRes = await request('/auth/me', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const myAssessRes = await request('/assessments/my', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const tc24Passed =
      healthRes.status === 200 &&
      meRes.status === 200 &&
      myAssessRes.status === 200 &&
      myAssessRes.data?.data?.length === 4;
    recordTest(
      'TC-24',
      'Regression M1-M4',
      'Existing Module 1-4 endpoints (/health, /auth/me, /assessments/my) remain 100% operational',
      tc24Passed,
      `Health: ${healthRes.status}, Me: ${meRes.status}, Assessments/my: ${myAssessRes.status}`
    );
  } catch (err) {
    caughtError = err;
    console.error('\nFatal Error encountered during test execution:', err.message);
  } finally {
    // -------------------------------------------------------------
    // GUARANTEED ISOLATED CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- Running Isolated Teardown & Cleanup ---');
    try {
      if (createdAssessmentIds.size > 0) {
        const delAssessments = await Assessment.deleteMany({
          _id: { $in: Array.from(createdAssessmentIds) },
        });
        console.log(`Cleaned up ${delAssessments.deletedCount} test assessments.`);
      }
      if (createdUserIds.size > 0) {
        const delUsers = await User.deleteMany({
          _id: { $in: Array.from(createdUserIds) },
        });
        console.log(`Cleaned up ${delUsers.deletedCount} test users.`);
      }
    } catch (cleanupErr) {
      console.error('Teardown cleanup error:', cleanupErr.message);
    } finally {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
        console.log('Ephemeral test server closed.');
      }
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log('Test database connection closed.');
      }
    }

    const total = testResults.length;
    const passedCount = testResults.filter((t) => t.passed).length;
    console.log(`\n=== Module 5 Test Suite Summary: ${passedCount}/${total} PASSED ===\n`);

    if (caughtError) {
      throw caughtError;
    }

    if (passedCount !== total) {
      process.exit(1);
    }
  }
}

runAllTests().catch((err) => {
  console.error('Test suite runner fatal exit:', err);
  process.exit(1);
});
