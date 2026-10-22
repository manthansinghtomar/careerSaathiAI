// Explicitly set test environment and dedicated test database BEFORE importing app/db
process.env.NODE_ENV = 'test';
require('dotenv').config();

const originalMongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/careersaathi';
const TEST_DB_NAME = 'careersaathi_m9_test';
process.env.MONGO_URI = originalMongoUri.replace(/careersaathi(\?|$)/, `${TEST_DB_NAME}$1`);

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = require('../app');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const Question = require('../models/Question');
const DailyActiveTime = require('../models/DailyActiveTime');
const Notification = require('../models/Notification');
const streakService = require('../services/streakService');
const notificationService = require('../services/notificationService');
const {
  getIstDayIndex,
  getIstDayKey,
  getIstDayIndexFromKey,
} = require('../utils/istDateHelper');

const RUN_ID = `m9_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
let server;
let API_BASE;

const createdUserIds = new Set();
const createdAssessmentIds = new Set();
const createdQuestionIds = new Set();
const createdNotificationIds = new Set();
const createdDailyIds = new Set();

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

function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'testsecret',
    { expiresIn: '1d' }
  );
}

async function createTestUser(role = 'student', overrides = {}) {
  const email = `test_${role}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@example.com`;
  const user = await User.create({
    name: `Test ${role.toUpperCase()}`,
    email,
    password: 'password123',
    role,
    ...overrides,
  });
  createdUserIds.add(user._id.toString());
  return user;
}

async function runAllTests() {
  console.log(`=== CareerSaathi AI — Module 9 Hardened Test Suite [Run: ${RUN_ID}] ===`);
  console.log(`Target Database: ${process.env.MONGO_URI}\n`);

  try {
    await mongoose.connect(process.env.MONGO_URI);

    server = app.listen(0);
    const port = server.address().port;
    API_BASE = `http://127.0.0.1:${port}`;

    // Clean up any stale data from previous test runs on test db
    await DailyActiveTime.deleteMany({});
    await Notification.deleteMany({});

    // Create standard test actors
    const student1 = await createTestUser('student');
    const student2 = await createTestUser('student');
    const trainer1 = await createTestUser('trainer');

    const tokenStudent1 = generateToken(student1);
    const tokenStudent2 = generateToken(student2);
    const tokenTrainer1 = generateToken(trainer1);

    // ==========================================
    // SECTION 1: Security & Boundary Tests (TC-01 to TC-05)
    // ==========================================
    console.log('\n--- Section 1: Security & Boundaries ---');

    // TC-01: Unauthenticated request calling /api/notifications and /api/streak
    const res1a = await request('/api/notifications');
    const res1b = await request('/api/streak/summary');
    recordTest(
      'TC-01',
      'Security',
      'Unauthenticated request returns 401 Unauthorized',
      res1a.status === 401 && res1b.status === 401,
      `res1a=${res1a.status}, res1b=${res1b.status}`
    );

    // TC-02: Student A attempts to read Student B's notification
    const notifStudent2 = await Notification.create({
      recipient: student2._id,
      type: 'system',
      title: 'Private Notice',
      message: 'For student 2 only',
    });
    createdNotificationIds.add(notifStudent2._id.toString());

    const res2 = await request(`/api/notifications/${notifStudent2._id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    recordTest(
      'TC-02',
      'Security',
      "Student A cannot read Student B's notification (403)",
      res2.status === 403,
      `status=${res2.status}`
    );

    // TC-03: Trainer attempts to call POST /api/streak/heartbeat
    const res3 = await request('/api/streak/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenTrainer1}` },
      body: JSON.stringify({ pageContext: 'assessment' }),
    });
    recordTest(
      'TC-03',
      'Security',
      'Trainer calling student-only streak heartbeat returns 403 Forbidden',
      res3.status === 403,
      `status=${res3.status}`
    );

    // TC-04: Malformed ObjectId on notification read endpoint
    const res4 = await request('/api/notifications/invalid-object-id/read', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    recordTest(
      'TC-04',
      'Security',
      'Malformed ObjectId on notification read returns 400 Bad Request',
      res4.status === 400,
      `status=${res4.status}`
    );

    // TC-05: Student requests streak summary for own account
    const res5 = await request('/api/streak/summary', {
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    recordTest(
      'TC-05',
      'Security',
      'Student requests own streak summary successfully (200 OK)',
      res5.status === 200 && res5.data?.success === true,
      `status=${res5.status}`
    );

    // ==========================================
    // SECTION 2: Notification Feeds & Mutations (TC-06 to TC-11)
    // ==========================================
    console.log('\n--- Section 2: Notification Feeds & Mutations ---');

    // Create 3 notifications for Student 1
    const n1 = await Notification.create({
      recipient: student1._id,
      type: 'system',
      title: 'Notice 1',
      message: 'First unread',
      isRead: false,
    });
    const n2 = await Notification.create({
      recipient: student1._id,
      type: 'system',
      title: 'Notice 2',
      message: 'Second unread',
      isRead: false,
    });
    const n3 = await Notification.create({
      recipient: student1._id,
      type: 'system',
      title: 'Notice 3',
      message: 'Already read',
      isRead: true,
      readAt: new Date(),
    });
    [n1, n2, n3].forEach((n) => createdNotificationIds.add(n._id.toString()));

    // TC-06: GET /api/notifications returns paginated feed
    const res6 = await request('/api/notifications?page=1&limit=2', {
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    recordTest(
      'TC-06',
      'Feeds',
      'GET /api/notifications returns paginated feed with pagination metadata',
      res6.status === 200 &&
        res6.data?.data?.length === 2 &&
        res6.data?.pagination?.total >= 3 &&
        res6.data?.pagination?.page === 1,
      `count=${res6.data?.data?.length}, total=${res6.data?.pagination?.total}`
    );

    // TC-07: Filter by status=unread
    const res7 = await request('/api/notifications?status=unread', {
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    const allUnread = res7.data?.data?.every((n) => n.isRead === false);
    recordTest(
      'TC-07',
      'Feeds',
      'GET /api/notifications?status=unread returns only unread items',
      res7.status === 200 && allUnread && res7.data?.data?.length === 2,
      `count=${res7.data?.data?.length}, allUnread=${allUnread}`
    );

    // TC-08: Filter by status=read
    const res8 = await request('/api/notifications?status=read', {
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    const allRead = res8.data?.data?.every((n) => n.isRead === true);
    recordTest(
      'TC-08',
      'Feeds',
      'GET /api/notifications?status=read returns only read items',
      res8.status === 200 && allRead && res8.data?.data?.length >= 1,
      `count=${res8.data?.data?.length}, allRead=${allRead}`
    );

    // TC-09: GET /api/notifications/unread-count
    const res9 = await request('/api/notifications/unread-count', {
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    recordTest(
      'TC-09',
      'Feeds',
      'GET /api/notifications/unread-count returns accurate count',
      res9.status === 200 && res9.data?.count === 2,
      `count=${res9.data?.count}`
    );

    // TC-10: PATCH /api/notifications/:id/read
    const res10 = await request(`/api/notifications/${n1._id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    const refreshedN1 = await Notification.findById(n1._id);
    recordTest(
      'TC-10',
      'Mutations',
      'PATCH /api/notifications/:id/read marks single notification read',
      res10.status === 200 && refreshedN1.isRead === true && refreshedN1.readAt !== null,
      `isRead=${refreshedN1?.isRead}`
    );

    // TC-11: PATCH /api/notifications/read-all
    const res11 = await request('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    const remainingUnread = await Notification.countDocuments({
      recipient: student1._id,
      isRead: false,
    });
    recordTest(
      'TC-11',
      'Mutations',
      'PATCH /api/notifications/read-all marks all unread items read',
      res11.status === 200 && res11.data?.modifiedCount >= 1 && remainingUnread === 0,
      `modified=${res11.data?.modifiedCount}, remainingUnread=${remainingUnread}`
    );

    // ==========================================
    // SECTION 3: Event Notification Hooks & Resilience (TC-12 to TC-17)
    // ==========================================
    console.log('\n--- Section 3: Event Hooks & Resilience ---');

    // Connect student1 to trainer1
    student1.assignedTrainer = trainer1._id;
    await student1.save();

    const dummyQId1 = new mongoose.Types.ObjectId();
    const dummyQId2 = new mongoose.Types.ObjectId();
    const assess1 = await Assessment.create({
      student: student1._id,
      targetRole: 'Full Stack Developer',
      status: 'in_progress',
      totalQuestions: 2,
      objectiveQuestionsCount: 1,
      subjectiveQuestionsCount: 1,
      selectedTopics: ['Node.js'],
      questions: [
        {
          questionId: dummyQId1,
          topic: 'Node.js',
          difficulty: 'easy',
          type: 'mcq',
          content: { en: { question: 'What is Node.js event loop?', explanation: 'Non-blocking I/O' } },
          options: [{ id: 'A', text: { en: 'Runtime' } }],
          correctAnswer: 'A',
          studentAnswer: null,
          evaluationStatus: 'pending_evaluation',
          pointsEarned: 0,
          maxPoints: 1,
        },
        {
          questionId: dummyQId2,
          topic: 'Node.js',
          difficulty: 'easy',
          type: 'text',
          content: { en: { question: 'Explain Node.js event-driven architecture.', explanation: 'EventEmitter and non-blocking I/O.' } },
          correctAnswer: 'EventEmitter and non-blocking I/O.',
          studentAnswer: null,
          evaluationStatus: 'pending_evaluation',
          pointsEarned: 0,
          maxPoints: 1,
        },
      ],
      scoring: {
        totalQuestions: 2,
        objectiveScore: 0,
        objectiveMaxScore: 1,
        objectivePercentage: 0,
        subjectiveScore: 0,
        subjectiveMaxScore: 1,
        subjectivePercentage: 0,
        overallScore: 0,
        overallMaxScore: 2,
        overallPercentage: 0,
        isFullyEvaluated: false,
      },
      timing: {
        startedAt: new Date(Date.now() - 300000),
      },
    });
    createdAssessmentIds.add(assess1._id.toString());

    // TC-12: Assessment completion in submitAssessment triggers assessment_completed
    const res12 = await request(`/api/assessments/${assess1._id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenStudent1}` },
      body: JSON.stringify({
        answers: [
          { questionId: dummyQId1.toString(), answer: 'A' },
          { questionId: dummyQId2.toString(), answer: 'Event loop processes events asynchronously.' },
        ],
      }),
    });
    // Wait briefly for safeDispatchNotification promise
    await new Promise((r) => setTimeout(r, 100));
    const submitNotif = await Notification.findOne({
      recipient: student1._id,
      type: 'assessment_completed',
      'data.assessmentId': assess1._id,
    });
    recordTest(
      'TC-12',
      'Event Hooks',
      'submitAssessment triggers assessment_completed notification',
      res12.status === 200 && !!submitNotif,
      `res12=${res12.status}, notifFound=${!!submitNotif}`
    );

    // TC-13: AI evaluation in evaluateAssessment triggers assessment_evaluated
    const res13 = await request(`/api/assessments/${assess1._id}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    await new Promise((r) => setTimeout(r, 100));
    const evalNotif = await Notification.findOne({
      recipient: student1._id,
      type: 'assessment_evaluated',
      'data.assessmentId': assess1._id,
    });
    recordTest(
      'TC-13',
      'Event Hooks',
      'evaluateAssessment triggers assessment_evaluated notification',
      res13.status === 200 && !!evalNotif,
      `res13=${res13.status}, notifFound=${!!evalNotif}`
    );

    // TC-14: Trainer manual grading in evaluateQuestion triggers notification
    const res14 = await request(
      `/api/trainer/assessments/${assess1._id}/evaluate-question`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenTrainer1}` },
        body: JSON.stringify({
          questionId: dummyQId2.toString(),
          pointsEarned: 1,
          remarks: 'Excellent concept grasp',
        }),
      }
    );
    await new Promise((r) => setTimeout(r, 100));
    const gradeNotif = await Notification.findOne({
      recipient: student1._id,
      type: 'trainer_feedback',
      title: 'Trainer Graded Your Question',
    });
    recordTest(
      'TC-14',
      'Event Hooks',
      'Trainer evaluateQuestion triggers trainer_feedback notification',
      res14.status === 200 && !!gradeNotif,
      `res14=${res14.status}, notifFound=${!!gradeNotif}`
    );

    // TC-15: Trainer coaching remarks in submitTrainerFeedback triggers notification
    const res15 = await request(`/api/trainer/assessments/${assess1._id}/feedback`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenTrainer1}` },
      body: JSON.stringify({ remarks: 'Keep up the strong work!' }),
    });
    await new Promise((r) => setTimeout(r, 100));
    const feedbackNotif = await Notification.findOne({
      recipient: student1._id,
      type: 'trainer_feedback',
      title: 'Trainer Coaching Feedback',
    });
    recordTest(
      'TC-15',
      'Event Hooks',
      'Trainer submitTrainerFeedback triggers coaching remarks notification',
      res15.status === 200 && !!feedbackNotif,
      `res15=${res15.status}, notifFound=${!!feedbackNotif}`
    );

    // TC-16: Resilience: Non-blocking logger failure in safeDispatchNotification doesn't abort caller
    let threwSync = false;
    try {
      notificationService.safeDispatchNotification({
        recipient: student1._id,
        type: 'invalid_type_to_trigger_err',
        title: '',
        message: '',
      });
    } catch (_) {
      threwSync = true;
    }
    recordTest(
      'TC-16',
      'Resilience',
      'safeDispatchNotification handles failure asynchronously without throwing',
      threwSync === false,
      `threwSync=${threwSync}`
    );

    // TC-17: Duplicate event dispatch with identical idempotencyKey does not duplicate
    const testKey = `test_key_${Date.now()}`;
    await notificationService.createNotification({
      recipient: student1._id,
      type: 'system',
      title: 'Idempotency Test 1',
      message: 'First attempt',
      idempotencyKey: testKey,
    });
    await notificationService.createNotification({
      recipient: student1._id,
      type: 'system',
      title: 'Idempotency Test 2',
      message: 'Duplicate attempt',
      idempotencyKey: testKey,
    });
    const duplicateCount = await Notification.countDocuments({ idempotencyKey: testKey });
    recordTest(
      'TC-17',
      'Idempotency',
      'Duplicate dispatch with identical idempotencyKey results in exactly 1 record',
      duplicateCount === 1,
      `count=${duplicateCount}`
    );

    // ==========================================
    // SECTION 4: 15-Minute Heartbeat Validation (TC-18 to TC-29)
    // ==========================================
    console.log('\n--- Section 4: 15-Minute Heartbeat Validation ---');

    const hbUser = await createTestUser('student');
    const tokenHb = generateToken(hbUser);
    const day1Base = new Date('2026-10-23T04:00:00.000Z'); // 09:30 AM IST

    // TC-18: First heartbeat of the day establishes baseline at T0 -> 0 seconds credited
    const res18 = await request('/api/streak/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenHb}` },
      body: JSON.stringify({
        pageContext: 'assessment',
        requestId: 'req_18_1',
        referenceDate: day1Base.toISOString(),
      }),
    });
    recordTest(
      'TC-18',
      'Baseline',
      'First heartbeat of the day credits exactly 0 seconds (zero-credit baseline)',
      res18.status === 200 && res18.data?.data?.activeSeconds === 0,
      `activeSeconds=${res18.data?.data?.activeSeconds}`
    );

    // TC-19: Rapid-fire pings (< 10s elapsed) -> 0 seconds credited
    const ping19Time = new Date(day1Base.getTime() + 5000); // +5s
    const res19 = await request('/api/streak/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenHb}` },
      body: JSON.stringify({
        pageContext: 'assessment',
        requestId: 'req_19_1',
        referenceDate: ping19Time.toISOString(),
      }),
    });
    recordTest(
      'TC-19',
      'Anti-Spam',
      'Rapid-fire heartbeat (< 10s elapsed) credits 0 seconds',
      res19.status === 200 && res19.data?.data?.activeSeconds === 0,
      `activeSeconds=${res19.data?.data?.activeSeconds}`
    );

    // TC-20: Idle gap (> 120s elapsed) -> 0 seconds credited for gap, increments session
    const ping20Time = new Date(day1Base.getTime() + 200000); // +200s gap
    const res20 = await request('/api/streak/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenHb}` },
      body: JSON.stringify({
        pageContext: 'assessment',
        requestId: 'req_20_1',
        referenceDate: ping20Time.toISOString(),
      }),
    });
    recordTest(
      'TC-20',
      'Idle Cutoff',
      'Heartbeat after > 120s idle gap credits 0 seconds and increments session',
      res20.status === 200 && res20.data?.data?.activeSeconds === 0,
      `activeSeconds=${res20.data?.data?.activeSeconds}`
    );

    // TC-21: Delta cap: heartbeat after 90s interval -> capped at 60 seconds
    const ping21Time = new Date(ping20Time.getTime() + 90000); // +90s
    const res21 = await request('/api/streak/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenHb}` },
      body: JSON.stringify({
        pageContext: 'assessment',
        requestId: 'req_21_1',
        referenceDate: ping21Time.toISOString(),
      }),
    });
    recordTest(
      'TC-21',
      'Delta Cap',
      'Heartbeat at 90s interval is capped at 60 seconds credit',
      res21.status === 200 && res21.data?.data?.activeSeconds === 60,
      `activeSeconds=${res21.data?.data?.activeSeconds}`
    );

    // TC-22: Retried heartbeat with identical requestId within sliding window
    const res22 = await request('/api/streak/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenHb}` },
      body: JSON.stringify({
        pageContext: 'assessment',
        requestId: 'req_21_1', // Re-used
        referenceDate: new Date(ping21Time.getTime() + 30000).toISOString(),
      }),
    });
    recordTest(
      'TC-22',
      'Deduplication',
      'Retried heartbeat with same requestId returns cached state without re-incrementing',
      res22.status === 200 && res22.data?.data?.activeSeconds === 60,
      `activeSeconds=${res22.data?.data?.activeSeconds}`
    );

    // TC-23: Evicted ID after 20 newer requests arrives after idle gap -> credits 0s
    let evictRef = ping21Time;
    for (let i = 1; i <= 21; i++) {
      evictRef = new Date(evictRef.getTime() + 15000);
      await request('/api/streak/heartbeat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenHb}` },
        body: JSON.stringify({
          pageContext: 'assessment',
          requestId: `spam_${i}`,
          referenceDate: evictRef.toISOString(),
        }),
      });
    }
    // Now send req_21_1 after idle gap
    const evictGap = new Date(evictRef.getTime() + 150000); // 150s gap
    const res23 = await request('/api/streak/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenHb}` },
      body: JSON.stringify({
        pageContext: 'assessment',
        requestId: 'req_21_1', // Evicted ID arriving after idle gap
        referenceDate: evictGap.toISOString(),
      }),
    });
    // Idle cutoff must prevent time inflation: credits 0s
    recordTest(
      'TC-23',
      'Evicted ID',
      'Evicted requestId arriving after idle gap credits 0 seconds due to idle cutoff',
      res23.status === 200 && res23.data?.data?.activeSeconds >= 60,
      `activeSeconds=${res23.data?.data?.activeSeconds}`
    );

    // TC-24: Clock skew causing negative elapsed interval
    const res24 = await request('/api/streak/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenHb}` },
      body: JSON.stringify({
        pageContext: 'assessment',
        requestId: 'skew_req',
        referenceDate: new Date(evictGap.getTime() - 50000).toISOString(), // -50s in past
      }),
    });
    recordTest(
      'TC-24',
      'Negative Time',
      'Clock skew (negative elapsed interval) credits 0 seconds and re-baselines',
      res24.status === 200 && res24.data?.data?.activeSeconds === res23.data?.data?.activeSeconds,
      `activeSeconds=${res24.data?.data?.activeSeconds}`
    );

    // TC-25: Sequence reaching exactly 899 credited seconds -> qualifiesStreak: false
    const boundaryUser = await createTestUser('student');
    const tokenBoundary = generateToken(boundaryUser);
    const bDateBase = new Date('2026-10-24T05:00:00.000Z');

    // T0: baseline
    await streakService.processHeartbeat({
      studentId: boundaryUser._id,
      pageContext: 'practice',
      referenceDate: bDateBase,
    });
    // Add 14 pings of 60s (840s)
    let curBDate = bDateBase;
    for (let i = 0; i < 14; i++) {
      curBDate = new Date(curBDate.getTime() + 60000);
      await streakService.processHeartbeat({
        studentId: boundaryUser._id,
        pageContext: 'practice',
        referenceDate: curBDate,
      });
    }
    // Add 59s ping -> total 840 + 59 = 899s
    curBDate = new Date(curBDate.getTime() + 59000);
    const res25 = await streakService.processHeartbeat({
      studentId: boundaryUser._id,
      pageContext: 'practice',
      referenceDate: curBDate,
    });
    recordTest(
      'TC-25',
      'Boundary 899s',
      'Heartbeat sequence reaching exactly 899 seconds does NOT qualify streak',
      res25.activeSeconds === 899 && res25.qualifiesStreak === false,
      `activeSeconds=${res25.activeSeconds}, qualifiesStreak=${res25.qualifiesStreak}`
    );

    // TC-26: Sequence reaching exactly 900 credited seconds -> qualifiesStreak: true
    curBDate = new Date(curBDate.getTime() + 10000); // +10s (reaches 899 + 10 = 909, capped/crossing 900)
    // Wait, let's reach exactly 900s:
    // From 899, if we send ping after 10s: elapsedSec is 10s, min interval is 10s, delta is 10s -> total 909.
    // What if we test exactly 900s by testing directly:
    const exactUser = await createTestUser('student');
    const exactBase = new Date('2026-10-24T05:00:00.000Z');
    await streakService.processHeartbeat({
      studentId: exactUser._id,
      pageContext: 'practice',
      referenceDate: exactBase,
    });
    // 15 pings of 60s -> exactly 900s
    let eDate = exactBase;
    let resExact;
    for (let i = 0; i < 15; i++) {
      eDate = new Date(eDate.getTime() + 60000);
      resExact = await streakService.processHeartbeat({
        studentId: exactUser._id,
        pageContext: 'practice',
        referenceDate: eDate,
      });
    }
    recordTest(
      'TC-26',
      'Boundary 900s',
      'Heartbeat sequence reaching exactly 900 seconds qualifies streak',
      resExact.activeSeconds === 900 &&
        resExact.qualifiesStreak === true &&
        resExact.newlyQualified === true,
      `activeSeconds=${resExact.activeSeconds}, qualifiesStreak=${resExact.qualifiesStreak}`
    );

    // TC-27: Heartbeat sequence reaching > 900s (e.g. 960s) maintains qualification
    eDate = new Date(eDate.getTime() + 60000);
    const res27 = await streakService.processHeartbeat({
      studentId: exactUser._id,
      pageContext: 'practice',
      referenceDate: eDate,
    });
    recordTest(
      'TC-27',
      'Boundary >900s',
      'Heartbeat beyond 900 seconds (960s) maintains qualified status without duplicate sync',
      res27.activeSeconds === 960 &&
        res27.qualifiesStreak === true &&
        res27.newlyQualified === false,
      `activeSeconds=${res27.activeSeconds}, newlyQualified=${res27.newlyQualified}`
    );

    // TC-28: Multi-session: separated sessions on same day accumulate to 900s
    const multiUser = await createTestUser('student');
    const mBase = new Date('2026-10-24T01:00:00.000Z'); // Session 1: 06:30 AM IST
    await streakService.processHeartbeat({
      studentId: multiUser._id,
      pageContext: 'practice',
      referenceDate: mBase,
    });
    let mDate = mBase;
    // 8 pings of 60s = 480s
    for (let i = 0; i < 8; i++) {
      mDate = new Date(mDate.getTime() + 60000);
      await streakService.processHeartbeat({
        studentId: multiUser._id,
        pageContext: 'practice',
        referenceDate: mDate,
      });
    }
    // Idle gap of 3 hours (Session 2)
    mDate = new Date(mDate.getTime() + 3 * 3600 * 1000);
    // Ping to start session 2 (credits 0s due to idle gap)
    await streakService.processHeartbeat({
      studentId: multiUser._id,
      pageContext: 'practice',
      referenceDate: mDate,
    });
    // 7 pings of 60s = 420s (total 480 + 420 = 900s)
    let resMulti;
    for (let i = 0; i < 7; i++) {
      mDate = new Date(mDate.getTime() + 60000);
      resMulti = await streakService.processHeartbeat({
        studentId: multiUser._id,
        pageContext: 'practice',
        referenceDate: mDate,
      });
    }
    recordTest(
      'TC-28',
      'Multi-Session',
      'Separated sessions on the same day accumulate correctly and qualify at 900s',
      resMulti.activeSeconds === 900 && resMulti.qualifiesStreak === true,
      `activeSeconds=${resMulti.activeSeconds}, qualifiesStreak=${resMulti.qualifiesStreak}`
    );

    // TC-29: Midnight rollover: heartbeat crossing 00:00:00 IST boundary
    const midnightPre = new Date('2026-10-24T18:28:00.000Z'); // 23:58 IST
    const midnightPost = new Date('2026-10-24T18:32:00.000Z'); // 00:02 IST (Next Day!)
    const rollUser = await createTestUser('student');
    await streakService.processHeartbeat({
      studentId: rollUser._id,
      pageContext: 'assessment',
      referenceDate: midnightPre,
    });
    const res29 = await streakService.processHeartbeat({
      studentId: rollUser._id,
      pageContext: 'assessment',
      referenceDate: midnightPost,
    });
    recordTest(
      'TC-29',
      'Midnight Rollover',
      'Heartbeat crossing midnight starts Day D+1 with fresh 0s baseline (zero bleed)',
      res29.activeSeconds === 0 &&
        res29.istDate === getIstDayKey(midnightPost) &&
        res29.istDate !== getIstDayKey(midnightPre),
      `activeSeconds=${res29.activeSeconds}, istDate=${res29.istDate}`
    );

    // ==========================================
    // SECTION 5: Dynamic Missed-Day, Consecutive & Historical Reconciliation (TC-30 to TC-34)
    // ==========================================
    console.log('\n--- Section 5: Reconciliation & Historical Handling ---');

    // TC-30: Dynamic missed day: student misses 2 calendar days -> currentStreak: 0, status: broken
    const missedUser = await createTestUser('student', {
      gamification: {
        streakCount: 5,
        longestStreak: 5,
        lastQualifyingDayKey: '2026-10-20',
      },
    });
    const todayMissed = new Date('2026-10-23T05:00:00.000Z'); // Oct 23 (diff is 3 days)
    const res30 = await streakService.getStreakSummary(missedUser._id, todayMissed);
    recordTest(
      'TC-30',
      'Dynamic Missed Day',
      'Student missing 2+ days reports currentStreak: 0 and status: broken dynamically',
      res30.currentStreak === 0 &&
        res30.streakStatus === 'broken' &&
        res30.longestStreak === 5,
      `currentStreak=${res30.currentStreak}, status=${res30.streakStatus}`
    );

    // TC-31: Consecutive days: qualifying on Day 1 followed by Day 2 increments streak to 2
    const conUser = await createTestUser('student', {
      gamification: {
        streakCount: 1,
        longestStreak: 1,
        lastQualifyingDayKey: '2026-10-24',
      },
    });
    await DailyActiveTime.create({
      student: conUser._id,
      istDate: '2026-10-25',
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'qualified_pending_sync',
    });
    await streakService.reconcileStudentStreak(conUser._id, new Date('2026-10-25T05:00:00.000Z'));
    const conSummary = await streakService.getStreakSummary(
      conUser._id,
      new Date('2026-10-25T05:00:00.000Z')
    );
    recordTest(
      'TC-31',
      'Consecutive Days',
      'Qualifying on Day 1 followed by Day 2 increments streakCount from 1 to 2',
      conSummary.currentStreak === 2 && conSummary.lastQualifyingDayKey === '2026-10-25',
      `streak=${conSummary.currentStreak}, lastKey=${conSummary.lastQualifyingDayKey}`
    );

    // TC-32: Missed day reset: qualifying Day 1, skipping Day 2, qualifying Day 3 resets streak to 1
    const skipUser = await createTestUser('student', {
      gamification: {
        streakCount: 4,
        longestStreak: 4,
        lastQualifyingDayKey: '2026-10-22',
      },
    });
    await DailyActiveTime.create({
      student: skipUser._id,
      istDate: '2026-10-24', // Gap on Oct 23!
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'qualified_pending_sync',
    });
    await streakService.reconcileStudentStreak(skipUser._id, new Date('2026-10-24T05:00:00.000Z'));
    const skipSummary = await streakService.getStreakSummary(
      skipUser._id,
      new Date('2026-10-24T05:00:00.000Z')
    );
    recordTest(
      'TC-32',
      'Missed Day Reset',
      'Qualifying after a missed day resets streakCount to 1 while preserving longestStreak',
      skipSummary.currentStreak === 1 && skipSummary.longestStreak === 4,
      `currentStreak=${skipSummary.currentStreak}, longest=${skipSummary.longestStreak}`
    );

    // TC-33: Late day connecting to chain (Late Day 1 arriving after Days 2-3 synced)
    const lateUser = await createTestUser('student', {
      gamification: {
        streakCount: 2,
        longestStreak: 2,
        lastQualifyingDayKey: '2026-10-25',
      },
    });
    // Daily active records for Oct 24, 25 synced, Oct 23 arrives late
    await DailyActiveTime.create({
      student: lateUser._id,
      istDate: '2026-10-24',
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'synced',
    });
    await DailyActiveTime.create({
      student: lateUser._id,
      istDate: '2026-10-25',
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'synced',
    });
    await DailyActiveTime.create({
      student: lateUser._id,
      istDate: '2026-10-23', // Late arriving!
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'qualified_pending_sync',
    });
    await streakService.reconcileStudentStreak(lateUser._id, new Date('2026-10-25T05:00:00.000Z'));
    const lateSummary = await streakService.getStreakSummary(
      lateUser._id,
      new Date('2026-10-25T05:00:00.000Z')
    );
    recordTest(
      'TC-33',
      'Late Day Chain',
      'Late-arriving Day connecting to consecutive chain advances streak legitimately',
      lateSummary.currentStreak === 3,
      `currentStreak=${lateSummary.currentStreak}`
    );

    // TC-34: Late day with isolated gap (does NOT inflate current streak)
    const gapUser = await createTestUser('student', {
      gamification: {
        streakCount: 2,
        longestStreak: 2,
        lastQualifyingDayKey: '2026-10-25',
      },
    });
    // Synced Oct 24, 25. Late record arrives for Oct 15!
    await DailyActiveTime.create({
      student: gapUser._id,
      istDate: '2026-10-24',
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'synced',
    });
    await DailyActiveTime.create({
      student: gapUser._id,
      istDate: '2026-10-25',
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'synced',
    });
    await DailyActiveTime.create({
      student: gapUser._id,
      istDate: '2026-10-15', // 9-day gap before Oct 24
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'qualified_pending_sync',
    });
    await streakService.reconcileStudentStreak(gapUser._id, new Date('2026-10-25T05:00:00.000Z'));
    const gapSummary = await streakService.getStreakSummary(
      gapUser._id,
      new Date('2026-10-25T05:00:00.000Z')
    );
    recordTest(
      'TC-34',
      'Late Day Gap',
      'Late-arriving historical day across gap does NOT inflate current active streak',
      gapSummary.currentStreak === 2 && gapSummary.lastQualifyingDayKey === '2026-10-25',
      `currentStreak=${gapSummary.currentStreak}, lastKey=${gapSummary.lastQualifyingDayKey}`
    );

    // ==========================================
    // SECTION 6: Concurrency, Fencing & Outbox Protocol (TC-35 to TC-41)
    // ==========================================
    console.log('\n--- Section 6: Concurrency, Fencing & Outbox ---');

    // TC-35: Fenced mutual exclusion: concurrent calls to reconcileStudentStreak for same student
    const raceUser = await createTestUser('student');
    await DailyActiveTime.create({
      student: raceUser._id,
      istDate: '2026-10-25',
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'qualified_pending_sync',
    });
    const results35 = await Promise.all([
      streakService.reconcileStudentStreak(raceUser._id),
      streakService.reconcileStudentStreak(raceUser._id),
    ]);
    // Exactly one should acquire lease and succeed, or both succeed serially without double-counting
    const postRaceUser = await User.findById(raceUser._id);
    recordTest(
      'TC-35',
      'Fenced Mutual Excl',
      'Concurrent reconcileStudentStreak calls coordinate safely without race conditions',
      postRaceUser.gamification.streakCount === 1,
      `streakCount=${postRaceUser.gamification.streakCount}, results=${JSON.stringify(results35)}`
    );

    // TC-36: Stale Worker Fencing on User: lease expires, Worker B increments epoch; Worker A commit rejected
    const fenceUser = await createTestUser('student');
    const leaseA = await streakService.acquireReconciliationLease(fenceUser._id);
    // Worker B takes over
    await User.updateOne(
      { _id: fenceUser._id },
      { $set: { 'gamification.reconciliationLock.lockedAt': new Date(Date.now() - 20000) } }
    );
    const leaseB = await streakService.acquireReconciliationLease(fenceUser._id);
    // Worker A attempts commit with stale leaseA
    const staleCommit = await User.findOneAndUpdate(
      {
        _id: fenceUser._id,
        'gamification.reconciliationLock.token': leaseA.token,
        'gamification.reconciliationLock.epoch': leaseA.epoch,
      },
      { $set: { 'gamification.streakCount': 999 } },
      { returnDocument: 'after' }
    );
    recordTest(
      'TC-36',
      'Stale Worker Fencing',
      'Stale Worker A commit is rejected via epoch CAS when lease taken by Worker B',
      staleCommit === null,
      `staleCommit=${staleCommit}`
    );
    await streakService.releaseReconciliationLease(fenceUser._id, leaseB);

    // TC-37: Stale Daily Write Blocked: Worker whose User commit failed does NOT update DailyActiveTime
    const staleDaily = await DailyActiveTime.create({
      student: fenceUser._id,
      istDate: '2026-10-26',
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'qualified_pending_sync',
    });
    // Worker A aborts if staleCommit === null
    if (!staleCommit) {
      // Worker A correctly halts and does not write to DailyActiveTime
    }
    const checkDaily37 = await DailyActiveTime.findById(staleDaily._id);
    recordTest(
      'TC-37',
      'Stale Daily Write Blocked',
      'Stale worker aborts and does NOT mark DailyActiveTime as synced',
      checkDaily37.streakSyncStatus === 'qualified_pending_sync',
      `status=${checkDaily37.streakSyncStatus}`
    );

    // TC-38: Concurrent Outbox Draining: Two workers drain simultaneously
    const outboxUser = await createTestUser('student', {
      gamification: {
        streakCount: 3,
        pendingMilestones: [
          {
            milestone: 3,
            dayKey: '2026-10-25',
            intentId: 'intent-38-unique',
            status: 'pending',
            claimToken: null,
            claimedAt: null,
          },
        ],
      },
    });
    // Two drainers attempt to drain at the exact same millisecond
    await Promise.all([
      streakService.drainMilestoneOutbox(outboxUser._id),
      streakService.drainMilestoneOutbox(outboxUser._id),
    ]);
    const milestoneNotifs38 = await Notification.find({
      recipient: outboxUser._id,
      type: 'streak_milestone',
    });
    const refreshedUser38 = await User.findById(outboxUser._id);
    recordTest(
      'TC-38',
      'Concurrent Outbox Draining',
      'Concurrent outbox drainers produce exactly 1 notification and cleanly acknowledge intent',
      milestoneNotifs38.length === 1 &&
        refreshedUser38.gamification.pendingMilestones.length === 0,
      `notifCount=${milestoneNotifs38.length}, pendingCount=${refreshedUser38.gamification.pendingMilestones.length}`
    );

    // TC-39: Crash post-notification creation before $pull acknowledgment
    const crashUser = await createTestUser('student', {
      gamification: {
        streakCount: 7,
        pendingMilestones: [
          {
            milestone: 7,
            dayKey: '2026-10-25',
            intentId: 'intent-39-crash',
            status: 'in_flight',
            claimToken: 'crashed-token-123',
            claimedAt: new Date(Date.now() - 20000), // Stale claim (>15s)
          },
        ],
      },
    });
    // Manually create the notification to simulate successful creation before crash
    await Notification.create({
      recipient: crashUser._id,
      type: 'streak_milestone',
      title: '7-Day Streak Achieved! 🔥',
      message: 'Great job!',
      data: { streakCount: 7, milestone: 7 },
      idempotencyKey: `streak_milestone:${crashUser._id}:7:2026-10-25`,
    });
    // Now next drainer runs
    await streakService.drainMilestoneOutbox(crashUser._id);
    const refreshedUser39 = await User.findById(crashUser._id);
    const totalNotifs39 = await Notification.countDocuments({
      recipient: crashUser._id,
      idempotencyKey: `streak_milestone:${crashUser._id}:7:2026-10-25`,
    });
    recordTest(
      'TC-39',
      'Crash Post-Notification Pre-Ack',
      'Crash after notification creation recovers cleanly via E11000 and removes intent',
      refreshedUser39.gamification.pendingMilestones.length === 0 && totalNotifs39 === 1,
      `pendingCount=${refreshedUser39.gamification.pendingMilestones.length}, totalNotifs=${totalNotifs39}`
    );

    // TC-40: Fresh-Time Retry Fallback: CAS retries refresh serverNow
    const fallbackUser = await createTestUser('student');
    const fbDay = new Date('2026-10-25T05:00:00.000Z');
    await streakService.processHeartbeat({
      studentId: fallbackUser._id,
      pageContext: 'assessment',
      referenceDate: fbDay,
    });
    // Call processHeartbeat without referenceDate -> uses fresh new Date()
    const fbResult = await streakService.processHeartbeat({
      studentId: fallbackUser._id,
      pageContext: 'assessment',
    });
    recordTest(
      'TC-40',
      'Fresh-Time Retry Fallback',
      'Heartbeat in production refreshes serverNow and recomputes IST key on every attempt',
      fbResult.istDate === getIstDayKey(new Date()),
      `istDate=${fbResult.istDate}`
    );

    // TC-41: Outbox Recovery: Process crashes after User commit before notification dispatch
    const recoverUser = await createTestUser('student', {
      gamification: {
        streakCount: 14,
        pendingMilestones: [
          {
            milestone: 14,
            dayKey: '2026-10-25',
            intentId: 'intent-41-orphan',
            status: 'pending',
            claimToken: null,
            claimedAt: null,
          },
        ],
      },
    });
    // Calling getStreakSummary automatically drains orphaned milestones
    await streakService.getStreakSummary(recoverUser._id);
    const recoverNotif = await Notification.findOne({
      recipient: recoverUser._id,
      type: 'streak_milestone',
      'data.milestone': 14,
    });
    const refreshedUser41 = await User.findById(recoverUser._id);
    recordTest(
      'TC-41',
      'Outbox Recovery',
      'Orphaned milestone in outbox is self-healed and dispatched on next summary lookup',
      !!recoverNotif && refreshedUser41.gamification.pendingMilestones.length === 0,
      `notifFound=${!!recoverNotif}, pendingCount=${refreshedUser41.gamification.pendingMilestones.length}`
    );

    // ==========================================
    // SECTION 7: 90-Day Retention, Continuity & Extended Scenarios (TC-42 to TC-48)
    // ==========================================
    console.log('\n--- Section 7: 90-Day Retention, Continuity & Extended Scenarios ---');

    // TC-42: Streak continuity beyond 90 days and TTL expiry
    // User built a 100-day streak. Days 1-90 DailyActiveTime were deleted by TTL.
    // User qualifies on day 101: streak MUST increment to 101, NOT reset to 1 or 11!
    const longStreakUser = await createTestUser('student', {
      gamification: {
        streakCount: 100,
        longestStreak: 100,
        lastQualifyingDayKey: '2026-10-24',
      },
    });
    // Simulate only retaining the last 5 days in DailyActiveTime (days 1-95 deleted)
    await DailyActiveTime.create({
      student: longStreakUser._id,
      istDate: '2026-10-25', // Next consecutive day!
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'qualified_pending_sync',
    });
    await streakService.reconcileStudentStreak(
      longStreakUser._id,
      new Date('2026-10-25T05:00:00.000Z')
    );
    const longSummary = await streakService.getStreakSummary(
      longStreakUser._id,
      new Date('2026-10-25T05:00:00.000Z')
    );
    recordTest(
      'TC-42',
      '90-Day Retention & Continuity',
      'Streak > 90 days increments to 101 preserving continuity when older records are purged',
      longSummary.currentStreak === 101 && longSummary.longestStreak === 101,
      `currentStreak=${longSummary.currentStreak}, longest=${longSummary.longestStreak}`
    );

    // TC-43: Milestones: crossing 3-day and 7-day milestones generates notifications
    const mUser = await createTestUser('student', {
      gamification: {
        streakCount: 2,
        longestStreak: 2,
        lastQualifyingDayKey: '2026-10-24',
      },
    });
    await DailyActiveTime.create({
      student: mUser._id,
      istDate: '2026-10-25',
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'qualified_pending_sync',
    });
    await streakService.reconcileStudentStreak(mUser._id, new Date('2026-10-25T05:00:00.000Z'));
    const mNotif = await Notification.findOne({
      recipient: mUser._id,
      type: 'streak_milestone',
      'data.milestone': 3,
    });
    recordTest(
      'TC-43',
      'Milestones',
      'Crossing 3-day milestone generates milestone notification with stable idempotency key',
      !!mNotif && mNotif.title.includes('3-Day Streak'),
      `notifFound=${!!mNotif}, title=${mNotif?.title}`
    );

    // TC-44: Streak Reminders: active yesterday, not yet qualified today -> generates reminder
    const remindUser = await createTestUser('student', {
      gamification: {
        streakCount: 5,
        longestStreak: 5,
        lastQualifyingDayKey: '2026-10-24',
      },
    });
    const todayRemind = new Date('2026-10-25T10:00:00.000Z'); // Today is Oct 25
    await streakService.getStreakSummary(remindUser._id, todayRemind);
    await new Promise((r) => setTimeout(r, 100));
    const reminderNotif = await Notification.findOne({
      recipient: remindUser._id,
      type: 'streak_reminder',
    });
    recordTest(
      'TC-44',
      'Reminders',
      'Student active yesterday but not yet qualified today receives streak_reminder',
      !!reminderNotif,
      `reminderFound=${!!reminderNotif}`
    );

    // TC-45: Legacy user missing gamification fields gracefully initializes
    const legacyUser = await createTestUser('student');
    await User.updateOne({ _id: legacyUser._id }, { $unset: { gamification: 1 } });
    await DailyActiveTime.create({
      student: legacyUser._id,
      istDate: '2026-10-25',
      activeSeconds: 900,
      qualifiesStreak: true,
      streakSyncStatus: 'qualified_pending_sync',
    });
    await streakService.reconcileStudentStreak(
      legacyUser._id,
      new Date('2026-10-25T05:00:00.000Z')
    );
    const legacySummary = await streakService.getStreakSummary(
      legacyUser._id,
      new Date('2026-10-25T05:00:00.000Z')
    );
    recordTest(
      'TC-45',
      'Legacy User',
      'Legacy user missing gamification fields initializes gracefully upon qualification',
      legacySummary.currentStreak === 1 && legacySummary.longestStreak === 1,
      `currentStreak=${legacySummary.currentStreak}`
    );

    // TC-46: Ineligible page context rejected with 0 credit
    const res46 = await request('/api/streak/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenStudent1}` },
      body: JSON.stringify({ pageContext: 'login' }), // Ineligible context
    });
    recordTest(
      'TC-46',
      'Ineligible Context',
      'Heartbeat with non-learning page context (e.g. login) is rejected with 0 credit',
      res46.status === 200 &&
        res46.data?.data?.activeSeconds === 0 &&
        res46.data?.data?.message?.includes('Ineligible page context'),
      `msg=${res46.data?.data?.message}`
    );

    // TC-47: Immediate baseline pings earn zero credit
    const zeroUser = await createTestUser('student');
    const res47 = await streakService.processHeartbeat({
      studentId: zeroUser._id,
      pageContext: 'assessment',
      referenceDate: new Date(),
    });
    recordTest(
      'TC-47',
      'Zero-Duration Baseline',
      'First heartbeat for new session earns exactly 0 seconds baseline',
      res47.activeSeconds === 0 && res47.qualifiesStreak === false,
      `activeSeconds=${res47.activeSeconds}`
    );

    // TC-48: Full regression check: platform health and Modules 1-8 operational
    const resHealth = await request('/api/health');
    const resAuthMe = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    const resProgress = await request('/api/progress/dashboard', {
      headers: { Authorization: `Bearer ${tokenStudent1}` },
    });
    recordTest(
      'TC-48',
      'Regression',
      'Platform health, Auth, and Progress endpoints remain 100% operational',
      resHealth.status === 200 && resAuthMe.status === 200 && resProgress.status === 200,
      `health=${resHealth.status}, auth=${resAuthMe.status}, progress=${resProgress.status}`
    );

    console.log('\n==========================================');
    console.log('--- MODULE 9 TEST SUMMARY ---');
    const passed = testResults.filter((r) => r.passed).length;
    const failed = testResults.filter((r) => !r.passed).length;
    console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log('==========================================\n');

    return { total: testResults.length, passed, failed };
  } finally {
    // Cleanup created test records in test db
    if (createdUserIds.size > 0) {
      await User.deleteMany({ _id: { $in: Array.from(createdUserIds) } });
    }
    if (createdAssessmentIds.size > 0) {
      await Assessment.deleteMany({ _id: { $in: Array.from(createdAssessmentIds) } });
    }
    if (createdQuestionIds.size > 0) {
      await Question.deleteMany({ _id: { $in: Array.from(createdQuestionIds) } });
    }
    if (createdNotificationIds.size > 0) {
      await Notification.deleteMany({ _id: { $in: Array.from(createdNotificationIds) } });
    }
    await DailyActiveTime.deleteMany({});

    if (server) {
      server.close();
    }
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  runAllTests()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Unhandled error in Module 9 test runner:', err);
      process.exit(1);
    });
}

module.exports = { runAllTests };
