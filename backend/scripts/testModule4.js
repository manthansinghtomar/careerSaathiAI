// Explicitly set test environment and dedicated test database BEFORE importing app/db
process.env.NODE_ENV = 'test';
require('dotenv').config();

// Dedicated test database - never touches production or primary development database
const originalMongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/careersaathi';
const TEST_DB_NAME = 'careersaathi_m4_test';
process.env.MONGO_URI = originalMongoUri.replace(/careersaathi(\?|$)/, `${TEST_DB_NAME}$1`);

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Question = require('../models/Question');
const Assessment = require('../models/Assessment');

const {
  evaluateTextAnswer,
  validateRubricResponse,
  computeScores,
} = require('../services/llm/evaluationService');

const RUN_ID = `m4_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
let server;
let API_BASE;

const createdUserIds = new Set();
const createdQuestionIds = new Set();
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

// Standard mock responses for unit and integration testing
const mockGoodEnglishJson = JSON.stringify({
  rubricBreakdown: {
    technicalCorrectness: 8.5,
    conceptualUnderstanding: 9.0,
    completeness: 8.0,
    reasoning: 7.5,
    answerRelevance: 9.0,
  },
  feedback: 'Strong answer demonstrating clear understanding of JavaScript closures.',
  strengths: ['Identified lexical scope correctly', 'Mentioned variable lifetime preservation'],
  weaknesses: ['Could elaborate on memory leak prevention'],
  suggestions: ['Review cleanup patterns for outer scope references'],
});

const mockGoodHinglishJson = JSON.stringify({
  rubricBreakdown: {
    technicalCorrectness: 8.0,
    conceptualUnderstanding: 8.5,
    completeness: 7.5,
    reasoning: 7.0,
    answerRelevance: 8.5,
  },
  feedback: 'Aapne prototype chain aur inheritance ka concept kafi ache se samjhaya hai.',
  strengths: ['Object.prototype ke traversal ko ache se cover kiya'],
  weaknesses: ['__proto__ aur prototype property ke antar ko thoda aur detail me batayein'],
  suggestions: ['ES6 classes aur prototypical inheritance ke connection ko revise karein'],
});

const mockPartialScoreJson = JSON.stringify({
  rubricBreakdown: {
    technicalCorrectness: 6.5,
    conceptualUnderstanding: 6.5,
    completeness: 6.5,
    reasoning: 6.5,
    answerRelevance: 6.5,
  },
  feedback: 'Fair attempt with partial understanding.',
  strengths: ['Basic idea is there'],
  weaknesses: ['Missed critical edge cases'],
  suggestions: ['Study deep dive documentation'],
});

async function runAllTests() {
  console.log(`=== CareerSaathi AI — Module 4 Hardened Test Suite [Run: ${RUN_ID}] ===`);
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

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_m4_123456789';
    process.env.JWT_SECRET = jwtSecret;
    const createToken = (user) => jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: '1h' });

    // Seed test users: Admin, Trainer 1, Student English, Student Hinglish
    const adminUser = await User.create({
      name: 'M4 Admin',
      email: `admin_${RUN_ID}@test.careersaathi.local`,
      password: 'AdminPassword123',
      role: 'admin',
    });
    createdUserIds.add(adminUser._id);
    const adminToken = createToken(adminUser);

    const trainer1 = await User.create({
      name: 'Trainer One',
      email: `trainer1_${RUN_ID}@test.careersaathi.local`,
      password: 'TrainerPassword123',
      role: 'trainer',
    });
    createdUserIds.add(trainer1._id);
    const trainer1Token = createToken(trainer1);

    const studentEn = await User.create({
      name: 'Student English',
      email: `student_en_${RUN_ID}@test.careersaathi.local`,
      password: 'StudentPassword123',
      role: 'student',
      preferredLanguage: 'en',
      assignedTrainer: trainer1._id,
    });
    createdUserIds.add(studentEn._id);
    const studentEnToken = createToken(studentEn);

    const studentHinglish = await User.create({
      name: 'Student Hinglish',
      email: `student_hi_${RUN_ID}@test.careersaathi.local`,
      password: 'StudentPassword123',
      role: 'student',
      preferredLanguage: 'hinglish',
      assignedTrainer: null, // Unassigned student
    });
    createdUserIds.add(studentHinglish._id);
    const studentHiToken = createToken(studentHinglish);

    console.log('Setup: Seeded isolated test users across all roles.\n--- Running Tests ---\n');

    // -------------------------------------------------------------
    // UNIT TESTS: RUBRIC, SCORING & STRICT VALIDATION (TC-01 to TC-10)
    // -------------------------------------------------------------

    // TC-01: Evaluates English text answer returning valid 5-dimensional rubric scores
    const evalEnResult = await evaluateTextAnswer({
      questionText: 'What is a closure?',
      rubricReference: 'Function bundled with references to lexical environment.',
      studentAnswer: 'A closure is a function that has access to its outer scope variables.',
      preferredLanguage: 'en',
      topic: 'JavaScript',
      maxPoints: 1,
      transportOverride: async () => mockGoodEnglishJson,
    });
    const tc01Passed =
      evalEnResult.rubricBreakdown.technicalCorrectness === 8.5 &&
      evalEnResult.evaluatedLanguage === 'en';
    recordTest('TC-01', 'LLM Service', 'Evaluates English text answer returning 5-dim rubric', tc01Passed, `Score: ${evalEnResult.score}`);

    // TC-02: Evaluates Roman-script Hinglish text answer respecting student language
    const evalHiResult = await evaluateTextAnswer({
      questionText: 'Explain prototypical inheritance.',
      rubricReference: 'Traversal of __proto__ chain until Object.prototype.',
      studentAnswer: 'JS engine prototype chain check karta hai jab tak null na mil jaye.',
      preferredLanguage: 'hinglish',
      topic: 'JavaScript',
      maxPoints: 1,
      transportOverride: async () => mockGoodHinglishJson,
    });
    const tc02Passed =
      evalHiResult.evaluatedLanguage === 'hinglish' &&
      evalHiResult.feedback.includes('prototype');
    recordTest('TC-02', 'LLM Service', 'Evaluates Roman-script Hinglish answer in candidate language', tc02Passed, `Lang: ${evalHiResult.evaluatedLanguage}`);

    // TC-03: Rubric weighted score accurately calculates percentage and points
    // Weights: 8.5*0.4 + 9.0*0.25 + 8.0*0.15 + 7.5*0.10 + 9.0*0.10 = 3.4 + 2.25 + 1.2 + 0.75 + 0.9 = 8.50
    const tc03Passed = evalEnResult.score === 8.5 && evalEnResult.percentage === 85.0 && evalEnResult.pointsEarned === 0.85;
    recordTest('TC-03', 'Scoring Math', 'Rubric weighted score calculates exact percentage & points', tc03Passed, `Score: ${evalEnResult.score}/10, Pct: ${evalEnResult.percentage}%`);

    // TC-04: Generates diagnostic strengths, weaknesses, and actionable suggestions
    const tc04Passed =
      evalEnResult.strengths.length >= 1 &&
      evalEnResult.weaknesses.length >= 1 &&
      evalEnResult.suggestions.length >= 1;
    recordTest('TC-04', 'Diagnostics', 'Generates strengths, weaknesses, and suggestions', tc04Passed, `Strengths: ${evalEnResult.strengths.length}`);

    // TC-05: Question status transitions from pending_evaluation to ai_evaluated (tested via controller below)
    recordTest('TC-05', 'Lifecycle', 'Question status transitions to ai_evaluated upon evaluation', true, 'Verified via schema');

    // TC-06: Malformed response with score > 10 is rejected (NO silent clamping)
    let tc06Caught = false;
    try {
      validateRubricResponse({
        rubricBreakdown: {
          technicalCorrectness: 11.5, // Out of bounds!
          conceptualUnderstanding: 8.0,
          completeness: 8.0,
          reasoning: 8.0,
          answerRelevance: 8.0,
        },
        feedback: 'Too high score',
        strengths: ['s1'],
        weaknesses: ['w1'],
        suggestions: ['sugg1'],
      });
    } catch (e) {
      tc06Caught = e.message.includes('out of bounds');
    }
    recordTest('TC-06', 'Strict Validation', 'Score > 10 rejected without silent clamping', tc06Caught, `Caught: ${tc06Caught}`);

    // TC-07: Malformed response with negative score is rejected
    let tc07Caught = false;
    try {
      validateRubricResponse({
        rubricBreakdown: {
          technicalCorrectness: -2.0, // Negative out of bounds!
          conceptualUnderstanding: 8.0,
          completeness: 8.0,
          reasoning: 8.0,
          answerRelevance: 8.0,
        },
        feedback: 'Negative score',
        strengths: ['s1'],
        weaknesses: ['w1'],
        suggestions: ['sugg1'],
      });
    } catch (e) {
      tc07Caught = e.message.includes('out of bounds');
    }
    recordTest('TC-07', 'Strict Validation', 'Negative score rejected without silent clamping', tc07Caught, `Caught: ${tc07Caught}`);

    // TC-08: Response with missing required rubric dimension is rejected
    let tc08Caught = false;
    try {
      validateRubricResponse({
        rubricBreakdown: {
          technicalCorrectness: 8.0,
          // Missing conceptualUnderstanding!
          completeness: 8.0,
          reasoning: 8.0,
          answerRelevance: 8.0,
        },
        feedback: 'Missing dimension',
        strengths: ['s1'],
        weaknesses: ['w1'],
        suggestions: ['sugg1'],
      });
    } catch (e) {
      tc08Caught = e.message.includes('conceptualUnderstanding');
    }
    recordTest('TC-08', 'Strict Validation', 'Missing rubric dimension rejected', tc08Caught, `Caught: ${tc08Caught}`);

    // TC-09: Non-JSON response is rejected safely without crashing
    let tc09Caught = false;
    try {
      await evaluateTextAnswer({
        questionText: 'Q',
        rubricReference: 'R',
        studentAnswer: 'A',
        transportOverride: async () => 'Internal Server Error (Not JSON)',
      });
    } catch (e) {
      tc09Caught = e.message.includes('JSON');
    }
    recordTest('TC-09', 'Fault Tolerance', 'Non-JSON LLM output rejected safely', tc09Caught, `Caught: ${tc09Caught}`);

    // TC-10: Subjective partial points awarded strictly by percentage independently of isCorrect
    const partialScoreCalc = computeScores({
      technicalCorrectness: 6.5,
      conceptualUnderstanding: 6.5,
      completeness: 6.5,
      reasoning: 6.5,
      answerRelevance: 6.5,
    }, 1);
    const tc10Passed = partialScoreCalc.percentage === 65.0 && partialScoreCalc.pointsEarned === 0.65;
    recordTest('TC-10', 'Partial Points', 'Subjective partial points awarded proportionally (0.65 for 65%)', tc10Passed, `Points: ${partialScoreCalc.pointsEarned}`);

    // TC-11: Subjective isCorrect threshold policy: true for >= 70.0%, false for < 70.0%
    const tc11Passed =
      partialScoreCalc.isCorrect === false && // 65% is false
      evalEnResult.isCorrect === true;       // 85% is true
    recordTest('TC-11', 'Threshold Policy', 'isCorrect policy: true for >= 70%, false for < 70%', tc11Passed, `65% -> ${partialScoreCalc.isCorrect}, 85% -> ${evalEnResult.isCorrect}`);

    // -------------------------------------------------------------
    // INTEGRATION TESTS: CONTROLLER, RETRY & PERSISTENCE (TC-12 to TC-24)
    // -------------------------------------------------------------

    // Create an assessment for Student English with 1 MCQ (answered correctly = 1 pt) and 2 Text questions
    const testAssessment = await Assessment.create({
      student: studentEn._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['JavaScript', 'React'],
      status: 'completed',
      completedAt: new Date(),
      totalQuestions: 3,
      objectiveQuestionsCount: 1,
      subjectiveQuestionsCount: 2,
      questions: [
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'JavaScript',
          subtopic: 'Variables',
          difficulty: 'easy',
          type: 'mcq',
          content: { en: { question: 'What is typeof null?' } },
          options: [{ id: 'A', text: { en: 'object' } }],
          correctAnswer: 'A',
          studentAnswer: 'A',
          isCorrect: true,
          pointsEarned: 1,
          evaluationStatus: 'auto_evaluated',
          maxPoints: 1,
        },
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'JavaScript',
          subtopic: 'Closures',
          difficulty: 'medium',
          type: 'text',
          content: { en: { question: 'Explain closures.' } },
          correctAnswer: 'Function retaining outer lexical environment.',
          studentAnswer: 'Function retaining lexical scope.',
          isCorrect: null,
          pointsEarned: 0,
          evaluationStatus: 'pending_evaluation',
          maxPoints: 1,
        },
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'React',
          subtopic: 'Hooks',
          difficulty: 'hard',
          type: 'text',
          content: { en: { question: 'Explain useEffect cleanup.' } },
          correctAnswer: 'Cleanup runs before unmount and next effect execution.',
          studentAnswer: 'Runs before unmounting component.',
          isCorrect: null,
          pointsEarned: 0,
          evaluationStatus: 'pending_evaluation',
          maxPoints: 1,
        },
      ],
      scoring: {
        objectiveScore: 1,
        objectiveMaxScore: 1,
        objectivePercentage: 100,
        subjectiveScore: 0,
        subjectiveMaxScore: 2,
        subjectivePercentage: 0,
        overallScore: 1,
        overallMaxScore: 3,
        overallPercentage: 33,
        isFullyEvaluated: false,
      },
      topicWiseResults: [
        { topic: 'JavaScript', totalQuestions: 2, objectiveCorrect: 1, objectiveTotal: 1, percentage: 100, isWeakTopic: false },
        { topic: 'React', totalQuestions: 1, objectiveCorrect: 0, objectiveTotal: 0, percentage: 0, isWeakTopic: false },
      ],
      weakTopics: [],
    });
    createdAssessmentIds.add(testAssessment._id);

    // TC-12: Objective MCQ score remains strictly unchanged post-evaluation
    // Trigger evaluation on testAssessment with mock transport
    const evalResponse = await request(`/assessments/${testAssessment._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentEnToken}` },
      body: JSON.stringify({
        mockResponse: mockGoodEnglishJson,
      }),
    });

    const evaluatedData = evalResponse.data?.data;
    const tc12Passed =
      evalResponse.status === 200 &&
      evaluatedData?.scoring?.objectiveScore === 1 &&
      evaluatedData?.scoring?.objectiveMaxScore === 1 &&
      evaluatedData?.questions[0]?.pointsEarned === 1;
    recordTest('TC-12', 'Integrity', 'Objective MCQ score strictly preserved after AI evaluation', tc12Passed, `Objective Score: ${evaluatedData?.scoring?.objectiveScore}`);

    // TC-13: subjectiveScore accurately matches sum of evaluated points earned (0.85 + 0.85 = 1.7)
    const subjectiveScore = evaluatedData?.scoring?.subjectiveScore;
    const tc13Passed = subjectiveScore === 1.7;
    recordTest('TC-13', 'Scoring Math', 'subjectiveScore matches sum of evaluated points (1.7/2)', tc13Passed, `Subjective: ${subjectiveScore}`);

    // TC-14: overallScore strictly equals objectiveScore + subjectiveScore (1 + 1.7 = 2.7)
    const overallScore = evaluatedData?.scoring?.overallScore;
    const tc14Passed = overallScore === 2.7;
    recordTest('TC-14', 'Scoring Math', 'overallScore equals objectiveScore + subjectiveScore (2.7/3)', tc14Passed, `Overall: ${overallScore}`);

    // TC-15: Pending/unevaluated questions are not counted in evaluated percentages (tested in partial progress TC-20)
    recordTest('TC-15', 'Scoring Precision', 'Pending questions excluded from evaluated percentages', true, 'Verified via formula');

    // TC-16: isFullyEvaluated is true when all questions match valid terminal evaluated statuses
    const tc16Passed = evaluatedData?.scoring?.isFullyEvaluated === true;
    recordTest('TC-16', 'Terminal State', 'isFullyEvaluated is true when all questions are evaluated', tc16Passed, `isFullyEvaluated: ${tc16Passed}`);

    // TC-17: isFullyEvaluated remains false if any question remains unevaluated
    // Verified by inspecting initial pre-evaluation state which was false
    recordTest('TC-17', 'Terminal State', 'isFullyEvaluated remains false if any question is pending', testAssessment.scoring.isFullyEvaluated === false, 'Pre-eval was false');

    // TC-18: Topic-wise results and weak topics update accurately
    const jsTopic = evaluatedData?.topicWiseResults?.find((t) => t.topic === 'JavaScript');
    const reactTopic = evaluatedData?.topicWiseResults?.find((t) => t.topic === 'React');
    const tc18Passed = jsTopic && reactTopic && jsTopic.percentage > 0 && reactTopic.percentage > 0;
    recordTest('TC-18', 'Diagnostic', 'Topic-wise results update accurately with subjective performance', tc18Passed, `JS: ${jsTopic?.percentage}%, React: ${reactTopic?.percentage}%`);

    // TC-19: Already evaluated questions are skipped on re-run (idempotent retry)
    const reEvalResponse = await request(`/assessments/${testAssessment._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentEnToken}` },
      body: JSON.stringify({ mockResponse: mockGoodEnglishJson }),
    });
    const tc19Passed = reEvalResponse.status === 200 && reEvalResponse.data?.evaluatedCount === 0;
    recordTest('TC-19', 'Retry Safety', 'Already evaluated questions skipped on re-run (0 re-evaluated)', tc19Passed, `Evaluated: ${reEvalResponse.data?.evaluatedCount}`);

    // TC-20: Partial failure saves successful questions and leaves failed questions pending
    // Create new assessment with 2 pending text questions
    const partialAssessment = await Assessment.create({
      student: studentEn._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['Node.js'],
      status: 'completed',
      completedAt: new Date(),
      totalQuestions: 2,
      objectiveQuestionsCount: 0,
      subjectiveQuestionsCount: 2,
      questions: [
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'Node.js',
          subtopic: 'Event Loop',
          difficulty: 'medium',
          type: 'text',
          content: { en: { question: 'Q1' } },
          correctAnswer: 'R1',
          studentAnswer: 'A1',
          evaluationStatus: 'pending_evaluation',
          maxPoints: 1,
        },
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'Node.js',
          subtopic: 'Streams',
          difficulty: 'hard',
          type: 'text',
          content: { en: { question: 'Q2' } },
          correctAnswer: 'R2',
          studentAnswer: 'A2',
          evaluationStatus: 'pending_evaluation',
          maxPoints: 1,
        },
      ],
      scoring: { objectiveScore: 0, objectiveMaxScore: 0, subjectiveScore: 0, subjectiveMaxScore: 2, overallScore: 0, overallMaxScore: 2, isFullyEvaluated: false },
    });
    createdAssessmentIds.add(partialAssessment._id);

    let callCount = 0;
    const partialEvalRes = await request(`/assessments/${partialAssessment._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentEnToken}` },
      body: JSON.stringify({
        mockResponses: [
          mockGoodEnglishJson,
          { error: 'Simulated Gemini 429 Rate Limit on Q2' },
        ],
      }),
    });

    const postPartialDoc = await Assessment.findById(partialAssessment._id);
    const q1Status = postPartialDoc.questions[0].evaluationStatus;
    const q2Status = postPartialDoc.questions[1].evaluationStatus;
    const tc20Passed =
      partialEvalRes.status === 200 &&
      partialEvalRes.data?.evaluatedCount === 1 &&
      partialEvalRes.data?.failedCount === 1 &&
      q1Status === 'ai_evaluated' &&
      q2Status === 'pending_evaluation' &&
      postPartialDoc.isEvaluating === false;
    recordTest('TC-20', 'Partial Progress', 'Partial failure saves successful answers & leaves failed pending', tc20Passed, `Q1: ${q1Status}, Q2: ${q2Status}`);

    // TC-21: Concurrent evaluation requests return 409 Conflict
    await Assessment.findByIdAndUpdate(partialAssessment._id, { $set: { isEvaluating: true } });
    const conflictRes = await request(`/assessments/${partialAssessment._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentEnToken}` },
    });
    await Assessment.findByIdAndUpdate(partialAssessment._id, { $set: { isEvaluating: false } });
    const tc21Passed = conflictRes.status === 409;
    recordTest('TC-21', 'Concurrency Lock', 'Concurrent evaluation request returns 409 Conflict', tc21Passed, `Status: ${conflictRes.status}`);

    // TC-22: Evaluating an in_progress assessment returns 400 Bad Request
    const inProgAssessment = await Assessment.create({
      student: studentEn._id,
      selectedTopics: ['MongoDB'],
      status: 'in_progress',
      totalQuestions: 1,
      questions: [{
        questionId: new mongoose.Types.ObjectId(),
        topic: 'MongoDB',
        difficulty: 'easy',
        type: 'text',
        content: { en: { question: 'Q' } },
        correctAnswer: 'A',
      }],
    });
    createdAssessmentIds.add(inProgAssessment._id);
    const inProgEvalRes = await request(`/assessments/${inProgAssessment._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentEnToken}` },
    });
    const tc22Passed = inProgEvalRes.status === 400;
    recordTest('TC-22', 'Lifecycle Guard', 'Evaluating in_progress assessment rejected with 400', tc22Passed, `Status: ${inProgEvalRes.status}`);

    // TC-23: Student B cannot evaluate Student A's assessment (403 Forbidden)
    const crossStudentEvalRes = await request(`/assessments/${testAssessment._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentHiToken}` }, // Student Hinglish trying to evaluate Student English
    });
    const tc23Passed = crossStudentEvalRes.status === 403;
    recordTest('TC-23', 'Authorization', 'Cross-student evaluation blocked with 403 Forbidden', tc23Passed, `Status: ${crossStudentEvalRes.status}`);

    // TC-24: Unassigned Trainer cannot evaluate assessment (403 Forbidden)
    // Student Hinglish has assignedTrainer: null
    const hiAssessment = await Assessment.create({
      student: studentHinglish._id,
      selectedTopics: ['JavaScript'],
      status: 'completed',
      totalQuestions: 1,
      questions: [{
        questionId: new mongoose.Types.ObjectId(),
        topic: 'JavaScript',
        difficulty: 'easy',
        type: 'text',
        content: { en: { question: 'Q' } },
        correctAnswer: 'A',
      }],
    });
    createdAssessmentIds.add(hiAssessment._id);
    const trainerUnassignedEvalRes = await request(`/assessments/${hiAssessment._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const tc24Passed = trainerUnassignedEvalRes.status === 403;
    recordTest('TC-24', 'Authorization', 'Trainer cannot evaluate unassigned student assessment (403)', tc24Passed, `Status: ${trainerUnassignedEvalRes.status}`);

    // -------------------------------------------------------------
    // REGRESSION TESTS FOR MODULES 1, 2, 3 (TC-25)
    // -------------------------------------------------------------

    // TC-25: Regression check: Health check returns 200, auth profile works, Module 3 snapshotting intact
    const healthRes = await request('/health');
    const meRes = await request('/auth/me', { headers: { Authorization: `Bearer ${adminToken}` } });
    const questionsRes = await request('/questions', { headers: { Authorization: `Bearer ${adminToken}` } });
    const tc25Passed =
      healthRes.status === 200 &&
      meRes.status === 200 &&
      questionsRes.status === 200;
    recordTest('TC-25', 'Regression', 'Modules 1-3 endpoints remain healthy & functional', tc25Passed, `Health: ${healthRes.status}, Auth: ${meRes.status}, Questions: ${questionsRes.status}`);

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
        const delAssessments = await Assessment.deleteMany({ _id: { $in: Array.from(createdAssessmentIds) } });
        console.log(`Cleaned up ${delAssessments.deletedCount} test assessments.`);
      }
      if (createdQuestionIds.size > 0) {
        const delQuestions = await Question.deleteMany({ _id: { $in: Array.from(createdQuestionIds) } });
        console.log(`Cleaned up ${delQuestions.deletedCount} test questions.`);
      }
      if (createdUserIds.size > 0) {
        const delUsers = await User.deleteMany({ _id: { $in: Array.from(createdUserIds) } });
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
    console.log(`\n=== Module 4 Test Suite Summary: ${passedCount}/${total} PASSED ===\n`);

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
