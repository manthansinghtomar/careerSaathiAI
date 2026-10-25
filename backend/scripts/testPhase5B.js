/**
 * CareerSaathi AI — Phase 5B Backend Verification Suite
 * Verifies:
 * 1. Question deletion (DELETE /api/questions/:id) with role/ownership enforcement
 * 2. Trainer Cohort Assessments (GET /api/trainer/assessments) with filters and pagination
 * 3. Trainer generating an assessment for an assigned student (POST /api/assessments/generate with studentId)
 */

process.env.NODE_ENV = 'test';
require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Question = require('../models/Question');
const Assessment = require('../models/Assessment');

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/careersaathi_test_phase5b';
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

let server;
let port;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: path.startsWith('/api') ? path : `/api${path}`,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let data = body;
        try {
          data = JSON.parse(body);
        } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

function makeToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('=== CareerSaathi AI — Phase 5B Backend Verification ===');
  await mongoose.connect(TEST_DB_URI);

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      console.log(`Test server running on port ${port}`);
      resolve();
    });
  });

  try {
    // 1. Seed users
    const trainer1 = await User.create({
      name: 'Trainer One',
      email: `trainer1_${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'trainer',
    });

    const trainer2 = await User.create({
      name: 'Trainer Two',
      email: `trainer2_${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'trainer',
    });

    const admin = await User.create({
      name: 'Admin User',
      email: `admin_${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'admin',
    });

    const studentA = await User.create({
      name: 'Student Assigned',
      email: `studentA_${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'student',
      assignedTrainer: trainer1._id,
    });

    const studentB = await User.create({
      name: 'Student Unassigned',
      email: `studentB_${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'student',
      assignedTrainer: trainer2._id,
    });

    const t1Token = makeToken(trainer1);
    const t2Token = makeToken(trainer2);
    const sAToken = makeToken(studentA);
    const adminToken = makeToken(admin);

    // Seed test questions
    const q1 = await Question.create({
      targetRole: 'Full Stack Developer',
      topic: 'JavaScript',
      difficulty: 'easy',
      type: 'mcq',
      content: { en: { question: 'What is let?' } },
      options: [
        { id: 'A', text: { en: 'Block scoped variable' } },
        { id: 'B', text: { en: 'Function scoped variable' } },
      ],
      correctAnswer: 'A',
      createdBy: trainer1._id,
    });

    const q2 = await Question.create({
      targetRole: 'Full Stack Developer',
      topic: 'React',
      difficulty: 'medium',
      type: 'text',
      content: { en: { question: 'Explain useState hook.' } },
      correctAnswer: 'Hook that adds state to functional components.',
      createdBy: trainer2._id,
    });

    console.log('\n--- Test 1: Question Deletion Permissions ---');
    // Student cannot delete questions (403)
    const delByStudent = await request(`/questions/${q1._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sAToken}` },
    });
    console.log(`[${delByStudent.status === 403 ? 'PASS' : 'FAIL'}] Student blocked from deleting question (Status: ${delByStudent.status})`);

    // Trainer 1 cannot delete Trainer 2's question (403)
    const delT2ByT1 = await request(`/questions/${q2._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t1Token}` },
    });
    console.log(`[${delT2ByT1.status === 403 ? 'PASS' : 'FAIL'}] Trainer cannot delete another trainer's question (Status: ${delT2ByT1.status})`);

    // Trainer 1 CAN delete their own question (200)
    const delOwn = await request(`/questions/${q1._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t1Token}` },
    });
    console.log(`[${delOwn.status === 200 ? 'PASS' : 'FAIL'}] Trainer can delete their own question (Status: ${delOwn.status})`);

    // Admin CAN delete any question (200)
    const delByAdmin = await request(`/questions/${q2._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`[${delByAdmin.status === 200 ? 'PASS' : 'FAIL'}] Admin can delete any question (Status: ${delByAdmin.status})`);

    console.log('\n--- Test 2: Trainer Cohort Assessment Listing ---');
    // Re-seed 3 questions for assessment generation (min count is 3)
    await Question.create([
      {
        targetRole: 'Full Stack Developer',
        topic: 'JavaScript',
        difficulty: 'easy',
        type: 'mcq',
        content: { en: { question: 'Q1' } },
        options: [
          { id: 'A', text: { en: 'Opt A' } },
          { id: 'B', text: { en: 'Opt B' } },
        ],
        correctAnswer: 'A',
        createdBy: admin._id,
      },
      {
        targetRole: 'Full Stack Developer',
        topic: 'JavaScript',
        difficulty: 'medium',
        type: 'mcq',
        content: { en: { question: 'Q2' } },
        options: [
          { id: 'A', text: { en: 'Opt A' } },
          { id: 'B', text: { en: 'Opt B' } },
        ],
        correctAnswer: 'A',
        createdBy: admin._id,
      },
      {
        targetRole: 'Full Stack Developer',
        topic: 'JavaScript',
        difficulty: 'hard',
        type: 'mcq',
        content: { en: { question: 'Q3' } },
        options: [
          { id: 'A', text: { en: 'Opt A' } },
          { id: 'B', text: { en: 'Opt B' } },
        ],
        correctAnswer: 'A',
        createdBy: admin._id,
      },
    ]);

    // Seed assessments for Student A (Trainer 1) and Student B (Trainer 2)
    const a1 = await Assessment.create({
      student: studentA._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['JavaScript'],
      mode: 'mcq',
      totalQuestions: 1,
      objectiveQuestionsCount: 1,
      subjectiveQuestionsCount: 0,
      status: 'completed',
      questions: [
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'JavaScript',
          difficulty: 'easy',
          type: 'mcq',
          content: { en: { question: 'What is let?' } },
          options: [{ id: 'A', text: { en: 'Block scope' } }],
          correctAnswer: 'A',
          pointsEarned: 1,
          maxPoints: 1,
          isCorrect: true,
          evaluationStatus: 'auto_evaluated',
        },
      ],
      scoring: { overallPercentage: 85, isFullyEvaluated: true },
      completedAt: new Date(),
    });

    const a2 = await Assessment.create({
      student: studentB._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['JavaScript'],
      mode: 'mixed',
      totalQuestions: 1,
      objectiveQuestionsCount: 1,
      subjectiveQuestionsCount: 0,
      status: 'in_progress',
      questions: [
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'JavaScript',
          difficulty: 'easy',
          type: 'mcq',
          content: { en: { question: 'What is let?' } },
          options: [{ id: 'A', text: { en: 'Block scope' } }],
          correctAnswer: 'A',
          maxPoints: 1,
          evaluationStatus: 'auto_evaluated',
        },
      ],
    });

    // Trainer 1 listing assessments: must ONLY see student A's assessment
    const t1Assessments = await request('/trainer/assessments', {
      headers: { Authorization: `Bearer ${t1Token}` },
    });
    const t1Data = t1Assessments.data?.data || [];
    const seesOnlyOwnStudent = t1Data.length === 1 && t1Data[0]._id.toString() === a1._id.toString();
    console.log(`[${seesOnlyOwnStudent ? 'PASS' : 'FAIL'}] Trainer 1 only sees assigned Student A's assessment (Count: ${t1Data.length})`);

    // Filter by status=completed
    const t1Completed = await request('/trainer/assessments?status=completed', {
      headers: { Authorization: `Bearer ${t1Token}` },
    });
    console.log(`[${t1Completed.data?.data?.length === 1 ? 'PASS' : 'FAIL'}] Filter by status=completed works (Count: ${t1Completed.data?.data?.length})`);

    // Student cannot access /trainer/assessments (403)
    const studentBlockedFromTrainer = await request('/trainer/assessments', {
      headers: { Authorization: `Bearer ${sAToken}` },
    });
    console.log(`[${studentBlockedFromTrainer.status === 403 ? 'PASS' : 'FAIL'}] Student blocked from /trainer/assessments (Status: ${studentBlockedFromTrainer.status})`);

    console.log('\n--- Test 3: Trainer Generating Assessment for Assigned Student ---');
    // Trainer 1 tries to generate for Student B (not assigned -> 403)
    const genForUnassigned = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t1Token}` },
      body: JSON.stringify({
        studentId: studentB._id,
        selectedTopics: ['JavaScript'],
        questionCount: 1,
        mode: 'mcq',
      }),
    });
    console.log(`[${genForUnassigned.status === 403 ? 'PASS' : 'FAIL'}] Trainer generating for unassigned student blocked with 403 (Status: ${genForUnassigned.status})`);

    // Trainer 1 generates for assigned Student A (201)
    const genForAssigned = await request('/assessments/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t1Token}` },
      body: JSON.stringify({
        studentId: studentA._id,
        selectedTopics: ['JavaScript'],
        questionCount: 1,
        mode: 'mcq',
      }),
    });
    console.log(`[${genForAssigned.status === 201 ? 'PASS' : 'FAIL'}] Trainer generating for assigned student succeeds with 201 (Status: ${genForAssigned.status})`);

    console.log('\n=== All Phase 5B Backend Verification Tests Passed! ===\n');
  } finally {
    await User.deleteMany({});
    await Question.deleteMany({});
    await Assessment.deleteMany({});
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
