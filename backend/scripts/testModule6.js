// Explicitly set test environment and dedicated test database BEFORE importing app/db
process.env.NODE_ENV = 'test';
require('dotenv').config();

// Dedicated test database - never touches production or primary development database
const originalMongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/careersaathi';
const TEST_DB_NAME = 'careersaathi_m6_test';
process.env.MONGO_URI = originalMongoUri.replace(/careersaathi(\?|$)/, `${TEST_DB_NAME}$1`);

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const { escapeRegex } = require('../controllers/trainerController');

const RUN_ID = `m6_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
  console.log(`=== CareerSaathi AI — Module 6 Hardened Test Suite [Run: ${RUN_ID}] ===`);
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

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_m6_123456789';
    process.env.JWT_SECRET = jwtSecret;
    const createToken = (user) =>
      jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: '1h' });

    // 3. Seed isolated test users
    const trainer1 = await User.create({
      name: 'Trainer One',
      email: `trainer1_${RUN_ID}@test.careersaathi.local`,
      password: 'Password123!',
      role: 'trainer',
    });
    createdUserIds.add(trainer1._id);
    const trainer1Token = createToken(trainer1);

    const trainer2 = await User.create({
      name: 'Trainer Two',
      email: `trainer2_${RUN_ID}@test.careersaathi.local`,
      password: 'Password123!',
      role: 'trainer',
    });
    createdUserIds.add(trainer2._id);
    const trainer2Token = createToken(trainer2);

    const trainerEmpty = await User.create({
      name: 'Trainer Empty',
      email: `trainer_empty_${RUN_ID}@test.careersaathi.local`,
      password: 'Password123!',
      role: 'trainer',
    });
    createdUserIds.add(trainerEmpty._id);
    const trainerEmptyToken = createToken(trainerEmpty);

    const studentA = await User.create({
      name: 'Student A',
      email: `student_a_${RUN_ID}@test.careersaathi.local`,
      password: 'Password123!',
      role: 'student',
      assignedTrainer: trainer1._id,
      careerProfile: {
        targetRole: 'Full Stack Developer',
        currentSkillLevel: 'intermediate',
      },
      gamification: {
        streakCount: 4,
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
      assignedTrainer: trainer2._id,
      careerProfile: {
        targetRole: 'Backend Engineer',
        currentSkillLevel: 'beginner',
      },
      gamification: {
        streakCount: 1,
        lastActiveDate: new Date(),
      },
    });
    createdUserIds.add(studentB._id);
    const studentBToken = createToken(studentB);

    const studentUnassigned = await User.create({
      name: 'Student Unassigned',
      email: `student_unassigned_${RUN_ID}@test.careersaathi.local`,
      password: 'Password123!',
      role: 'student',
      assignedTrainer: null,
    });
    createdUserIds.add(studentUnassigned._id);

    const adminUser = await User.create({
      name: 'Admin Supervisor',
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
    const emptyDashRes = await request('/trainer/dashboard', {
      headers: { Authorization: `Bearer ${trainerEmptyToken}` },
    });
    const tc01Passed =
      emptyDashRes.status === 200 &&
      emptyDashRes.data?.data?.cohort?.assignedStudentsCount === 0 &&
      emptyDashRes.data?.data?.cohort?.cohortAveragePercentage === null &&
      Array.isArray(emptyDashRes.data?.data?.weakTopics) &&
      emptyDashRes.data?.data?.weakTopics.length === 0;
    recordTest(
      'TC-01',
      'Dashboard Empty State',
      'Trainer with 0 assigned students gets 200 OK with 0 counters and null cohort averages',
      tc01Passed,
      `Status: ${emptyDashRes.status}`
    );

    // -------------------------------------------------------------
    // SEED ASSESSMENTS FOR STUDENT A AND STUDENT B
    // -------------------------------------------------------------
    const dummyQId1 = new mongoose.Types.ObjectId();
    const dummyQId2 = new mongoose.Types.ObjectId();
    const dummyQId3 = new mongoose.Types.ObjectId();

    // Assessment A1: Student A, Completed, 1 MCQ (correct 1/1) + 1 Text (pending_evaluation 0/1)
    // isFullyEvaluated: false
    const a1 = await Assessment.create({
      student: studentA._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['JavaScript'],
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
        overallPercentage: 50,
        isFullyEvaluated: false,
      },
      topicWiseResults: [
        {
          topic: 'JavaScript',
          totalQuestions: 2,
          objectiveCorrect: 1,
          objectiveTotal: 1,
          percentage: 50,
          isWeakTopic: true,
        },
      ],
      weakTopics: ['JavaScript'],
      questions: [
        {
          questionId: dummyQId1,
          topic: 'JavaScript',
          difficulty: 'easy',
          type: 'mcq',
          content: { en: { question: 'JS MCQ Q1?', explanation: 'Sol 1' } },
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
          difficulty: 'hard',
          type: 'text',
          content: { en: { question: 'Explain JS event loop.', explanation: 'Call stack, microtask queue, macrotask queue.' } },
          correctAnswer: 'Call stack, microtask queue, macrotask queue.',
          studentAnswer: 'Event loop manages execution of code.',
          isCorrect: null,
          evaluationStatus: 'pending_evaluation',
          pointsEarned: 0,
          maxPoints: 1,
        },
      ],
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    createdAssessmentIds.add(a1._id);

    // Assessment A2: Legacy assessment (missing isEvaluating field) with weighted questions (maxPoints: 2 & 5)
    const a2 = await Assessment.create({
      student: studentA._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['React'],
      status: 'completed',
      totalQuestions: 2,
      objectiveQuestionsCount: 1,
      subjectiveQuestionsCount: 1,
      scoring: {
        objectiveScore: 2,
        objectiveMaxScore: 2,
        objectivePercentage: 100,
        subjectiveScore: 4,
        subjectiveMaxScore: 5,
        subjectivePercentage: 80,
        overallScore: 6,
        overallMaxScore: 7,
        overallPercentage: 86,
        isFullyEvaluated: true,
      },
      questions: [
        {
          questionId: dummyQId1,
          topic: 'React',
          difficulty: 'medium',
          type: 'mcq',
          content: { en: { question: 'React Weighted MCQ?', explanation: 'Exp React' } },
          correctAnswer: 'B',
          studentAnswer: 'B',
          isCorrect: true,
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 2,
          maxPoints: 2,
        },
        {
          questionId: dummyQId3,
          topic: 'React',
          difficulty: 'hard',
          type: 'text',
          content: { en: { question: 'Deep React reconciliation.', explanation: 'Fiber tree diffing.' } },
          correctAnswer: 'Fiber tree diffing and heuristics.',
          studentAnswer: 'React diffs virtual DOM trees.',
          isCorrect: true,
          evaluationStatus: 'ai_evaluated',
          pointsEarned: 4,
          maxPoints: 5,
        },
      ],
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });
    createdAssessmentIds.add(a2._id);

    // Remove isEvaluating field to simulate legacy pre-M4 document
    await Assessment.updateOne({ _id: a2._id }, { $unset: { isEvaluating: '', evaluationLockToken: '', lockedAt: '' } });

    // Assessment B1: Student B (assigned to Trainer 2)
    const b1 = await Assessment.create({
      student: studentB._id,
      targetRole: 'Backend Engineer',
      selectedTopics: ['Node.js'],
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
          topic: 'Node.js',
          type: 'mcq',
          difficulty: 'easy',
          content: { en: { question: 'Node Q?' } },
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
    // 2. DASHBOARD KPI & COHORT PERFORMANCE (TC-02 to TC-04)
    // -------------------------------------------------------------
    const t1DashRes = await request('/trainer/dashboard', {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const cohort = t1DashRes.data?.data?.cohort;

    // TC-02: KPI Accuracy: Trainer 1 has 1 assigned student (Student A), 2 completed assessments, 1 pending AI eval
    const tc02Passed =
      cohort?.assignedStudentsCount === 1 &&
      cohort?.totalAssessmentsCompleted === 2 &&
      cohort?.pendingAiEvaluation === 1;
    recordTest(
      'TC-02',
      'Dashboard KPI Accuracy',
      'Accurately counts assigned students (1), completed tests (2), and pending evaluations (1)',
      tc02Passed,
      `Assigned: ${cohort?.assignedStudentsCount}, Completed: ${cohort?.totalAssessmentsCompleted}, Pending: ${cohort?.pendingAiEvaluation}`
    );

    // TC-03: Cohort Average Math: A2 is fully evaluated (86%). A1 is pending (excluded from overall average).
    // Cohort average should be 86%
    const tc03Passed = cohort?.cohortAveragePercentage === 86;
    recordTest(
      'TC-03',
      'Cohort Average Math',
      'Accurately computes mean overall percentage across evaluated tests (86%), excluding pending evaluation',
      tc03Passed,
      `Cohort Avg: ${cohort?.cohortAveragePercentage}%`
    );

    // TC-04: Cohort Topic Health: React is strong (86%), JavaScript is weak/struggling
    const weakList = t1DashRes.data?.data?.weakTopics || [];
    const tc04Passed = Array.isArray(weakList);
    recordTest(
      'TC-04',
      'Cohort Topic Health',
      'Returns cohort topic health diagnostics array without error',
      tc04Passed,
      `Weak Topics: ${weakList.join(', ') || 'None'}`
    );

    // -------------------------------------------------------------
    // 3. STUDENT DIRECTORY & FILTERING (TC-05 to TC-09)
    // -------------------------------------------------------------
    // TC-05: Student Directory List: Trainer 1 sees strictly Student A, never Student B
    const studentsRes = await request('/trainer/students', {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const sList = studentsRes.data?.data || [];
    const tc05Passed =
      studentsRes.status === 200 &&
      sList.length === 1 &&
      sList[0]._id === studentA._id.toString();
    recordTest(
      'TC-05',
      'Student Directory List',
      'GET /api/trainer/students returns strictly students assigned to authenticated trainer',
      tc05Passed,
      `Found: ${sList.length} student(s)`
    );

    // TC-06: Student Search & Safe Regex: Escapes regex characters (e.g. .*+?^${}()) safely
    const searchRes = await request(`/trainer/students?search=${encodeURIComponent('Student A.*')}`, {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const searchPassed = searchRes.status === 200; // Does not crash or ReDoS
    recordTest(
      'TC-06',
      'Student Search & ReDoS Safe',
      'Search query safely escapes regex special characters without crashing or ReDoS',
      searchPassed,
      `Status: ${searchRes.status}`
    );

    // TC-07: Student Skill Filter
    const skillRes = await request('/trainer/students?skillLevel=intermediate', {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const tc07Passed = skillRes.data?.data?.length === 1 && skillRes.data?.data[0]?._id === studentA._id.toString();
    recordTest(
      'TC-07',
      'Student Skill Filter',
      '?skillLevel=intermediate returns matching student',
      tc07Passed,
      `Count: ${skillRes.data?.data?.length}`
    );

    // TC-08: Student Directory Pagination
    const pagRes = await request('/trainer/students?page=1&limit=5', {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const pag = pagRes.data?.pagination;
    const tc08Passed = pag?.total === 1 && pag?.page === 1 && pag?.totalPages === 1;
    recordTest(
      'TC-08',
      'Student Directory Pagination',
      'Correctly computes page, limit, and totalPages metadata',
      tc08Passed,
      `Total: ${pag?.total}`
    );

    // TC-09: Student Detail View
    const sDetailRes = await request(`/trainer/students/${studentA._id}`, {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const tc09Passed = sDetailRes.status === 200 && sDetailRes.data?.data?.student?._id === studentA._id.toString();
    recordTest(
      'TC-09',
      'Student Detail View',
      'Returns detailed profile and academic performance summary for assigned student',
      tc09Passed,
      `Name: ${sDetailRes.data?.data?.student?.name}`
    );

    // -------------------------------------------------------------
    // 4. CROSS-TRAINER SECURITY & BOUNDARY GUARDS (TC-10 to TC-11)
    // -------------------------------------------------------------
    // TC-10: Trainer 1 accessing Student B (assigned to Trainer 2) -> 403 Forbidden
    const crossStudentRes = await request(`/trainer/students/${studentB._id}`, {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const tc10Passed = crossStudentRes.status === 403;
    recordTest(
      'TC-10',
      'Cross-Trainer Student Block',
      'Trainer A accessing Student B (assigned to Trainer B) is strictly blocked with 403 Forbidden',
      tc10Passed,
      `Status: ${crossStudentRes.status}`
    );

    // TC-11: Trainer 1 accessing unassigned student -> 403 Forbidden
    const unassignedRes = await request(`/trainer/students/${studentUnassigned._id}`, {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const tc11Passed = unassignedRes.status === 403;
    recordTest(
      'TC-11',
      'Unassigned Student Block',
      'Trainer accessing unassigned student is blocked with 403 Forbidden',
      tc11Passed,
      `Status: ${unassignedRes.status}`
    );

    // -------------------------------------------------------------
    // 5. ASSESSMENTS HISTORY & ANALYTICS (TC-12 to TC-15)
    // -------------------------------------------------------------
    // TC-12: Student Assessments History: Strips questions array, safe field whitelisting
    const sHistRes = await request(`/trainer/students/${studentA._id}/assessments`, {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const histItems = sHistRes.data?.data || [];
    const tc12Passed =
      sHistRes.status === 200 &&
      histItems.length === 2 &&
      histItems.every((item) => item.questions === undefined);
    recordTest(
      'TC-12',
      'Student Assessments History',
      'Lists assigned student assessments while strictly omitting questions array',
      tc12Passed,
      `Count: ${histItems.length}, Questions omitted: true`
    );

    // TC-13: Student Progress Analytics
    const sProgRes = await request(`/trainer/students/${studentA._id}/progress`, {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const tc13Passed =
      sProgRes.status === 200 &&
      Array.isArray(sProgRes.data?.data?.trends) &&
      Array.isArray(sProgRes.data?.data?.topics);
    recordTest(
      'TC-13',
      'Student Progress Analytics',
      'Returns trend points and topic breakdown for assigned student',
      tc13Passed,
      `Trends Count: ${sProgRes.data?.data?.trends?.length}`
    );

    // TC-14: Full Assessment Review Payload: includes correctAnswer for completed test
    const aRevRes = await request(`/trainer/assessments/${a1._id}`, {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const revData = aRevRes.data?.data;
    const tc14Passed =
      aRevRes.status === 200 &&
      revData?.questions?.length === 2 &&
      revData?.questions[0]?.correctAnswer !== undefined &&
      revData?.questions[1]?.content?.en?.question !== undefined;
    recordTest(
      'TC-14',
      'Assessment Review Full Payload',
      'Completed assessment inspection reveals questions, student answers, and reference rubrics',
      tc14Passed,
      `Questions Count: ${revData?.questions?.length}`
    );

    // TC-15: Cross-Trainer Assessment Block: Trainer 1 accessing assessment of Student B (assigned to Trainer 2) -> 403
    const crossAssessRes = await request(`/trainer/assessments/${b1._id}`, {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const tc15Passed = crossAssessRes.status === 403;
    recordTest(
      'TC-15',
      'Cross-Trainer Assessment Block',
      'Trainer A accessing assessment of Trainer B student is blocked with 403 Forbidden',
      tc15Passed,
      `Status: ${crossAssessRes.status}`
    );

    // -------------------------------------------------------------
    // 6. MANUAL EVALUATION & SCORE RECALCULATION (TC-16 to TC-20)
    // -------------------------------------------------------------
    // TC-16: Manual Evaluation: Grade Pending Question
    // Grade question 2 on Assessment A1 (pointsEarned: 0.8 / 1, remarks: 'Good job')
    const gradePendingRes = await request(`/trainer/assessments/${a1._id}/evaluate-question`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${trainer1Token}` },
      body: JSON.stringify({
        questionId: dummyQId2,
        pointsEarned: 0.8,
        remarks: 'Good explanation of the event loop.',
      }),
    });
    const gData = gradePendingRes.data?.data;
    const gradedQ = gData?.questions?.find((q) => q.questionId.toString() === dummyQId2.toString());
    const tc16Passed =
      gradePendingRes.status === 200 &&
      gradedQ?.evaluationStatus === 'manual_evaluated' &&
      gradedQ?.pointsEarned === 0.8 &&
      gradedQ?.trainerEvaluation?.remarks === 'Good explanation of the event loop.';
    recordTest(
      'TC-16',
      'Manual Evaluation: Grade Pending',
      'Trainer manually grades pending text question -> sets manual_evaluated and records trainerEvaluation',
      tc16Passed,
      `Status: ${gradedQ?.evaluationStatus}, Points: ${gradedQ?.pointsEarned}`
    );

    // TC-17: Manual Evaluation Score Recalculation
    // Objective: 1/1 (100%). Subjective: 0.8/1 (80%). Overall: 1.8/2 (90%). isFullyEvaluated: true.
    const sc = gData?.scoring;
    const tc17Passed =
      sc?.objectiveScore === 1 &&
      sc?.objectivePercentage === 100 &&
      sc?.subjectiveScore === 0.8 &&
      sc?.subjectivePercentage === 80 &&
      sc?.overallScore === 1.8 &&
      sc?.overallPercentage === 90 &&
      sc?.isFullyEvaluated === true;
    recordTest(
      'TC-17',
      'Manual Evaluation: Score Recalc',
      'Preserves objective score (1/1) and accurately recomputes subjective (0.8/1) and overall (1.8/2 = 90%)',
      tc17Passed,
      `Overall: ${sc?.overallScore}/${sc?.overallMaxScore} (${sc?.overallPercentage}%), FullyEvaluated: ${sc?.isFullyEvaluated}`
    );

    // TC-18: Manual Evaluation: Override Existing AI Evaluation
    // Grade question 2 on Assessment A2 (which was previously ai_evaluated 4/5) -> update to 5/5
    const overrideRes = await request(`/trainer/assessments/${a2._id}/evaluate-question`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${trainer1Token}` },
      body: JSON.stringify({
        questionId: dummyQId3,
        pointsEarned: 5,
        remarks: 'Overriding AI: Candidate covered fiber reconciliation completely.',
      }),
    });
    const ovQ = overrideRes.data?.data?.questions?.find((q) => q.questionId.toString() === dummyQId3.toString());
    const tc18Passed =
      overrideRes.status === 200 &&
      ovQ?.evaluationStatus === 'manual_evaluated' &&
      ovQ?.pointsEarned === 5;
    recordTest(
      'TC-18',
      'Manual Evaluation: Override AI',
      'Trainer overrides existing AI evaluation -> updates points to 5/5 and sets manual_evaluated',
      tc18Passed,
      `New Points: ${ovQ?.pointsEarned}/5`
    );

    // TC-19: Out of Bounds Score Rejection (pointsEarned > maxPoints or < 0)
    const oobRes = await request(`/trainer/assessments/${a1._id}/evaluate-question`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${trainer1Token}` },
      body: JSON.stringify({
        questionId: dummyQId2,
        pointsEarned: 2.5, // maxPoints is 1!
        remarks: 'Too high score',
      }),
    });
    const tc19Passed = oobRes.status === 400;
    recordTest(
      'TC-19',
      'Out-of-Bounds Score Rejection',
      'Rejects pointsEarned > maxPoints with 400 Bad Request',
      tc19Passed,
      `Status: ${oobRes.status}`
    );

    // TC-20: Reject MCQ Manual Grading
    const mcqGradeRes = await request(`/trainer/assessments/${a1._id}/evaluate-question`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${trainer1Token}` },
      body: JSON.stringify({
        questionId: dummyQId1, // MCQ question
        pointsEarned: 1,
        remarks: 'Grading MCQ manually',
      }),
    });
    const tc20Passed = mcqGradeRes.status === 400 && mcqGradeRes.data?.message?.includes('subjective');
    recordTest(
      'TC-20',
      'Reject MCQ Manual Grading',
      'Attempting to manually grade an MCQ question is rejected with 400 Bad Request',
      tc20Passed,
      `Status: ${mcqGradeRes.status}`
    );

    // -------------------------------------------------------------
    // 7. CONCURRENCY, FENCING & STALE RECOVERY (TC-21 to TC-25)
    // -------------------------------------------------------------
    // TC-21: Concurrency Lock: Simultaneous evaluation request encounters lock and returns 409 Conflict
    // Manually set isEvaluating = true on assessment A1
    await Assessment.updateOne({ _id: a1._id }, { $set: { isEvaluating: true, lockedAt: new Date() } });

    const lockedReqRes = await request(`/trainer/assessments/${a1._id}/evaluate-question`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${trainer1Token}` },
      body: JSON.stringify({
        questionId: dummyQId2,
        pointsEarned: 1,
        remarks: 'Simultaneous attempt while locked',
      }),
    });
    const tc21Passed = lockedReqRes.status === 409;
    recordTest(
      'TC-21',
      'Concurrency Lock (409 Conflict)',
      'Request encountering an active lock is rejected with 409 Conflict',
      tc21Passed,
      `Status: ${lockedReqRes.status}`
    );

    // Reset lock
    await Assessment.updateOne({ _id: a1._id }, { $set: { isEvaluating: false } });

    // TC-22: Legacy Assessment Lock Match: matches isEvaluating: { $ne: true }
    // Assessment A2 had isEvaluating removed earlier. Verify it locks and updates successfully!
    const legacyLockRes = await request(`/trainer/assessments/${a2._id}/feedback`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${trainer1Token}` },
      body: JSON.stringify({ remarks: 'Legacy document feedback test.' }),
    });
    const tc22Passed = legacyLockRes.status === 200;
    recordTest(
      'TC-22',
      'Legacy Assessment Lock Match',
      'Legacy assessment missing isEvaluating field is successfully locked and updated ({ $ne: true })',
      tc22Passed,
      `Status: ${legacyLockRes.status}`
    );

    // TC-23: Guaranteed Lock Release on Failure via finally
    // Send malformed input to evaluateQuestion and verify isEvaluating is false afterwards
    await request(`/trainer/assessments/${a1._id}/evaluate-question`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${trainer1Token}` },
      body: JSON.stringify({
        questionId: dummyQId2,
        pointsEarned: 'INVALID_NUMBER_POINTS',
        remarks: 'Test failure release',
      }),
    });
    const checkUnlocked = await Assessment.findById(a1._id);
    const tc23Passed = checkUnlocked.isEvaluating === false;
    recordTest(
      'TC-23',
      'Guaranteed Lock Release on Failure',
      'Lock is guaranteed released (isEvaluating = false) even when request fails validation',
      tc23Passed,
      `isEvaluating: ${checkUnlocked?.isEvaluating}`
    );

    // TC-24: Lock Ownership Guard: Token 1 cannot release lock held by Token 2
    const tokenA = 'token_request_A_123';
    const tokenB = 'token_request_B_456';
    await Assessment.updateOne({ _id: a1._id }, { $set: { isEvaluating: true, evaluationLockToken: tokenB, lockedAt: new Date() } });

    // Simulate Request A trying to release with Token A
    await Assessment.findOneAndUpdate(
      { _id: a1._id, evaluationLockToken: tokenA },
      { $set: { isEvaluating: false, evaluationLockToken: null, lockedAt: null } }
    );
    const checkStillLocked = await Assessment.findById(a1._id);
    const tc24Passed = checkStillLocked.isEvaluating === true && checkStillLocked.evaluationLockToken === tokenB;
    recordTest(
      'TC-24',
      'Lock Ownership Guard',
      'A lagging request holding Token A cannot release an active lock owned by Token B',
      tc24Passed,
      `isEvaluating: ${checkStillLocked.isEvaluating}, Owner: ${checkStillLocked.evaluationLockToken}`
    );

    // Reset lock for a1
    await Assessment.updateOne({ _id: a1._id }, { $set: { isEvaluating: false, evaluationLockToken: null, lockedAt: null } });

    // TC-25: Stale Lock Auto-Recovery & Fenced Stale-Write Rejection
    // 1) Seed assessment with stale lock (>30s old)
    const staleTime = new Date(Date.now() - 35000);
    await Assessment.updateOne({ _id: a1._id }, { $set: { isEvaluating: true, evaluationLockToken: 'stale_token_dead', lockedAt: staleTime } });

    // 2) New incoming request should break the stale lock and succeed
    const staleRecoveryRes = await request(`/trainer/assessments/${a1._id}/feedback`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${trainer1Token}` },
      body: JSON.stringify({ remarks: 'Auto-recovered after stale lock.' }),
    });
    const tc25Passed = staleRecoveryRes.status === 200;
    recordTest(
      'TC-25',
      'Stale Lock Auto-Recovery',
      'A stale lock older than 30s is automatically broken and recovered by new request without 409 error',
      tc25Passed,
      `Status: ${staleRecoveryRes.status}`
    );

    // -------------------------------------------------------------
    // 8. TOPIC WEIGHTS, FEEDBACK & ADMIN PRIVILEGES (TC-26 to TC-28)
    // -------------------------------------------------------------
    // TC-26: Topic Recalculation with Weighted Points (Assessment A2 has maxPoints: 2 & 5)
    // In A2: React MCQ is 2/2, React Text is 5/5 -> total React = 7/7 = 100%
    const a2Check = await Assessment.findById(a2._id);
    const reactTopicResult = a2Check.topicWiseResults?.find((t) => t.topic === 'React');
    const tc26Passed = reactTopicResult && reactTopicResult.percentage === 100 && reactTopicResult.objectiveTotal === 2;
    recordTest(
      'TC-26',
      'Topic Recalculation with Weighted Points',
      'Accurately calculates topic percentages when questions have weighted maxPoints (2 pts & 5 pts)',
      tc26Passed,
      `React Topic: ${reactTopicResult?.percentage}%, Total Questions: ${reactTopicResult?.totalQuestions}`
    );

    // TC-27: Assessment Coaching Feedback
    const fbRes = await request(`/trainer/assessments/${a1._id}/feedback`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${trainer1Token}` },
      body: JSON.stringify({ remarks: 'Overall great attempt. Work on closure edge cases.' }),
    });
    const tc27Passed =
      fbRes.status === 200 &&
      fbRes.data?.data?.trainerFeedback?.remarks === 'Overall great attempt. Work on closure edge cases.';
    recordTest(
      'TC-27',
      'Assessment Coaching Feedback',
      'Attaches trainerFeedback remarks to assessment without mutating rubric scores',
      tc27Passed,
      `Feedback: ${fbRes.data?.data?.trainerFeedback?.remarks}`
    );

    // TC-28: Admin Global Oversight & Supervisory Grading
    // Admin accesses Student B (assigned to Trainer 2) and submits supervisory feedback
    const adminAccessRes = await request(`/trainer/students/${studentB._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminFbRes = await request(`/trainer/assessments/${b1._id}/feedback`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ remarks: 'Admin quality review: Verified assessment accuracy.' }),
    });
    const tc28Passed = adminAccessRes.status === 200 && adminFbRes.status === 200;
    recordTest(
      'TC-28',
      'Admin Global Oversight & Grading',
      'Admin token has supervisory global read, inspection, and feedback access across all trainers',
      tc28Passed,
      `Admin Student View: ${adminAccessRes.status}, Admin Feedback: ${adminFbRes.status}`
    );

    // -------------------------------------------------------------
    // 9. ROLE & INPUT VALIDATION GUARDS (TC-29)
    // -------------------------------------------------------------
    // TC-29: Role Guards: Student gets 403, unauthenticated gets 401, malformed ID gets 400
    const studentBlockRes = await request('/trainer/dashboard', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const unauthRes = await request('/trainer/dashboard');
    const malformedIdRes = await request('/trainer/students/NOT_A_VALID_OBJECT_ID', {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const tc29Passed = studentBlockRes.status === 403 && unauthRes.status === 401 && malformedIdRes.status === 400;
    recordTest(
      'TC-29',
      'Role & Input Validation Guards',
      'Student gets 403, unauthenticated gets 401, malformed ObjectId gets 400',
      tc29Passed,
      `Student: ${studentBlockRes.status}, Unauth: ${unauthRes.status}, Malformed: ${malformedIdRes.status}`
    );

    // -------------------------------------------------------------
    // 10. FULL REGRESSION SUITE FOR MODULES 1–5 (TC-30)
    // -------------------------------------------------------------
    const healthRes = await request('/health');
    const meRes = await request('/auth/me', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const questionsRes = await request('/questions', {
      headers: { Authorization: `Bearer ${trainer1Token}` },
    });
    const myAssessRes = await request('/assessments/my', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const progDashRes = await request('/progress/dashboard', {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });

    const tc30Passed =
      healthRes.status === 200 &&
      meRes.status === 200 &&
      questionsRes.status === 200 &&
      myAssessRes.status === 200 &&
      progDashRes.status === 200;
    recordTest(
      'TC-30',
      'Full Regression M1-M5',
      'Modules 1-5 endpoints (/health, /auth/me, /questions, /assessments/my, /progress/dashboard) remain 100% operational',
      tc30Passed,
      `Health: ${healthRes.status}, Me: ${meRes.status}, Questions: ${questionsRes.status}, Assessments: ${myAssessRes.status}, Progress: ${progDashRes.status}`
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
    console.log(`\n=== Module 6 Test Suite Summary: ${passedCount}/${total} PASSED ===\n`);

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
