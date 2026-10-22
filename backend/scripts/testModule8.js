// Explicitly set test environment and dedicated test database BEFORE importing app/db
process.env.NODE_ENV = 'test';
require('dotenv').config();

// Dedicated test database - never touches production or primary development database
const originalMongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/careersaathi';
const TEST_DB_NAME = 'careersaathi_m8_test';
process.env.MONGO_URI = originalMongoUri.replace(/careersaathi(\?|$)/, `${TEST_DB_NAME}$1`);

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const Recommendation = require('../models/Recommendation');
const {
  persistRecommendation,
  buildRecommendationPrompt,
  generateHeuristicRecommendations,
  getOrGenerateRecommendations,
} = require('../services/recommendationService');

const RUN_ID = `m8_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
let server;
let API_BASE;

const createdUserIds = new Set();
const createdAssessmentIds = new Set();
const createdRecommendationIds = new Set();

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
  console.log(`=== CareerSaathi AI — Module 8 Hardened Test Suite [Run: ${RUN_ID}] ===`);
  console.log(`Target Database: ${process.env.MONGO_URI}\n`);

  let caughtError = null;

  try {
    // 1. Connect Mongoose to dedicated test database
    await mongoose.connect(process.env.MONGO_URI);

    // 2. Start ephemeral HTTP test server
    server = app.listen(0);
    const port = server.address().port;
    API_BASE = `http://127.0.0.1:${port}`;

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_m8';
    process.env.JWT_SECRET = jwtSecret;

    const primaryAdminEmail = 'primaryadmin@careersaathi.test';
    process.env.ADMIN_EMAIL = primaryAdminEmail;

    function generateToken(userId, role = 'student') {
      return jwt.sign({ id: userId.toString(), role }, jwtSecret, { expiresIn: '1d' });
    }

    async function createUser(overrides = {}) {
      const email = `u_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@test.com`;
      const user = new User({
        name: 'Test User',
        email,
        password: 'Password123!',
        role: 'student',
        preferredLanguage: 'en',
        isActive: true,
        careerProfile: {
          targetRole: 'Full Stack Developer',
          currentSkillLevel: 'beginner',
          focusSkills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        },
        ...overrides,
      });
      await user.save();
      createdUserIds.add(user._id.toString());
      return user;
    }

    // Baseline test accounts
    const primaryAdmin = await createUser({
      name: 'Platform Administrator',
      email: primaryAdminEmail,
      role: 'admin',
    });
    const adminToken = generateToken(primaryAdmin._id, 'admin');

    const trainerA = await createUser({
      name: 'Trainer A',
      role: 'trainer',
    });
    const trainerAToken = generateToken(trainerA._id, 'trainer');

    const trainerB = await createUser({
      name: 'Trainer B',
      role: 'trainer',
    });
    const trainerBToken = generateToken(trainerB._id, 'trainer');

    const studentA = await createUser({
      name: 'Student A',
      role: 'student',
      assignedTrainer: trainerA._id,
    });
    const studentAToken = generateToken(studentA._id, 'student');

    const studentB = await createUser({
      name: 'Student B',
      role: 'student',
      assignedTrainer: trainerB._id,
    });
    const studentBToken = generateToken(studentB._id, 'student');

    const unassignedStudent = await createUser({
      name: 'Unassigned Student',
      role: 'student',
      assignedTrainer: null,
    });
    const unassignedStudentToken = generateToken(unassignedStudent._id, 'student');

    // ==========================================
    // Category 1: RBAC Boundaries & Protection
    // ==========================================

    // TC-01: Unauthenticated request calling /api/recommendations/* is rejected with 401 Unauthorized
    {
      const res = await request('/api/recommendations/my');
      recordTest(
        'TC-01',
        'RBAC',
        'Unauthenticated request calling /api/recommendations/* is rejected with 401 Unauthorized',
        res.status === 401 && res.data.success === false,
        `Status: ${res.status}`
      );
    }

    // TC-02: Student calling /api/recommendations/students/:studentId is rejected with 403 Forbidden
    {
      const res = await request(`/api/recommendations/students/${studentB._id}`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      recordTest(
        'TC-02',
        'RBAC',
        'Student calling /api/recommendations/students/:studentId is rejected with 403 Forbidden',
        res.status === 403 && res.data.success === false,
        `Status: ${res.status}`
      );
    }

    // TC-03: Trainer calling /api/recommendations/my is rejected with 403 Forbidden
    {
      const res = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${trainerAToken}` },
      });
      recordTest(
        'TC-03',
        'RBAC',
        'Trainer calling /api/recommendations/my is rejected with 403 Forbidden',
        res.status === 403 && res.data.success === false,
        `Status: ${res.status}`
      );
    }

    // TC-04: Trainer A accessing Student B (assigned to Trainer B) is blocked with 403 Forbidden
    {
      const res = await request(`/api/recommendations/students/${studentB._id}`, {
        headers: { Authorization: `Bearer ${trainerAToken}` },
      });
      recordTest(
        'TC-04',
        'RBAC',
        'Trainer A accessing Student B (assigned to Trainer B) is blocked with 403 Forbidden',
        res.status === 403 && res.data.message.includes('assigned students'),
        `Status: ${res.status}`
      );
    }

    // TC-05: Trainer accessing unassigned student recommendations is blocked with 403 Forbidden
    {
      const res = await request(`/api/recommendations/students/${unassignedStudent._id}`, {
        headers: { Authorization: `Bearer ${trainerAToken}` },
      });
      recordTest(
        'TC-05',
        'RBAC',
        'Trainer accessing unassigned student recommendations is blocked with 403 Forbidden',
        res.status === 403 && res.data.message.includes('assigned students'),
        `Status: ${res.status}`
      );
    }

    // TC-06: Trainer accessing assigned student recommendations is authorized (200 OK)
    {
      const res = await request(`/api/recommendations/students/${studentA._id}`, {
        headers: { Authorization: `Bearer ${trainerAToken}` },
      });
      recordTest(
        'TC-06',
        'RBAC',
        'Trainer accessing assigned student recommendations is authorized (200 OK)',
        res.status === 200 && res.data.success === true && res.data.data.recommendedTopics !== undefined,
        `Status: ${res.status}`
      );
    }

    // TC-07: Admin accessing any student recommendations is authorized (200 OK)
    {
      const res = await request(`/api/recommendations/students/${studentB._id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      recordTest(
        'TC-07',
        'RBAC',
        'Admin accessing any student recommendations is authorized (200 OK)',
        res.status === 200 && res.data.success === true && res.data.data.recommendedTopics !== undefined,
        `Status: ${res.status}`
      );
    }

    // ==========================================
    // Category 2: Cold Start & Edge Cases
    // ==========================================

    // TC-08: Brand-new student (0 assessments) receives valid recommendations for focus skills
    let coldStudent;
    {
      coldStudent = await createUser({
        role: 'student',
        careerProfile: {
          targetRole: 'Full Stack Developer',
          currentSkillLevel: 'beginner',
          focusSkills: ['React', 'JavaScript'],
        },
      });
      const coldToken = generateToken(coldStudent._id);

      const res = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${coldToken}` },
      });

      const data = res.data?.data;
      const valid =
        res.status === 200 &&
        data.performanceSnapshot.totalAssessmentsCompleted === 0 &&
        data.recommendedTopics.some((t) => t.topic === 'React' || t.topic === 'JavaScript') &&
        data.practiceAssessments.length >= 1;

      recordTest(
        'TC-08',
        'ColdStart',
        'Brand-new student (0 assessments) receives valid recommendations for focus skills',
        valid,
        `Topics: ${data?.recommendedTopics?.map((t) => t.topic).join(', ')}`
      );
    }

    // TC-09: Student with missing/sparse career profile uses safe platform defaults
    {
      const sparseStudent = await createUser({
        role: 'student',
        careerProfile: {
          targetRole: '',
          focusSkills: [],
        },
      });
      const sparseToken = generateToken(sparseStudent._id);

      const res = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${sparseToken}` },
      });

      const data = res.data?.data;
      recordTest(
        'TC-09',
        'EdgeCase',
        'Student with missing/sparse career profile uses safe platform defaults',
        res.status === 200 && data.profileSnapshot.targetRole === 'Full Stack Developer' && data.recommendedTopics.length > 0,
        `DefaultRole: ${data?.profileSnapshot?.targetRole}`
      );
    }

    // TC-10: Student with pending subjective evaluations does not treat pending questions as 0% weak
    {
      const pendingStudent = await createUser({ role: 'student' });
      const pendingAssessment = new Assessment({
        student: pendingStudent._id,
        targetRole: 'Full Stack Developer',
        selectedTopics: ['React'],
        status: 'completed',
        totalQuestions: 1,
        questions: [
          {
            questionId: new mongoose.Types.ObjectId(),
            topic: 'React',
            difficulty: 'medium',
            type: 'text',
            evaluationStatus: 'pending_evaluation',
            pointsEarned: 0,
            maxPoints: 1,
            correctAnswer: 'Sample reference answer',
            content: { en: { question: 'What is useEffect?' } },
          },
        ],
        scoring: {
          overallPercentage: 0,
          isFullyEvaluated: false,
        },
        completedAt: new Date(),
      });
      await pendingAssessment.save();
      createdAssessmentIds.add(pendingAssessment._id.toString());

      const token = generateToken(pendingStudent._id);
      const res = await request('/api/recommendations/my?refresh=true', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const perf = res.data?.data?.performanceSnapshot;
      recordTest(
        'TC-10',
        'EdgeCase',
        'Student with pending subjective evaluations does not treat pending questions as 0% weak',
        res.status === 200 && (perf.overallPercentage === null || perf.overallPercentage === 0) && !perf.weakTopics.includes('React'),
        `WeakTopics: ${perf?.weakTopics?.join(', ') || 'None'}`
      );
    }

    // ==========================================
    // Category 3: Recommendation Engine Accuracy
    // ==========================================

    // Seed student with evaluated assessments demonstrating weak React and strong JavaScript
    const activeStudent = await createUser({
      role: 'student',
      careerProfile: {
        targetRole: 'Full Stack Developer',
        currentSkillLevel: 'beginner',
        focusSkills: ['JavaScript', 'React', 'MongoDB'],
      },
    });
    const activeStudentToken = generateToken(activeStudent._id);

    const assessedTest = new Assessment({
      student: activeStudent._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['JavaScript', 'React'],
      status: 'completed',
      totalQuestions: 4,
      questions: [
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'JavaScript',
          difficulty: 'easy',
          type: 'mcq',
          isCorrect: true,
          correctAnswer: 'A',
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 1,
          maxPoints: 1,
          content: { en: { question: 'JS Q1' } },
        },
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'JavaScript',
          difficulty: 'easy',
          type: 'mcq',
          isCorrect: true,
          correctAnswer: 'A',
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 1,
          maxPoints: 1,
          content: { en: { question: 'JS Q2' } },
        },
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'JavaScript',
          difficulty: 'easy',
          type: 'mcq',
          isCorrect: true,
          correctAnswer: 'A',
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 1,
          maxPoints: 1,
          content: { en: { question: 'JS Q3' } },
        },
        {
          questionId: new mongoose.Types.ObjectId(),
          topic: 'React',
          difficulty: 'easy',
          type: 'mcq',
          isCorrect: false,
          correctAnswer: 'B',
          evaluationStatus: 'auto_evaluated',
          pointsEarned: 0,
          maxPoints: 1,
          content: { en: { question: 'React Q1' } },
        },
      ],
      scoring: {
        overallPercentage: 75,
        isFullyEvaluated: true,
      },
      weakTopics: ['React'],
      completedAt: new Date(),
    });
    await assessedTest.save();
    createdAssessmentIds.add(assessedTest._id.toString());

    // TC-11: Recommends weak topics (< 60% accuracy) as high priority
    {
      const res = await request('/api/recommendations/my?refresh=true', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });
      const data = res.data?.data;
      const reactRec = data.recommendedTopics.find((t) => t.topic === 'React');
      recordTest(
        'TC-11',
        'Engine',
        'Recommends weak topics (< 60% accuracy) as high priority',
        res.status === 200 && reactRec !== undefined && reactRec.priority === 'high',
        `ReactPriority: ${reactRec?.priority}`
      );
    }

    // TC-12: Recommends unassessed focus skills as medium/high priority
    {
      const res = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });
      const data = res.data?.data;
      const mongoRec = data.recommendedTopics.find((t) => t.topic === 'MongoDB');
      recordTest(
        'TC-12',
        'Engine',
        'Recommends unassessed focus skills as medium/high priority',
        res.status === 200 && mongoRec !== undefined && (mongoRec.priority === 'medium' || mongoRec.priority === 'high'),
        `MongoPriority: ${mongoRec?.priority}`
      );
    }

    // TC-13: Generates actionable next learning steps conforming to schema
    {
      const res = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });
      const nextActions = res.data?.data?.nextActions || [];
      const valid =
        nextActions.length > 0 &&
        nextActions.every(
          (a) => typeof a.action === 'string' && a.action.trim() && typeof a.estimatedMinutes === 'number'
        );
      recordTest(
        'TC-13',
        'Engine',
        'Generates actionable next learning steps conforming to schema',
        res.status === 200 && valid,
        `ActionsCount: ${nextActions.length}`
      );
    }

    // TC-14: Generates valid practice assessment launch blueprint conforming to Module 3 format
    {
      const res = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });
      const pa = res.data?.data?.practiceAssessments?.[0];
      const valid =
        pa !== undefined &&
        pa.launchConfig?.endpoint === '/api/assessments/generate' &&
        pa.launchConfig?.method === 'POST' &&
        Array.isArray(pa.launchConfig?.body?.selectedTopics) &&
        pa.launchConfig?.body?.selectedTopics.length > 0;

      recordTest(
        'TC-14',
        'Engine',
        'Generates valid practice assessment launch blueprint conforming to Module 3 format',
        res.status === 200 && valid,
        `Endpoint: ${pa?.launchConfig?.endpoint}, Topics: ${pa?.launchConfig?.body?.selectedTopics?.join(', ')}`
      );
    }

    // TC-15: Preferred language hinglish generates Roman-script Hinglish advice
    {
      const hinglishStudent = await createUser({
        role: 'student',
        preferredLanguage: 'hinglish',
        careerProfile: {
          targetRole: 'Full Stack Developer',
          currentSkillLevel: 'beginner',
          focusSkills: ['React'],
        },
      });
      const hToken = generateToken(hinglishStudent._id);

      const res = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${hToken}` },
      });

      const data = res.data?.data;
      const hasHinglish =
        data.recommendedTopics.some((t) => t.reason.includes('Aap') || t.reason.includes('hai')) ||
        data.nextActions.some((a) => a.action.includes('karein') || a.action.includes('lein'));

      recordTest(
        'TC-15',
        'Engine',
        'Preferred language hinglish generates Roman-script Hinglish advice',
        res.status === 200 && hasHinglish,
        `SampleReason: ${data?.recommendedTopics?.[0]?.reason?.substring(0, 40)}...`
      );
    }

    // ==========================================
    // Category 4: Fallback & Resilience
    // ==========================================

    // TC-16: When AI provider throws network error, deterministic fallback activates
    {
      // Using recommendationService unit execution with failing mock transport
      const failingTransport = async () => {
        throw new Error('Network timeout: Gemini service unreachable');
      };

      const result = await getOrGenerateRecommendations({
        studentId: activeStudent._id,
        forceRefresh: true,
        transportOverride: failingTransport,
      });

      recordTest(
        'TC-16',
        'Fallback',
        'When AI provider throws network error, deterministic fallback activates',
        result.recommendation.source === 'rule_based_fallback' && result.recommendation.fallbackReason.includes('unreachable'),
        `Source: ${result.recommendation.source}`
      );
    }

    // TC-17: When AI returns malformed non-JSON, deterministic fallback activates
    {
      const malformedTransport = async () => {
        return 'I am an AI assistant and I cannot return JSON right now.';
      };

      const result = await getOrGenerateRecommendations({
        studentId: activeStudent._id,
        forceRefresh: true,
        transportOverride: malformedTransport,
      });

      recordTest(
        'TC-17',
        'Fallback',
        'When AI returns malformed non-JSON, deterministic fallback activates',
        result.recommendation.source === 'rule_based_fallback' && result.recommendation.fallbackReason.includes('JSON'),
        `Source: ${result.recommendation.source}`
      );
    }

    // TC-18: Deterministic fallback accurately ranks weak topics above strong topics
    {
      const heuristic = generateHeuristicRecommendations({
        profile: { targetRole: 'Full Stack Developer', currentSkillLevel: 'beginner', focusSkills: ['React', 'JavaScript'] },
        performance: {
          overallPercentage: 60,
          totalAssessmentsCompleted: 2,
          weakTopics: ['React'],
          topicBreakdown: [
            { topic: 'React', accuracyPercentage: 30, status: 'weak' },
            { topic: 'JavaScript', accuracyPercentage: 90, status: 'strong' },
          ],
        },
      });

      const topTopic = heuristic.recommendedTopics[0];
      recordTest(
        'TC-18',
        'Fallback',
        'Deterministic fallback accurately ranks weak topics above strong topics',
        topTopic.topic === 'React' && topTopic.priority === 'high',
        `Rank1: ${topTopic.topic} (Priority: ${topTopic.priority})`
      );
    }

    // TC-19: Deterministic fallback calibrates difficulty to student skill level and scores
    {
      const advHeuristic = generateHeuristicRecommendations({
        profile: { targetRole: 'Full Stack Developer', currentSkillLevel: 'advanced', focusSkills: ['Node.js'] },
        performance: {
          overallPercentage: 90,
          totalAssessmentsCompleted: 5,
          weakTopics: [],
          topicBreakdown: [{ topic: 'Node.js', accuracyPercentage: 90, status: 'strong' }],
        },
      });

      const diff = advHeuristic.practiceAssessments[0].difficulty;
      recordTest(
        'TC-19',
        'Fallback',
        'Deterministic fallback calibrates difficulty to student skill level and scores',
        diff === 'hard',
        `CalibratedDifficulty: ${diff}`
      );
    }

    // ==========================================
    // Category 5: Caching & Invalidation
    // ==========================================

    // TC-20: Second request within TTL returns cached recommendation without re-running AI
    {
      const res1 = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });
      const res2 = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });

      recordTest(
        'TC-20',
        'Cache',
        'Second request within TTL returns cached recommendation without re-running AI',
        res2.status === 200 && res2.data.data.isCached === true,
        `IsCached: ${res2.data?.data?.isCached}`
      );
    }

    // TC-21: ?refresh=true forces cache invalidation and fresh generation
    {
      const res = await request('/api/recommendations/my?refresh=true', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });
      recordTest(
        'TC-21',
        'Cache',
        '?refresh=true forces cache invalidation and fresh generation',
        res.status === 200 && res.data.data.isCached === false,
        `IsCached: ${res.data?.data?.isCached}`
      );
    }

    // TC-22: Completing a new assessment invalidates cached recommendation
    {
      // First prime cache
      await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });

      // Complete a new assessment
      const newTest = new Assessment({
        student: activeStudent._id,
        targetRole: 'Full Stack Developer',
        selectedTopics: ['MongoDB'],
        status: 'completed',
        totalQuestions: 1,
        questions: [
          {
            questionId: new mongoose.Types.ObjectId(),
            topic: 'MongoDB',
            difficulty: 'easy',
            type: 'mcq',
            isCorrect: true,
            pointsEarned: 1,
            maxPoints: 1,
            correctAnswer: 'A',
            content: { en: { question: 'Mongo test' } },
          },
        ],
        completedAt: new Date(),
      });
      await newTest.save();
      createdAssessmentIds.add(newTest._id.toString());

      // Query recommendations without refresh=true -> should invalidate due to newer assessment updatedAt
      const resAfter = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });

      recordTest(
        'TC-22',
        'Cache',
        'Completing a new assessment invalidates cached recommendation',
        resAfter.status === 200 && resAfter.data.data.isCached === false,
        `IsCachedAfterNewTest: ${resAfter.data?.data?.isCached}`
      );
    }

    // TC-23: Updating student career profile (PUT /api/auth/profile) invalidates cache
    {
      // Prime cache
      await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });

      // Update student profile
      await request('/api/auth/profile', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${activeStudentToken}` },
        body: JSON.stringify({ currentSkillLevel: 'advanced' }),
      });

      // Fetch recommendations without refresh flag -> should be invalidated due to student.updatedAt
      const resAfter = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });

      recordTest(
        'TC-23',
        'Cache',
        'Updating student career profile invalidates cache',
        resAfter.status === 200 && resAfter.data.data.isCached === false,
        `IsCachedAfterProfileUpdate: ${resAfter.data?.data?.isCached}`
      );
    }

    // TC-24: In-code expiresAt check invalidates expired cache even if TTL document persists
    {
      // Manually set cache expiresAt in the past
      await Recommendation.updateOne(
        { student: activeStudent._id },
        { $set: { expiresAt: new Date(Date.now() - 5000) } }
      );

      const resAfter = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });

      recordTest(
        'TC-24',
        'Cache',
        'In-code expiresAt check invalidates expired cache even if TTL document persists',
        resAfter.status === 200 && resAfter.data.data.isCached === false,
        `IsCachedAfterExpiredTTL: ${resAfter.data?.data?.isCached}`
      );
    }

    // ==========================================
    // Category 6: Concurrency & Privacy
    // ==========================================

    // TC-25: Lagging concurrent request does not overwrite newer recommendation data
    {
      const concurrencyStudent = await createUser({ role: 'student' });

      const newerTime = new Date(Date.now() + 10000);
      const laggingTime = new Date(Date.now() - 5000);

      // Seed newer recommendation
      await persistRecommendation(
        concurrencyStudent._id,
        {
          source: 'ai',
          modelUsed: 'gemini-3.8-flash',
          recommendedTopics: [{ topic: 'React', priority: 'high', reason: 'Newer data' }],
          nextActions: [{ action: 'Newer action', category: 'practice', estimatedMinutes: 20 }],
          practiceAssessments: [{ targetRole: 'Full Stack Developer', selectedTopics: ['React'], difficulty: 'easy', reason: 'Newer' }],
        },
        newerTime
      );

      // Simulate lagging generation trying to save older data
      const laggingResult = await persistRecommendation(
        concurrencyStudent._id,
        {
          source: 'rule_based_fallback',
          modelUsed: null,
          recommendedTopics: [{ topic: 'JavaScript', priority: 'low', reason: 'Stale data' }],
          nextActions: [{ action: 'Stale action', category: 'study', estimatedMinutes: 10 }],
          practiceAssessments: [{ targetRole: 'Full Stack Developer', selectedTopics: ['JavaScript'], difficulty: 'easy', reason: 'Stale' }],
        },
        laggingTime
      );

      const dbDoc = await Recommendation.findOne({ student: concurrencyStudent._id });

      const preservedNewer =
        new Date(dbDoc.generatedAt).getTime() === newerTime.getTime() &&
        dbDoc.recommendedTopics[0].reason === 'Newer data' &&
        laggingResult.recommendedTopics[0].reason === 'Newer data';

      recordTest(
        'TC-25',
        'Concurrency',
        'Lagging concurrent request does not overwrite newer recommendation data',
        preservedNewer,
        `DB_GeneratedAt: ${dbDoc.generatedAt.toISOString()}, ReturnedReason: ${laggingResult.recommendedTopics[0].reason}`
      );
    }

    // TC-26: Concurrent first-time requests safely handle E11000 duplicate-key error without failure
    {
      const firstTimeStudent = await createUser({ role: 'student' });
      const now = new Date();

      // Launch 2 concurrent calls simultaneously
      const [resA, resB] = await Promise.all([
        persistRecommendation(
          firstTimeStudent._id,
          {
            source: 'ai',
            recommendedTopics: [{ topic: 'React', priority: 'high', reason: 'Concurrent A' }],
            nextActions: [{ action: 'Action A', category: 'practice', estimatedMinutes: 20 }],
            practiceAssessments: [{ targetRole: 'Full Stack Developer', selectedTopics: ['React'], difficulty: 'easy', reason: 'Test A' }],
          },
          now
        ),
        persistRecommendation(
          firstTimeStudent._id,
          {
            source: 'rule_based_fallback',
            recommendedTopics: [{ topic: 'Node.js', priority: 'high', reason: 'Concurrent B' }],
            nextActions: [{ action: 'Action B', category: 'study', estimatedMinutes: 20 }],
            practiceAssessments: [{ targetRole: 'Full Stack Developer', selectedTopics: ['Node.js'], difficulty: 'easy', reason: 'Test B' }],
          },
          now
        ),
      ]);

      const docCount = await Recommendation.countDocuments({ student: firstTimeStudent._id });

      recordTest(
        'TC-26',
        'Concurrency',
        'Concurrent first-time requests safely handle E11000 duplicate-key error without failure',
        resA !== null && resB !== null && docCount === 1,
        `DocCount: ${docCount}, BothResolved: ${resA !== null && resB !== null}`
      );
    }

    // TC-27: AI prompt and client responses strictly exclude passwords, tokens, and answer keys
    {
      const res = await request('/api/recommendations/my', {
        headers: { Authorization: `Bearer ${activeStudentToken}` },
      });
      const data = res.data?.data || {};

      const prompt = buildRecommendationPrompt({
        profile: activeStudent.careerProfile,
        performance: { overallPercentage: 80, totalAssessmentsCompleted: 1, weakTopics: [] },
      });

      const zeroLeakage =
        data.password === undefined &&
        data.correctAnswer === undefined &&
        data.evaluationLockToken === undefined &&
        !prompt.includes(activeStudent.email) &&
        !prompt.includes('Password123!');

      recordTest(
        'TC-27',
        'Privacy',
        'AI prompt and client responses strictly exclude passwords, tokens, and answer keys',
        res.status === 200 && zeroLeakage,
        'Zero sensitive credentials or solution keys exposed'
      );
    }

    // ==========================================
    // Category 7: Modules 1–7 Regression
    // ==========================================

    // TC-28: Regression test verifying Modules 1–7 routes remain 100% operational
    {
      const [healthRes, meRes, questionsRes, assessmentsRes, progressRes, trainerRes, adminRes] = await Promise.all([
        request('/api/health'),
        request('/api/auth/me', { headers: { Authorization: `Bearer ${studentAToken}` } }),
        request('/api/questions', { headers: { Authorization: `Bearer ${trainerAToken}` } }),
        request('/api/assessments/my', { headers: { Authorization: `Bearer ${studentAToken}` } }),
        request('/api/progress/dashboard', { headers: { Authorization: `Bearer ${studentAToken}` } }),
        request('/api/trainer/dashboard', { headers: { Authorization: `Bearer ${trainerAToken}` } }),
        request('/api/admin/dashboard', { headers: { Authorization: `Bearer ${adminToken}` } }),
      ]);

      const allOk =
        healthRes.status === 200 &&
        meRes.status === 200 &&
        questionsRes.status === 200 &&
        assessmentsRes.status === 200 &&
        progressRes.status === 200 &&
        trainerRes.status === 200 &&
        adminRes.status === 200;

      recordTest(
        'TC-28',
        'Regression',
        'Regression test verifying Modules 1–7 routes remain 100% operational',
        allOk,
        `Health: ${healthRes.status}, Me: ${meRes.status}, Questions: ${questionsRes.status}, Assessments: ${assessmentsRes.status}, Progress: ${progressRes.status}, Trainer: ${trainerRes.status}, Admin: ${adminRes.status}`
      );
    }
  } catch (err) {
    caughtError = err;
    console.error('Fatal Test Execution Error:', err);
  } finally {
    // Teardown: Clean up test documents in careersaathi_m8_test
    try {
      if (createdUserIds.size > 0) {
        await User.deleteMany({ _id: { $in: Array.from(createdUserIds) } });
      }
      if (createdAssessmentIds.size > 0) {
        await Assessment.deleteMany({ _id: { $in: Array.from(createdAssessmentIds) } });
      }
      if (createdRecommendationIds.size > 0) {
        await Recommendation.deleteMany({ _id: { $in: Array.from(createdRecommendationIds) } });
      }
    } catch (cleanupErr) {
      console.warn('Cleanup Warning:', cleanupErr.message);
    }

    if (server) {
      server.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  // Final Summary
  const passedCount = testResults.filter((t) => t.passed).length;
  const totalCount = testResults.length;
  console.log(`\n=== Module 8 Test Suite Summary: ${passedCount}/${totalCount} PASSED ===`);

  if (caughtError || passedCount !== totalCount) {
    console.error(`\nTest suite completed with failures: ${totalCount - passedCount} failed`);
    process.exit(1);
  } else {
    console.log('\nAll Module 8 tests completed successfully!');
    process.exit(0);
  }
}

runAllTests();
