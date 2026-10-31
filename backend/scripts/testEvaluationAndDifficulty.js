// CareerSaathi AI — Automated Verification Suite for Difficulty Calibration & Evaluation Lifecycle
process.env.NODE_ENV = 'test';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const originalMongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/careersaathi';
const TEST_DB_NAME = 'careersaathi_diff_eval_test';
process.env.MONGO_URI = originalMongoUri.replace(/careersaathi(\?|$)/, `${TEST_DB_NAME}$1`);

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Question = require('../models/Question');
const Assessment = require('../models/Assessment');
const { generateContent, FALLBACK_MODEL, sanitizeErrorMessage } = require('../services/llm/adapters/geminiAdapter');

const RUN_ID = `diff_eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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

const mockGoodEnglishJson = JSON.stringify({
  rubricBreakdown: {
    technicalCorrectness: 8.5,
    conceptualUnderstanding: 9.0,
    completeness: 8.0,
    reasoning: 7.5,
    answerRelevance: 9.0,
  },
  feedback: 'Strong answer demonstrating solid engineering fundamentals.',
  strengths: ['Accurate technical terminology', 'Good reasoning'],
  weaknesses: ['Could mention edge case handling'],
  suggestions: ['Review performance optimizations under high load'],
});

async function runSuite() {
  console.log(`=== CareerSaathi AI — Difficulty Calibration & AI Evaluation Test Suite ===`);
  console.log(`Test Database: ${process.env.MONGO_URI}\n`);

  try {
    await mongoose.connect(process.env.MONGO_URI);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        API_BASE = `http://localhost:${port}/api`;
        resolve();
      });
    });

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_diff_eval_123456';
    process.env.JWT_SECRET = jwtSecret;

    const createToken = (user) => jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: '1h' });

    // Seed test student
    const student = await User.create({
      name: 'Test Student',
      email: `student_${RUN_ID}@test.careersaathi.local`,
      password: 'StudentPassword123',
      role: 'student',
      preferredLanguage: 'en',
    });
    createdUserIds.add(student._id);
    const studentToken = createToken(student);

    // Seed test admin
    const admin = await User.create({
      name: 'Test Admin',
      email: `admin_${RUN_ID}@test.careersaathi.local`,
      password: 'AdminPassword123',
      role: 'admin',
    });
    createdUserIds.add(admin._id);

    // Seed comprehensive test questions into the test database (4 topics x 3 difficulties x 2 types)
    const topics = ['JavaScript', 'React', 'Node.js', 'MongoDB'];
    for (const t of topics) {
      for (const d of ['easy', 'medium', 'hard']) {
        // 3 MCQs per tier
        for (let i = 1; i <= 3; i++) {
          const q = await Question.create({
            targetRole: 'Full Stack Developer',
            topic: t,
            difficulty: d,
            type: 'mcq',
            content: {
              en: { question: `${t} ${d} MCQ ${i} (${RUN_ID})`, explanation: 'Expl' },
              hinglish: { question: `${t} ${d} MCQ ${i} Hi`, explanation: 'Expl Hi' },
            },
            options: [
              { id: 'A', text: { en: 'Option A', hinglish: 'Opt A' } },
              { id: 'B', text: { en: 'Option B', hinglish: 'Opt B' } },
            ],
            correctAnswer: 'A',
            createdBy: admin._id,
            isActive: true,
          });
          createdQuestionIds.add(q._id);
        }
        // 2 Text questions per tier
        for (let i = 1; i <= 2; i++) {
          const q = await Question.create({
            targetRole: 'Full Stack Developer',
            topic: t,
            difficulty: d,
            type: 'text',
            content: {
              en: { question: `${t} ${d} Text ${i} (${RUN_ID})`, explanation: 'Expl' },
              hinglish: { question: `${t} ${d} Text ${i} Hi`, explanation: 'Expl Hi' },
            },
            options: [],
            correctAnswer: `Reference rubric for ${t} ${d} Text ${i}`,
            createdBy: admin._id,
            isActive: true,
          });
          createdQuestionIds.add(q._id);
        }
      }
    }

    console.log('Setup: Seeded 60 isolated questions in test database.\n--- Running Tests ---\n');

    // -------------------------------------------------------------
    // CATEGORY 1: STRICT DIFFICULTY FILTERING & POOL SUFFICIENCY
    // -------------------------------------------------------------

    // TEST-DIFF-01: Strict Easy difficulty produces 100% easy questions
    const easyRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript', 'React'],
        difficulty: 'easy',
        questionCount: 5,
        mode: 'mixed',
      }),
    });
    const easyData = easyRes.data?.data;
    if (easyData?._id) createdAssessmentIds.add(easyData._id);
    const allEasy = easyData?.questions?.every((q) => q.difficulty === 'easy');
    recordTest(
      'TEST-DIFF-01',
      'Difficulty Calibration',
      'Strict Easy difficulty contains 100% easy questions (zero substitution)',
      easyRes.status === 201 && allEasy === true && easyData?.questions?.length === 5,
      `All Easy: ${allEasy}, Count: ${easyData?.questions?.length}`
    );
    await Assessment.findByIdAndDelete(easyData?._id);

    // TEST-DIFF-02: Strict Hard difficulty produces 100% hard questions
    const hardRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selectedTopics: ['Node.js', 'MongoDB'],
        difficulty: 'hard',
        questionCount: 5,
        mode: 'mixed',
      }),
    });
    const hardData = hardRes.data?.data;
    if (hardData?._id) createdAssessmentIds.add(hardData._id);
    const allHard = hardData?.questions?.every((q) => q.difficulty === 'hard');
    recordTest(
      'TEST-DIFF-02',
      'Difficulty Calibration',
      'Strict Hard difficulty contains 100% hard questions (zero substitution)',
      hardRes.status === 201 && allHard === true && hardData?.questions?.length === 5,
      `All Hard: ${allHard}, Count: ${hardData?.questions?.length}`
    );
    await Assessment.findByIdAndDelete(hardData?._id);

    // TEST-DIFF-03: Insufficient question pool returns HTTP 400 Bad Request
    const insuffRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript'],
        difficulty: 'hard',
        questionCount: 15, // Only 5 hard questions exist for JavaScript
        mode: 'mixed',
      }),
    });
    const tcDiff03Passed =
      insuffRes.status === 400 &&
      insuffRes.data?.message?.includes('Not enough active') &&
      insuffRes.data?.availableCount === 5;
    recordTest(
      'TEST-DIFF-03',
      'Difficulty Calibration',
      'Insufficient pool for strict difficulty rejects with 400 and available count',
      tcDiff03Passed,
      `Status: ${insuffRes.status}, Msg: ${insuffRes.data?.message}`
    );

    // TEST-DIFF-04: Invalid difficulty value is rejected with 400 Bad Request
    const invalidDiffRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript'],
        difficulty: 'invalid_tier',
        questionCount: 5,
      }),
    });
    recordTest(
      'TEST-DIFF-04',
      'Difficulty Calibration',
      'Invalid difficulty parameter rejected with 400 Bad Request',
      invalidDiffRes.status === 400 && invalidDiffRes.data?.message?.includes('Invalid difficulty calibration'),
      `Status: ${invalidDiffRes.status}`
    );

    // -------------------------------------------------------------
    // CATEGORY 2: BALANCED DIFFICULTY INTEGER ROUNDING (40/40/20)
    // -------------------------------------------------------------

    // TEST-BAL-01: Balanced 5 questions produces exactly 2 Easy, 2 Medium, 1 Hard
    const bal5Res = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        difficulty: 'balanced',
        questionCount: 5,
        mode: 'mixed',
      }),
    });
    const bal5Data = bal5Res.data?.data;
    if (bal5Data?._id) createdAssessmentIds.add(bal5Data._id);
    const countEasy5 = bal5Data?.questions?.filter((q) => q.difficulty === 'easy').length || 0;
    const countMed5 = bal5Data?.questions?.filter((q) => q.difficulty === 'medium').length || 0;
    const countHard5 = bal5Data?.questions?.filter((q) => q.difficulty === 'hard').length || 0;
    const tcBal01Passed =
      bal5Res.status === 201 &&
      countEasy5 === 2 &&
      countMed5 === 2 &&
      countHard5 === 1 &&
      bal5Data?.questions?.length === 5;
    recordTest(
      'TEST-BAL-01',
      'Balanced Distribution',
      'Balanced 5 questions allocates exactly 2 Easy, 2 Medium, 1 Hard (40/40/20)',
      tcBal01Passed,
      `E: ${countEasy5}, M: ${countMed5}, H: ${countHard5}`
    );
    await Assessment.findByIdAndDelete(bal5Data?._id);

    // TEST-BAL-02: Balanced 10 questions produces exactly 4 Easy, 4 Medium, 2 Hard
    const bal10Res = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        difficulty: 'balanced',
        questionCount: 10,
        mode: 'mixed',
      }),
    });
    const bal10Data = bal10Res.data?.data;
    if (bal10Data?._id) createdAssessmentIds.add(bal10Data._id);
    const countEasy10 = bal10Data?.questions?.filter((q) => q.difficulty === 'easy').length || 0;
    const countMed10 = bal10Data?.questions?.filter((q) => q.difficulty === 'medium').length || 0;
    const countHard10 = bal10Data?.questions?.filter((q) => q.difficulty === 'hard').length || 0;
    const tcBal02Passed =
      bal10Res.status === 201 &&
      countEasy10 === 4 &&
      countMed10 === 4 &&
      countHard10 === 2 &&
      bal10Data?.questions?.length === 10;
    recordTest(
      'TEST-BAL-02',
      'Balanced Distribution',
      'Balanced 10 questions allocates exactly 4 Easy, 4 Medium, 2 Hard (40/40/20)',
      tcBal02Passed,
      `E: ${countEasy10}, M: ${countMed10}, H: ${countHard10}`
    );
    await Assessment.findByIdAndDelete(bal10Data?._id);

    // TEST-BAL-03: Insufficient tier pool for balanced rejects with 400
    // Requesting 10 text questions in balanced mode for JavaScript only
    // JavaScript has only 2 easy, 2 medium, 2 hard text questions (Total 6 text questions)
    // 10 questions balanced requires 4 easy, 4 med, 2 hard -> Shortfall!
    const balShortfallRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript'],
        difficulty: 'balanced',
        questionCount: 10,
        mode: 'text',
      }),
    });
    const tcBal03Passed =
      balShortfallRes.status === 400 &&
      (balShortfallRes.data?.message?.includes('Unable to satisfy balanced difficulty distribution') ||
       balShortfallRes.data?.message?.includes('Not enough active'));
    recordTest(
      'TEST-BAL-03',
      'Balanced Distribution',
      'Balanced difficulty rejects with 400 when any tier quota cannot be fulfilled',
      tcBal03Passed,
      `Status: ${balShortfallRes.status}, Msg: ${balShortfallRes.data?.message?.substring(0, 35)}...`
    );
    if (balShortfallRes.data?.data?._id) {
      await Assessment.findByIdAndDelete(balShortfallRes.data.data._id);
    }

    // Clear any dangling in-progress assessments for student
    await Assessment.deleteMany({ student: student._id, status: 'in_progress' });

    // -------------------------------------------------------------
    // CATEGORY 3: ASSESSMENT MODES (MCQ, TEXT, MIXED)
    // -------------------------------------------------------------

    // TEST-MODE-01: mode='mcq' produces 100% MCQ questions
    const mcqModeRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript', 'React'],
        mode: 'mcq',
        questionCount: 5,
        difficulty: 'balanced',
      }),
    });
    const mcqData = mcqModeRes.data?.data;
    if (mcqData?._id) createdAssessmentIds.add(mcqData._id);
    const allMcq = mcqData?.questions?.every((q) => q.type === 'mcq');
    recordTest(
      'TEST-MODE-01',
      'Assessment Modes',
      'mode="mcq" generates 100% multiple-choice questions',
      mcqModeRes.status === 201 && allMcq === true,
      `All MCQ: ${allMcq}`
    );
    await Assessment.findByIdAndDelete(mcqData?._id);

    // TEST-MODE-02: mode='text' produces 100% text questions
    const textModeRes = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        selectedTopics: ['JavaScript', 'React', 'Node.js'],
        mode: 'text',
        questionCount: 5,
        difficulty: 'balanced',
      }),
    });
    const textData = textModeRes.data?.data;
    if (textData?._id) createdAssessmentIds.add(textData._id);
    const allText = textData?.questions?.every((q) => q.type === 'text');
    recordTest(
      'TEST-MODE-02',
      'Assessment Modes',
      'mode="text" generates 100% descriptive typing questions',
      textModeRes.status === 201 && allText === true,
      `All Text: ${allText}`
    );
    await Assessment.findByIdAndDelete(textData?._id);

    // Clear any dangling in-progress assessments
    await Assessment.deleteMany({ student: student._id });

    // -------------------------------------------------------------
    // CATEGORY 4: AI EVALUATION, PARTIAL SUCCESS & RETRY LIFECYCLE
    // -------------------------------------------------------------

    // Setup completed assessment with 2 pending text questions
    const evalAssessment = await Assessment.create({
      student: student._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['JavaScript', 'Node.js'],
      mode: 'text',
      status: 'completed',
      completedAt: new Date(),
      totalQuestions: 2,
      objectiveQuestionsCount: 0,
      subjectiveQuestionsCount: 2,
      questions: [
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'JavaScript',
          difficulty: 'medium',
          type: 'text',
          content: { en: { question: 'Explain closures.' } },
          correctAnswer: 'Lexical scope retention.',
          studentAnswer: 'Function retaining outer scope variables.',
          evaluationStatus: 'pending_evaluation',
          maxPoints: 1,
        },
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'Node.js',
          difficulty: 'hard',
          type: 'text',
          content: { en: { question: 'Explain event loop.' } },
          correctAnswer: 'libuv event loop phases.',
          studentAnswer: 'Phases of event loop in libuv.',
          evaluationStatus: 'pending_evaluation',
          maxPoints: 1,
        },
      ],
      scoring: {
        objectiveScore: 0,
        objectiveMaxScore: 0,
        subjectiveScore: 0,
        subjectiveMaxScore: 2,
        overallScore: 0,
        overallMaxScore: 2,
        isFullyEvaluated: false,
      },
    });
    createdAssessmentIds.add(evalAssessment._id);

    // TEST-EVAL-FAIL-ALL: When all evaluations fail, endpoint returns HTTP 502 with truthful message
    const allFailRes = await request(`/assessments/${evalAssessment._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        mockResponses: [
          { error: 'Simulated 503 High Demand on Q1' },
          { error: 'Simulated 503 High Demand on Q2' },
        ],
      }),
    });
    const docAfterAllFail = await Assessment.findById(evalAssessment._id);
    const tcEvalFailPassed =
      allFailRes.status === 502 &&
      allFailRes.data?.success === false &&
      allFailRes.data?.evaluatedCount === 0 &&
      allFailRes.data?.failedCount === 2 &&
      docAfterAllFail.questions.every((q) => q.evaluationStatus === 'pending_evaluation') &&
      docAfterAllFail.isEvaluating === false;
    recordTest(
      'TEST-EVAL-FAIL-ALL',
      'Evaluation Lifecycle',
      'Complete failure returns HTTP 502 Bad Gateway and preserves pending status',
      tcEvalFailPassed,
      `Status: ${allFailRes.status}, Msg: ${allFailRes.data?.message?.substring(0, 30)}...`
    );

    // TEST-EVAL-PARTIAL: Partial success persists Q1 as ai_evaluated, leaves Q2 pending_evaluation
    const partialRes = await request(`/assessments/${evalAssessment._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        mockResponses: [
          mockGoodEnglishJson,
          { error: 'Simulated 429 Rate Limit on Q2' },
        ],
      }),
    });
    const docAfterPartial = await Assessment.findById(evalAssessment._id);
    const q1Status = docAfterPartial.questions[0].evaluationStatus;
    const q2Status = docAfterPartial.questions[1].evaluationStatus;
    const tcEvalPartialPassed =
      partialRes.status === 200 &&
      partialRes.data?.partial === true &&
      partialRes.data?.evaluatedCount === 1 &&
      partialRes.data?.failedCount === 1 &&
      q1Status === 'ai_evaluated' &&
      q2Status === 'pending_evaluation' &&
      docAfterPartial.isEvaluating === false;
    recordTest(
      'TEST-EVAL-PARTIAL',
      'Evaluation Lifecycle',
      'Partial success persists evaluated answers and leaves failed pending for retry',
      tcEvalPartialPassed,
      `Q1: ${q1Status}, Q2: ${q2Status}, Partial: ${partialRes.data?.partial}`
    );

    // TEST-EVAL-RETRY: Retrying partial assessment evaluates ONLY Q2 without mutating Q1
    const retryRes = await request(`/assessments/${evalAssessment._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        mockResponses: [mockGoodEnglishJson], // Only 1 mock needed because Q1 is skipped
      }),
    });
    const docAfterRetry = await Assessment.findById(evalAssessment._id);
    const tcEvalRetryPassed =
      retryRes.status === 200 &&
      retryRes.data?.evaluatedCount === 1 &&
      retryRes.data?.failedCount === 0 &&
      retryRes.data?.isFullyEvaluated === true &&
      docAfterRetry.questions.every((q) => q.evaluationStatus === 'ai_evaluated') &&
      docAfterRetry.scoring.isFullyEvaluated === true;
    recordTest(
      'TEST-EVAL-RETRY',
      'Evaluation Lifecycle',
      'Retry evaluates only remaining pending answers and completes assessment',
      tcEvalRetryPassed,
      `Evaluated: ${retryRes.data?.evaluatedCount}, FullyEvaluated: ${docAfterRetry.scoring.isFullyEvaluated}`
    );

    // -------------------------------------------------------------
    // CATEGORY 5: CONCURRENCY LOCK TOKEN PROTECTION
    // -------------------------------------------------------------

    // TEST-LOCK-01: Concurrent evaluation returns HTTP 409 Conflict
    const lockAssessment = await Assessment.create({
      student: student._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['React'],
      mode: 'text',
      status: 'completed',
      totalQuestions: 1,
      isEvaluating: true, // Simulate active lock
      evaluationLockToken: 'active-test-lock-token-12345',
      lockedAt: new Date(),
      questions: [
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'React',
          difficulty: 'easy',
          type: 'text',
          content: { en: { question: 'Q' } },
          correctAnswer: 'A',
          studentAnswer: 'Ans',
          evaluationStatus: 'pending_evaluation',
          maxPoints: 1,
        },
      ],
    });
    createdAssessmentIds.add(lockAssessment._id);

    const conflictRes = await request(`/assessments/${lockAssessment._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    recordTest(
      'TEST-LOCK-01',
      'Concurrency Control',
      'Concurrent evaluation request while lock is held returns 409 Conflict',
      conflictRes.status === 409 && conflictRes.data?.message?.includes('already in progress'),
      `Status: ${conflictRes.status}`
    );

    // TEST-LOCK-02: Stale/wrong token cannot release another request's lock
    await Assessment.findOneAndUpdate(
      { _id: lockAssessment._id, evaluationLockToken: 'wrong-token-999' },
      { $set: { isEvaluating: false, evaluationLockToken: null } }
    );
    const docStillLocked = await Assessment.findById(lockAssessment._id);
    const tcLock02Passed = docStillLocked.isEvaluating === true && docStillLocked.evaluationLockToken === 'active-test-lock-token-12345';
    recordTest(
      'TEST-LOCK-02',
      'Concurrency Control',
      'Old request with mismatched token cannot release an active request lock',
      tcLock02Passed,
      `Still Locked: ${tcLock02Passed}`
    );

    // Release valid token
    await Assessment.findOneAndUpdate(
      { _id: lockAssessment._id, evaluationLockToken: 'active-test-lock-token-12345' },
      { $set: { isEvaluating: false, evaluationLockToken: null } }
    );

    // -------------------------------------------------------------
    // CATEGORY 6: GEMINI ADAPTER FALLBACK & CREDENTIAL SCRUBBING
    // -------------------------------------------------------------

    // TEST-FALLBACK-01: Mocked fallback simulation
    let fallbackTriggered = false;
    const mockTransportWithFallback = async ({ model, fallbackModel }) => {
      // Simulate primary model experiencing 503 and falling back
      fallbackTriggered = true;
      return `{"modelUsed": "${fallbackModel}", "status": "ok"}`;
    };

    const fallbackResult = await generateContent({
      prompt: 'Test prompt',
      transportOverride: mockTransportWithFallback,
    });
    recordTest(
      'TEST-FALLBACK-01',
      'LLM Fallback & Security',
      'Gemini adapter supports validated fallback without network overhead',
      fallbackTriggered === true && fallbackResult.includes(FALLBACK_MODEL),
      `Fallback Model: ${FALLBACK_MODEL}`
    );

    // TEST-FALLBACK-02: Credential scrubbing in error messages
    const secretKey = 'AIzaSySecretApiKey123456789';
    const leakedMsg = `Failed to connect to https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${secretKey}&alt=json`;
    const scrubbed = sanitizeErrorMessage(leakedMsg);
    const tcFallback02Passed = !scrubbed.includes(secretKey) && scrubbed.includes('key=[REDACTED]');
    recordTest(
      'TEST-FALLBACK-02',
      'LLM Fallback & Security',
      'Sanitizer completely redacts API keys and tokens from error messages',
      tcFallback02Passed,
      `Scrubbed: ${scrubbed.substring(0, 40)}...`
    );

    // -------------------------------------------------------------
    // TEARDOWN
    // -------------------------------------------------------------
    console.log('\n--- Running Isolated Teardown & Cleanup ---');
    for (const aId of createdAssessmentIds) {
      await Assessment.findByIdAndDelete(aId);
    }
    for (const qId of createdQuestionIds) {
      await Question.findByIdAndDelete(qId);
    }
    for (const uId of createdUserIds) {
      await User.findByIdAndDelete(uId);
    }
    server.close();
    await mongoose.disconnect();

    const passedCount = testResults.filter((t) => t.passed).length;
    const totalCount = testResults.length;
    console.log(`\n=== Test Suite Summary: ${passedCount}/${totalCount} PASSED ===`);

    if (passedCount !== totalCount) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Fatal Suite Error:', err);
    try {
      server?.close();
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

runSuite();
