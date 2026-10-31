// Explicitly set test environment and dedicated test database BEFORE importing app/db
process.env.NODE_ENV = 'test';
require('dotenv').config();

// Dedicated test database - never touches production or primary development database
const originalMongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/careersaathi';
const TEST_DB_NAME = 'careersaathi_m3_test';
process.env.MONGO_URI = originalMongoUri.replace(/careersaathi(\?|$)/, `${TEST_DB_NAME}$1`);

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Question = require('../models/Question');
const Assessment = require('../models/Assessment');

const RUN_ID = `m3_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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

async function runAllTests() {
  console.log(`=== CareerSaathi AI — Module 3 Hardened Test Suite [Run: ${RUN_ID}] ===`);
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

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_m3_123456789';
    process.env.JWT_SECRET = jwtSecret;

    // Helper: generate test token directly
    const createToken = (user) => jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: '1h' });

    // Setup Test Users: Admin, Trainer 1, Trainer 2, Student A, Student B
    const adminUser = await User.create({
      name: 'M3 Admin',
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

    const trainer2 = await User.create({
      name: 'Trainer Two',
      email: `trainer2_${RUN_ID}@test.careersaathi.local`,
      password: 'TrainerPassword123',
      role: 'trainer',
    });
    createdUserIds.add(trainer2._id);
    const trainer2Token = createToken(trainer2);

    const studentA = await User.create({
      name: 'Student Alice',
      email: `studentA_${RUN_ID}@test.careersaathi.local`,
      password: 'StudentPassword123',
      role: 'student',
      assignedTrainer: null, // Unassigned student
    });
    createdUserIds.add(studentA._id);
    const studentAToken = createToken(studentA);

    const studentB = await User.create({
      name: 'Student Bob',
      email: `studentB_${RUN_ID}@test.careersaathi.local`,
      password: 'StudentPassword123',
      role: 'student',
      assignedTrainer: trainer1._id, // Assigned specifically to Trainer 1
    });
    createdUserIds.add(studentB._id);
    const studentBToken = createToken(studentB);

    console.log('Setup: Seeded 5 isolated test users across all roles.\n--- Running Tests ---\n');

    // -------------------------------------------------------------
    // QUESTION MANAGEMENT TESTS (TC-01 to TC-10)
    // -------------------------------------------------------------

    // TC-01: Admin can create a valid MCQ question with English and Hinglish content
    const q1Res = await request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        topic: 'JavaScript',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: { question: 'What is typeof null?', explanation: 'In JS, typeof null is object' },
          hinglish: { question: 'JS me typeof null kya hota hai?', explanation: 'Yeh object hota hai' },
        },
        options: [
          { id: 'A', text: { en: 'null', hinglish: 'null' } },
          { id: 'B', text: { en: 'object', hinglish: 'object' } },
          { id: 'C', text: { en: 'undefined', hinglish: 'undefined' } },
        ],
        correctAnswer: 'B',
      }),
    });
    const q1Id = q1Res.data?.data?._id;
    if (q1Id) createdQuestionIds.add(q1Id);
    recordTest('TC-01', 'Question CRUD', 'Admin creates valid MCQ with en/hinglish content', q1Res.status === 201 && q1Res.data?.data?.correctAnswer === undefined, `Status: ${q1Res.status}`);

    // TC-02: Trainer can create a valid text question
    const q2Res = await request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${trainer1Token}` },
      body: JSON.stringify({
        topic: 'React',
        difficulty: 'medium',
        type: 'text',
        content: {
          en: { question: 'Explain React Reconciliation algorithm', explanation: 'Diffing O(n)' },
          hinglish: { question: 'React Reconciliation kya hota hai?', explanation: 'Diffing O(n)' },
        },
        options: [],
        correctAnswer: 'Reconciliation is the process through which React updates the DOM by diffing Virtual DOM trees.',
      }),
    });
    const q2Id = q2Res.data?.data?._id;
    if (q2Id) createdQuestionIds.add(q2Id);
    recordTest('TC-02', 'Question CRUD', 'Trainer creates valid text question', q2Res.status === 201 && q2Res.data?.data?.type === 'text', `Status: ${q2Res.status}`);

    // TC-03: Student cannot create a question (403 Forbidden)
    const q3Res = await request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentAToken}` },
      body: JSON.stringify({
        topic: 'Node.js',
        difficulty: 'easy',
        type: 'text',
        content: { en: { question: 'What is Node?' } },
        correctAnswer: 'Runtime',
      }),
    });
    recordTest('TC-03', 'Security', 'Student cannot create a question (403 Forbidden)', q3Res.status === 403, `Status: ${q3Res.status}`);

    // TC-04: MCQ creation fails if correctAnswer is not one of the option IDs
    const q4Res = await request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        topic: 'MongoDB',
        difficulty: 'easy',
        type: 'mcq',
        content: { en: { question: 'What is default ID?' } },
        options: [
          { id: 'A', text: { en: '_id' } },
          { id: 'B', text: { en: 'id' } },
        ],
        correctAnswer: 'Z', // Invalid option ID
      }),
    });
    recordTest('TC-04', 'Validation', 'MCQ fails if correctAnswer is not an option ID (400)', q4Res.status === 400 && q4Res.data?.message?.includes('correctAnswer'), `Status: ${q4Res.status}`);

    // TC-05: Creation fails if topic is invalid
    const q5Res = await request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        topic: 'RubyOnRails', // Not permitted
        difficulty: 'easy',
        type: 'text',
        content: { en: { question: 'Ruby question?' } },
        correctAnswer: 'Answer',
      }),
    });
    recordTest('TC-05', 'Validation', 'Question creation fails with invalid topic (400)', q5Res.status === 400, `Status: ${q5Res.status}`);

    // TC-06: Unauthenticated user cannot list questions (401 Unauthorized)
    const q6Res = await request('/questions');
    recordTest('TC-06', 'Security', 'Unauthenticated request to list questions returns 401', q6Res.status === 401, `Status: ${q6Res.status}`);

    // TC-07: Question listing omits correctAnswer by default
    const q7Res = await request('/questions', {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const hasExposedAnswer = q7Res.data?.data?.some((q) => q.correctAnswer !== undefined);
    recordTest('TC-07', 'Security', 'Question listing strictly omits correctAnswer', q7Res.status === 200 && !hasExposedAnswer, `Exposed: ${hasExposedAnswer}`);

    // TC-08: Trainer cannot update another trainer's question (403 Forbidden)
    const q8Res = await request(`/questions/${q2Id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${trainer2Token}` }, // Trainer 2 trying to edit Trainer 1's question
      body: JSON.stringify({ subtopic: 'Unauthorized Edit' }),
    });
    recordTest('TC-08', 'Authorization', 'Trainer cannot edit another trainer question (403)', q8Res.status === 403, `Status: ${q8Res.status}`);

    // TC-09: Admin can update any question
    const q9Res = await request(`/questions/${q2Id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ subtopic: 'Admin Approved Update' }),
    });
    recordTest('TC-09', 'Authorization', 'Admin can update any question in question bank', q9Res.status === 200 && q9Res.data?.data?.subtopic === 'Admin Approved Update', `Status: ${q9Res.status}`);

    // TC-10: Soft-deactivation (isActive: false) works
    const q10Res = await request(`/questions/${q1Id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: false }),
    });
    recordTest('TC-10', 'Question Status', 'Soft-deactivation toggles isActive to false', q10Res.status === 200 && q10Res.data?.data?.isActive === false, `Active: ${q10Res.data?.data?.isActive}`);

    // Reactivate q1 for subsequent generation tests
    await request(`/questions/${q1Id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: true }),
    });

    // Populate additional test questions for assessment generation (minimum 5 total with balanced difficulty distribution)
    const extraQuestions = [
      {
        topic: 'JavaScript',
        difficulty: 'medium',
        type: 'mcq',
        content: { en: { question: 'What is event delegation?' } },
        options: [{ id: 'A', text: { en: 'Bubbling listener' } }, { id: 'B', text: { en: 'Capture only' } }],
        correctAnswer: 'A',
      },
      {
        topic: 'React',
        difficulty: 'medium',
        type: 'mcq',
        content: { en: { question: 'What is the purpose of React.memo?' } },
        options: [{ id: 'A', text: { en: 'Memoizes component rendering' } }, { id: 'B', text: { en: 'State store' } }],
        correctAnswer: 'A',
      },
      {
        topic: 'React',
        difficulty: 'easy',
        type: 'mcq',
        content: { en: { question: 'What hook is used for side effects?' } },
        options: [{ id: 'A', text: { en: 'useEffect' } }, { id: 'B', text: { en: 'useState' } }],
        correctAnswer: 'A',
      },
      {
        topic: 'Node.js',
        difficulty: 'easy',
        type: 'mcq',
        content: { en: { question: 'Node module import in CommonJS?' } },
        options: [{ id: 'A', text: { en: 'require' } }, { id: 'B', text: { en: 'import' } }],
        correctAnswer: 'A',
      },
      {
        topic: 'MongoDB',
        difficulty: 'easy',
        type: 'mcq',
        content: { en: { question: 'Operator for setting a value?' } },
        options: [{ id: 'A', text: { en: '$set' } }, { id: 'B', text: { en: '$put' } }],
        correctAnswer: 'A',
      },
      {
        topic: 'MongoDB',
        difficulty: 'hard',
        type: 'mcq',
        content: { en: { question: 'Which index type supports geospatial queries?' } },
        options: [{ id: 'A', text: { en: '2dsphere' } }, { id: 'B', text: { en: 'hashed' } }],
        correctAnswer: 'A',
      },
      {
        topic: 'Node.js',
        difficulty: 'hard',
        type: 'mcq',
        content: { en: { question: 'Which internal C++ library handles asynchronous I/O in Node?' } },
        options: [{ id: 'A', text: { en: 'libuv' } }, { id: 'B', text: { en: 'v8' } }],
        correctAnswer: 'A',
      },
    ];

    for (const eq of extraQuestions) {
      const q = await Question.create({ ...eq, createdBy: adminUser._id, isActive: true });
      createdQuestionIds.add(q._id);
    }

    // -------------------------------------------------------------
    // ASSESSMENT ENGINE & SECURITY TESTS (TC-11 to TC-18)
    // -------------------------------------------------------------

    // TC-11: Student can generate an assessment across selected topics
    const genRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentAToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        questionCount: 5,
      }),
    });
    const assessmentAId = genRes.data?.data?._id;
    if (assessmentAId) createdAssessmentIds.add(assessmentAId);
    recordTest('TC-11', 'Assessment Generation', 'Student generates assessment across topics', genRes.status === 201 && genRes.data?.data?.questions?.length === 5, `Status: ${genRes.status}, Count: ${genRes.data?.data?.questions?.length}`);

    // TC-12: Assessment generation fails if topics array is empty
    const badGenRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentBToken}` },
      body: JSON.stringify({ selectedTopics: [], questionCount: 5 }),
    });
    recordTest('TC-12', 'Validation', 'Assessment generation rejects empty selectedTopics', badGenRes.status === 400, `Status: ${badGenRes.status}`);

    // TC-13: In-progress assessment payload NEVER contains correctAnswer or explanation (Safeguard 1)
    const inProgressPayload = genRes.data?.data;
    let answerExposed = false;
    let explanationExposed = false;
    inProgressPayload?.questions?.forEach((q) => {
      if (q.correctAnswer !== undefined) answerExposed = true;
      if (q.content?.en?.explanation) explanationExposed = true;
    });
    const tc13Passed = !answerExposed && !explanationExposed && inProgressPayload?.scoring === undefined;
    recordTest('TC-13', 'Security (Safeguard 1)', 'In-progress assessment scrubs correctAnswer, explanation & scoring', tc13Passed, `Answer Exposed: ${answerExposed}, Expl Exposed: ${explanationExposed}`);

    // TC-14: Student cannot generate a new assessment while another is in_progress
    const dupGenRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentAToken}` },
      body: JSON.stringify({ selectedTopics: ['JavaScript'], questionCount: 3 }),
    });
    recordTest('TC-14', 'Lifecycle', 'Student cannot generate second assessment while one is in-progress', dupGenRes.status === 400 && dupGenRes.data?.message?.includes('already have an assessment'), `Status: ${dupGenRes.status}`);

    // TC-15: Student B cannot view Student A's in-progress assessment (403 Forbidden - Safeguard 2)
    const crossStudentRes = await request(`/assessments/${assessmentAId}`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    recordTest('TC-15', 'Authorization (Safeguard 2)', 'Cross-student access to assessment is blocked (403)', crossStudentRes.status === 403, `Status: ${crossStudentRes.status}`);

    // TC-16: Unassigned Trainer cannot view Student A's assessment (403 Forbidden - Safeguard 2 interim policy)
    // Student A has assignedTrainer: null
    const trainerUnassignedRes = await request(`/assessments/${assessmentAId}`, {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    recordTest('TC-16', 'Authorization (Safeguard 2)', 'Trainer cannot view assessment of unassigned student (403)', trainerUnassignedRes.status === 403, `Status: ${trainerUnassignedRes.status}`);

    // TC-17: Admin can view Student A's assessment
    const adminViewRes = await request(`/assessments/${assessmentAId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordTest('TC-17', 'Authorization (Safeguard 2)', 'Admin can view any student assessment', adminViewRes.status === 200 && adminViewRes.data?.data?._id === assessmentAId, `Status: ${adminViewRes.status}`);

    // TC-18: Immutable snapshot test: Modifying question bank does not alter in-progress assessment snapshot
    const snapQId = inProgressPayload?.questions[0]?.questionId;
    await Question.findByIdAndUpdate(snapQId, { 'content.en.question': 'MODIFIED IN BANK LATER' });
    const verifySnapRes = await request(`/assessments/${assessmentAId}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const snapshottedQuestionText = verifySnapRes.data?.data?.questions?.find((q) => q.questionId === snapQId)?.content?.en?.question;
    const tc18Passed = snapshottedQuestionText !== 'MODIFIED IN BANK LATER';
    recordTest('TC-18', 'Snapshot Integrity', 'In-progress assessment snapshot is immune to question bank edits', tc18Passed, `Snapshot preserved: ${tc18Passed}`);

    // -------------------------------------------------------------
    // SUBMISSION & SCORING TESTS (TC-19 to TC-25)
    // -------------------------------------------------------------

    // Fetch the actual answers from the database to construct a predictable submission
    const rawAssessment = await Assessment.findById(assessmentAId).select('+questions.correctAnswer');
    const answersPayload = [];

    // Let's answer the first MCQ correctly, and any remaining MCQs incorrectly or unanswered
    let firstMcqChecked = false;
    let textQuestionPresent = false;

    rawAssessment.questions.forEach((q) => {
      if (q.type === 'mcq') {
        if (!firstMcqChecked) {
          answersPayload.push({ questionId: q.questionId, answer: q.correctAnswer });
          firstMcqChecked = true;
        } else {
          answersPayload.push({ questionId: q.questionId, answer: 'WRONG_ANSWER' });
        }
      } else if (q.type === 'text') {
        textQuestionPresent = true;
        answersPayload.push({ questionId: q.questionId, answer: 'My technical text answer' });
      }
    });

    // TC-19: Student submits assessment and receives deterministic evaluation
    const submitRes = await request(`/assessments/${assessmentAId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentAToken}` },
      body: JSON.stringify({ answers: answersPayload }),
    });
    recordTest('TC-19', 'Submission & Scoring', 'Student submits assessment and receives immediate evaluation', submitRes.status === 200 && submitRes.data?.data?.status === 'completed', `Status: ${submitRes.status}`);

    // TC-20: Objective score is calculated strictly and accurately
    const scoring = submitRes.data?.data?.scoring;
    const tc20Passed = scoring?.objectiveScore === 1 && scoring?.objectiveMaxScore >= 1;
    recordTest('TC-20', 'Scoring Accuracy', 'Objective score accurately reflects evaluated MCQ answers (1 point)', tc20Passed, `Score: ${scoring?.objectiveScore}/${scoring?.objectiveMaxScore}`);

    // TC-21: Text questions remain pending_evaluation with isCorrect: null
    const textQInRes = submitRes.data?.data?.questions?.find((q) => q.type === 'text');
    const tc21Passed = !textQInRes || (textQInRes.evaluationStatus === 'pending_evaluation' && textQInRes.isCorrect === null);
    recordTest('TC-21', 'Boundary Check', 'Text questions remain pending_evaluation awaiting Module 4', tc21Passed, `Status: ${textQInRes?.evaluationStatus}`);

    // TC-22: Weak topics are detected when objective score < 60%
    const topicWise = submitRes.data?.data?.topicWiseResults;
    const weakTopics = submitRes.data?.data?.weakTopics;
    const hasWeakTopic = Array.isArray(weakTopics) && weakTopics.length > 0;
    recordTest('TC-22', 'Diagnostic', 'Weak topics diagnosed when topic objective accuracy < 60%', hasWeakTopic, `Weak topics: ${weakTopics?.join(', ')}`);

    // TC-23: Duplicate submission is rejected (Safeguard 3)
    const dupSubmitRes = await request(`/assessments/${assessmentAId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentAToken}` },
      body: JSON.stringify({ answers: answersPayload }),
    });
    recordTest('TC-23', 'Atomic Submission (Safeguard 3)', 'Resubmitting completed assessment rejected with 400', dupSubmitRes.status === 400, `Status: ${dupSubmitRes.status}`);

    // TC-24: Post-submission results endpoint reveals explanations and correct answers
    const resultsRes = await request(`/assessments/${assessmentAId}/results`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const resQ1 = resultsRes.data?.data?.questions[0];
    const explanationsRevealed = resQ1?.content?.en?.explanation !== undefined;
    recordTest('TC-24', 'Results Reporting', 'Completed assessment reveals explanations & weak topic diagnostics', resultsRes.status === 200 && explanationsRevealed, `Status: ${resultsRes.status}`);

    // TC-25: Accessing /results on an in-progress assessment is rejected with 400
    // Generate a fresh assessment for Student B and test /results before submission
    const genBRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentBToken}` },
      body: JSON.stringify({ selectedTopics: ['JavaScript', 'React', 'Node.js', 'MongoDB'], questionCount: 5 }),
    });
    const assessmentBId = genBRes.data?.data?._id;
    if (assessmentBId) createdAssessmentIds.add(assessmentBId);

    const prematureResultsRes = await request(`/assessments/${assessmentBId}/results`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    recordTest('TC-25', 'Results Guard', 'Accessing /results on in-progress assessment is rejected (400)', prematureResultsRes.status === 400, `Status: ${prematureResultsRes.status}`);

    // Mark Student B's assessment as completed so student B can perform subsequent generation tests
    await Assessment.findByIdAndUpdate(assessmentBId, { status: 'completed' });

    // -------------------------------------------------------------
    // REGRESSION TESTS FOR MODULES 1 & 2
    // -------------------------------------------------------------

    // TC-26: Health check returns 200 and healthy DB connection
    const healthRes = await request('/health');
    const tc26Passed = healthRes.status === 200 && healthRes.data?.database?.status === 'connected';
    recordTest('TC-26', 'Regression M1', 'Health check returns 200 and connected status', tc26Passed, `Status: ${healthRes.status}`);

    // TC-27: Auth profile endpoint (/api/auth/me) functions correctly with valid token
    const meRes = await request('/auth/me', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    recordTest('TC-27', 'Regression M2', 'Authenticated /api/auth/me reloads user profile correctly', meRes.status === 200 && meRes.data?.user?.email?.toLowerCase().includes('studenta'), `Status: ${meRes.status}`);

    // TC-28: Student /my assessments listing works and returns student assessments
    const myAssessmentsRes = await request('/assessments/my', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    recordTest('TC-28', 'Student History', 'Student can list their own past assessments', myAssessmentsRes.status === 200 && myAssessmentsRes.data?.count >= 1, `Count: ${myAssessmentsRes.data?.count}`);

    // TC-29: Assessment generation rejects invalid mode (400)
    const invalidModeRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentBToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript', 'React'],
        questionCount: 3,
        mode: 'voice_ai', // unsupported mode
      }),
    });
    recordTest('TC-29', 'Assessment Mode', 'Rejects invalid assessment mode with 400', invalidModeRes.status === 400 && invalidModeRes.data?.message?.includes('Invalid assessment mode'), `Status: ${invalidModeRes.status}, Msg: ${invalidModeRes.data?.message}`);

    // TC-30: Assessment generation with mode='mcq' generates strictly MCQ questions
    const mcqModeRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentBToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        questionCount: 4,
        mode: 'mcq',
      }),
    });
    const mcqAssessmentId = mcqModeRes.data?.data?._id;
    if (mcqAssessmentId) createdAssessmentIds.add(mcqAssessmentId);
    const allMcq = mcqModeRes.data?.data?.questions?.every((q) => q.type === 'mcq');
    recordTest('TC-30', 'Assessment Mode', 'mode="mcq" generates strictly MCQ questions', mcqModeRes.status === 201 && allMcq && mcqModeRes.data?.data?.mode === 'mcq', `Status: ${mcqModeRes.status}, All MCQ: ${allMcq}, Mode: ${mcqModeRes.data?.data?.mode}, Msg: ${mcqModeRes.data?.message}`);

    // TC-31: Assessment generation with mode='text' fails gracefully when insufficient text questions exist
    // Student A has completed their test, so we test text mode on student A
    const textModeRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentAToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        questionCount: 5,
        mode: 'text', // Only 1 text question exists in test setup, requested 5
      }),
    });
    recordTest('TC-31', 'Assessment Mode', 'mode="text" rejects with informative message if insufficient text questions', textModeRes.status === 400 && textModeRes.data?.message?.includes('Not enough active text/descriptive questions'), `Status: ${textModeRes.status}, Message: ${textModeRes.data?.message}`);

  } catch (err) {
    caughtError = err;
    console.error('\nFatal Error encountered during test execution:', err.message);
  } finally {
    // -------------------------------------------------------------
    // GUARANTEED ISOLATED CLEANUP (Safeguard 4)
    // -------------------------------------------------------------
    console.log('\n--- Running Isolated Teardown & Cleanup ---');
    try {
      // Delete strictly created records from the dedicated test database
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
      // Close HTTP server and Mongoose connection
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
    console.log(`\n=== Module 3 Test Suite Summary: ${passedCount}/${total} PASSED ===\n`);

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
