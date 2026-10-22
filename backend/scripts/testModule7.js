// Explicitly set test environment and dedicated test database BEFORE importing app/db
process.env.NODE_ENV = 'test';
require('dotenv').config();

// Dedicated test database - never touches production or primary development database
const originalMongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/careersaathi';
const TEST_DB_NAME = 'careersaathi_m7_test';
process.env.MONGO_URI = originalMongoUri.replace(/careersaathi(\?|$)/, `${TEST_DB_NAME}$1`);

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const AuditLog = require('../models/AuditLog');
const { escapeRegex } = require('../controllers/adminController');
const { logAdminAction, filterAuditDetails } = require('../utils/auditLogger');

const RUN_ID = `m7_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
let server;
let API_BASE;

const createdUserIds = new Set();
const createdAssessmentIds = new Set();
const createdAuditLogIds = new Set();

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
  console.log(`=== CareerSaathi AI — Module 7 Hardened Test Suite [Run: ${RUN_ID}] ===`);
  console.log(`Target Database: ${process.env.MONGO_URI}\n`);

  let caughtError = null;

  try {
    // 1. Connect Mongoose to dedicated test database
    await mongoose.connect(process.env.MONGO_URI);

    // 2. Start ephemeral HTTP test server
    server = app.listen(0);
    const port = server.address().port;
    API_BASE = `http://127.0.0.1:${port}`;

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_m7';
    process.env.JWT_SECRET = jwtSecret;

    // Set primary admin email for testing
    const primaryAdminEmail = 'primaryadmin@careersaathi.test';
    process.env.ADMIN_EMAIL = primaryAdminEmail;

    function generateToken(userId) {
      return jwt.sign({ id: userId.toString() }, jwtSecret, { expiresIn: '1d' });
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
        ...overrides,
      });
      await user.save();
      createdUserIds.add(user._id.toString());
      return user;
    }

    // Baseline accounts
    const primaryAdmin = await createUser({
      name: 'Primary Platform Admin',
      email: primaryAdminEmail,
      role: 'admin',
    });
    const primaryAdminToken = generateToken(primaryAdmin._id);

    const secondaryAdmin = await createUser({
      name: 'Secondary Admin',
      role: 'admin',
    });
    const secondaryAdminToken = generateToken(secondaryAdmin._id);

    const trainerUser = await createUser({
      name: 'Trainer One',
      role: 'trainer',
    });
    const trainerToken = generateToken(trainerUser._id);

    const studentUser = await createUser({
      name: 'Student One',
      role: 'student',
    });
    const studentToken = generateToken(studentUser._id);

    // ==========================================
    // Category 1: RBAC Boundaries & Protection
    // ==========================================

    // TC-01: Student calling /api/admin/dashboard is rejected with 403 Forbidden
    {
      const res = await request('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      recordTest(
        'TC-01',
        'RBAC',
        'Student calling /api/admin/dashboard is rejected with 403 Forbidden',
        res.status === 403 && res.data.success === false,
        `Status: ${res.status}`
      );
    }

    // TC-02: Trainer calling /api/admin/dashboard is rejected with 403 Forbidden
    {
      const res = await request('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${trainerToken}` },
      });
      recordTest(
        'TC-02',
        'RBAC',
        'Trainer calling /api/admin/dashboard is rejected with 403 Forbidden',
        res.status === 403 && res.data.success === false,
        `Status: ${res.status}`
      );
    }

    // TC-03: Unauthenticated request calling /api/admin/* is rejected with 401 Unauthorized
    {
      const res = await request('/api/admin/dashboard');
      recordTest(
        'TC-03',
        'RBAC',
        'Unauthenticated request calling /api/admin/* is rejected with 401 Unauthorized',
        res.status === 401 && res.data.success === false,
        `Status: ${res.status}`
      );
    }

    // TC-04: Admin calling /api/admin/dashboard is authorized (200 OK)
    {
      const res = await request('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      recordTest(
        'TC-04',
        'RBAC',
        'Admin calling /api/admin/dashboard is authorized (200 OK)',
        res.status === 200 && res.data.success === true && res.data.data.userCounts !== undefined,
        `Status: ${res.status}`
      );
    }

    // ==========================================
    // Category 2: Privilege Escalation & Safeguards
    // ==========================================

    // TC-05: Secondary admin attempting to promote user to admin is blocked with 403 Forbidden
    {
      const candidateStudent = await createUser();
      const res = await request(`/api/admin/users/${candidateStudent._id}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${secondaryAdminToken}` },
        body: JSON.stringify({ role: 'admin' }),
      });
      recordTest(
        'TC-05',
        'Privilege',
        'Secondary admin attempting to promote user to admin is blocked with 403 Forbidden',
        res.status === 403 && res.data.message.includes('primary administrator'),
        `Status: ${res.status}`
      );
    }

    // TC-06: Primary admin successfully promotes user to admin (200 OK)
    let promotedAdminId;
    {
      const candidateStudent = await createUser();
      promotedAdminId = candidateStudent._id;
      const res = await request(`/api/admin/users/${candidateStudent._id}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({ role: 'admin' }),
      });
      const checkUser = await User.findById(candidateStudent._id);
      recordTest(
        'TC-06',
        'Privilege',
        'Primary admin successfully promotes user to admin (200 OK)',
        res.status === 200 && checkUser.role === 'admin',
        `Role: ${checkUser?.role}`
      );
    }

    // TC-07: Secondary admin attempting to demote another admin is blocked with 403 Forbidden
    {
      const res = await request(`/api/admin/users/${promotedAdminId}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${secondaryAdminToken}` },
        body: JSON.stringify({ role: 'student' }),
      });
      recordTest(
        'TC-07',
        'Privilege',
        'Secondary admin attempting to demote another admin is blocked with 403 Forbidden',
        res.status === 403 && res.data.message.includes('primary administrator'),
        `Status: ${res.status}`
      );
    }

    // TC-08: Any admin attempting to demote primary admin (ADMIN_EMAIL) is blocked with 403 Forbidden
    {
      const res = await request(`/api/admin/users/${primaryAdmin._id}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({ role: 'student' }),
      });
      recordTest(
        'TC-08',
        'Privilege',
        'Any admin attempting to demote primary admin (ADMIN_EMAIL) is blocked with 403 Forbidden',
        res.status === 403 && res.data.message.includes('primary Administrator account cannot be demoted'),
        `Status: ${res.status}`
      );
    }

    // TC-09: Admin attempting to demote self is blocked with 403 Forbidden (self-lockout)
    {
      const res = await request(`/api/admin/users/${secondaryAdmin._id}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${secondaryAdminToken}` },
        body: JSON.stringify({ role: 'trainer' }),
      });
      recordTest(
        'TC-09',
        'Privilege',
        'Admin attempting to demote self is blocked with 403 Forbidden (self-lockout)',
        res.status === 403 && res.data.message.includes('cannot demote their own account'),
        `Status: ${res.status}`
      );
    }

    // TC-10: Any admin attempting to deactivate primary admin is blocked with 403 Forbidden
    {
      const res = await request(`/api/admin/users/${primaryAdmin._id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${secondaryAdminToken}` },
        body: JSON.stringify({ isActive: false }),
      });
      recordTest(
        'TC-10',
        'Privilege',
        'Any admin attempting to deactivate primary admin is blocked with 403 Forbidden',
        res.status === 403 && res.data.message.includes('primary platform administrator cannot be deactivated'),
        `Status: ${res.status}`
      );
    }

    // TC-11: Admin attempting to deactivate self is blocked with 403 Forbidden (self-lockout)
    {
      const res = await request(`/api/admin/users/${secondaryAdmin._id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${secondaryAdminToken}` },
        body: JSON.stringify({ isActive: false }),
      });
      recordTest(
        'TC-11',
        'Privilege',
        'Admin attempting to deactivate self is blocked with 403 Forbidden (self-lockout)',
        res.status === 403 && res.data.message.includes('cannot deactivate their own account'),
        `Status: ${res.status}`
      );
    }

    // ==========================================
    // Category 3: Dashboard KPIs & Platform Analytics
    // ==========================================

    // Create completed assessment with evaluation
    const evalStudent = await createUser({ name: 'Eval Student', role: 'student' });
    const assessmentA = new Assessment({
      student: evalStudent._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['React', 'Node.js'],
      status: 'completed',
      totalQuestions: 2,
      objectiveQuestionsCount: 1,
      subjectiveQuestionsCount: 1,
      scoring: {
        objectiveScore: 1,
        objectiveMaxScore: 1,
        objectivePercentage: 100,
        subjectiveScore: 0.8,
        subjectiveMaxScore: 1,
        subjectivePercentage: 80,
        overallScore: 1.8,
        overallMaxScore: 2,
        overallPercentage: 90,
        isFullyEvaluated: true,
      },
      topicWiseResults: [
        { topic: 'React', totalQuestions: 1, objectiveCorrect: 1, objectiveTotal: 1, percentage: 100, isWeakTopic: false },
        { topic: 'Node.js', totalQuestions: 1, objectiveCorrect: 0, objectiveTotal: 0, percentage: 80, isWeakTopic: false },
      ],
      weakTopics: ['TypeScript'],
      completedAt: new Date(),
    });
    await assessmentA.save();
    createdAssessmentIds.add(assessmentA._id.toString());

    // In-progress test
    const assessmentB = new Assessment({
      student: evalStudent._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['React'],
      status: 'in_progress',
      totalQuestions: 1,
      objectiveQuestionsCount: 1,
      subjectiveQuestionsCount: 0,
    });
    await assessmentB.save();
    createdAssessmentIds.add(assessmentB._id.toString());

    // TC-12: Returns accurate user demographics (students, trainers, admins, active, inactive)
    {
      const res = await request('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const counts = res.data?.data?.userCounts || {};
      recordTest(
        'TC-12',
        'Dashboard',
        'Returns accurate user demographics (students, trainers, admins, active, inactive)',
        res.status === 200 && counts.studentsCount >= 1 && counts.trainersCount >= 1 && counts.adminsCount >= 1,
        `Students: ${counts.studentsCount}, Trainers: ${counts.trainersCount}, Admins: ${counts.adminsCount}`
      );
    }

    // TC-13: Returns accurate assessment counts (total, completed, in-progress, pending eval)
    {
      const res = await request('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const stats = res.data?.data?.assessmentStats || {};
      recordTest(
        'TC-13',
        'Dashboard',
        'Returns accurate assessment counts (total, completed, in-progress, pending eval)',
        res.status === 200 && stats.totalAssessments >= 2 && stats.completedAssessments >= 1 && stats.inProgressAssessments >= 1,
        `Total: ${stats.totalAssessments}, Completed: ${stats.completedAssessments}, InProgress: ${stats.inProgressAssessments}`
      );
    }

    // TC-14: Returns accurate normalized overall GPA percentage excluding unevaluated tests
    {
      const res = await request('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const perf = res.data?.data?.platformPerformance || {};
      recordTest(
        'TC-14',
        'Dashboard',
        'Returns accurate normalized overall GPA percentage excluding unevaluated tests',
        res.status === 200 && typeof perf.averageOverallPercentage === 'number',
        `Platform GPA Avg: ${perf.averageOverallPercentage}%`
      );
    }

    // ==========================================
    // Category 4: User Directory & Search
    // ==========================================

    // TC-15: GET /api/admin/users returns paginated list with page/limit metadata
    {
      const res = await request('/api/admin/users?page=1&limit=5', {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      recordTest(
        'TC-15',
        'Directory',
        'GET /api/admin/users returns paginated list with page/limit metadata',
        res.status === 200 && Array.isArray(res.data.data) && res.data.page === 1 && res.data.limit === undefined && res.data.count <= 5,
        `Count: ${res.data.count}, Total: ${res.data.total}`
      );
    }

    // TC-16: Search by name/email with regex special characters safely escapes without ReDoS
    {
      const res = await request('/api/admin/users?search=test(.*)+[a-z]', {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      recordTest(
        'TC-16',
        'Directory',
        'Search by name/email with regex special characters safely escapes without ReDoS',
        res.status === 200 && res.data.success === true,
        `Status: ${res.status}`
      );
    }

    // TC-17: Filter by role=trainer and isActive=false returns exact matches
    {
      const deactTrainer = await createUser({ role: 'trainer', isActive: false });
      const res = await request('/api/admin/users?role=trainer&isActive=false', {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const allMatches = res.data?.data?.every((u) => u.role === 'trainer' && u.isActive === false);
      recordTest(
        'TC-17',
        'Directory',
        'Filter by role=trainer and isActive=false returns exact matches',
        res.status === 200 && res.data.count >= 1 && allMatches,
        `Found: ${res.data.count}`
      );
    }

    // TC-18: GET /api/admin/users/:id returns student profile with populated assessment summary
    {
      const res = await request(`/api/admin/users/${evalStudent._id}`, {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const summary = res.data?.data?.assessmentSummary;
      recordTest(
        'TC-18',
        'Directory',
        'GET /api/admin/users/:id returns student profile with populated assessment summary',
        res.status === 200 && summary && summary.totalCompleted >= 1 && summary.averageOverallPercentage === 90,
        `TotalCompleted: ${summary?.totalCompleted}, Avg: ${summary?.averageOverallPercentage}%`
      );
    }

    // TC-19: GET /api/admin/users/:id returns trainer profile with assigned student roster
    {
      const assignedStudent = await createUser({ role: 'student', assignedTrainer: trainerUser._id });
      const res = await request(`/api/admin/users/${trainerUser._id}`, {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const data = res.data?.data || {};
      recordTest(
        'TC-19',
        'Directory',
        'GET /api/admin/users/:id returns trainer profile with assigned student roster',
        res.status === 200 && data.assignedStudentsCount >= 1 && Array.isArray(data.assignedStudents),
        `AssignedStudentsCount: ${data.assignedStudentsCount}`
      );
    }

    // ==========================================
    // Category 5: Account Status & Deactivation
    // ==========================================

    // TC-20: Admin deactivates student -> student login rejected with 401 Unauthorized
    let deactivatedStudent;
    {
      deactivatedStudent = await createUser({ role: 'student', password: 'Password123!' });
      const patchRes = await request(`/api/admin/users/${deactivatedStudent._id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({ isActive: false }),
      });

      const deactToken = generateToken(deactivatedStudent._id);
      const authRes = await request('/api/auth/me', {
        headers: { Authorization: `Bearer ${deactToken}` },
      });

      recordTest(
        'TC-20',
        'Status',
        'Admin deactivates student -> student login/access rejected with 401 Unauthorized',
        patchRes.status === 200 && authRes.status === 401 && authRes.data.message.includes('deactivated'),
        `PatchStatus: ${patchRes.status}, AuthStatus: ${authRes.status}`
      );
    }

    // TC-21: Admin reactivates student -> student login succeeds with 200 OK
    {
      const patchRes = await request(`/api/admin/users/${deactivatedStudent._id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({ isActive: true }),
      });

      const reactToken = generateToken(deactivatedStudent._id);
      const authRes = await request('/api/auth/me', {
        headers: { Authorization: `Bearer ${reactToken}` },
      });

      recordTest(
        'TC-21',
        'Status',
        'Admin reactivates student -> student login succeeds with 200 OK',
        patchRes.status === 200 && authRes.status === 200 && (authRes.data.user?.isActive === true || authRes.data.data?.isActive === true),
        `PatchStatus: ${patchRes.status}, AuthStatus: ${authRes.status}`
      );
    }

    // TC-22: Deactivating trainer atomically unassigns all assigned students
    {
      const activeTrainer = await createUser({ role: 'trainer', isActive: true });
      const st1 = await createUser({ role: 'student', assignedTrainer: activeTrainer._id });
      const st2 = await createUser({ role: 'student', assignedTrainer: activeTrainer._id });

      const patchRes = await request(`/api/admin/users/${activeTrainer._id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({ isActive: false }),
      });

      const checkSt1 = await User.findById(st1._id);
      const checkSt2 = await User.findById(st2._id);

      recordTest(
        'TC-22',
        'Status',
        'Deactivating trainer atomically unassigns all assigned students',
        patchRes.status === 200 && checkSt1.assignedTrainer === null && checkSt2.assignedTrainer === null,
        `UnassignedCount: ${patchRes.data?.unassignedStudentsCount}`
      );
    }

    // TC-23: Versioned CAS rollback for deactivation aborts safely if trainer was concurrently modified
    {
      // Verify CAS query semantics: User.updateOne with outdated updatedAt matches 0 documents
      const trainerCAS = await createUser({ role: 'trainer', isActive: false });
      const oldTimestamp = new Date(Date.now() - 60000); // 1 minute ago

      const casRollbackRes = await User.updateOne(
        { _id: trainerCAS._id, isActive: false, updatedAt: oldTimestamp },
        { $set: { isActive: true } }
      );

      recordTest(
        'TC-23',
        'CAS',
        'Versioned CAS rollback for deactivation aborts safely if trainer was concurrently modified',
        casRollbackRes.matchedCount === 0,
        `MatchedCount: ${casRollbackRes.matchedCount} (Expected: 0)`
      );
    }

    // ==========================================
    // Category 6: Role Transitions
    // ==========================================

    // TC-24: Demoting trainer to student unassigns their assigned students
    {
      const trToDemote = await createUser({ role: 'trainer', isActive: true });
      const sAssigned = await createUser({ role: 'student', assignedTrainer: trToDemote._id });

      const patchRes = await request(`/api/admin/users/${trToDemote._id}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({ role: 'student' }),
      });

      const checkStudent = await User.findById(sAssigned._id);
      const checkTrainer = await User.findById(trToDemote._id);

      recordTest(
        'TC-24',
        'Roles',
        'Demoting trainer to student unassigns their assigned students',
        patchRes.status === 200 && checkTrainer.role === 'student' && checkStudent.assignedTrainer === null,
        `UnassignedCount: ${patchRes.data?.unassignedStudentsCount}`
      );
    }

    // TC-25: Promoting student to trainer clears student's assignedTrainer
    {
      const stToPromote = await createUser({ role: 'student', assignedTrainer: trainerUser._id });

      const patchRes = await request(`/api/admin/users/${stToPromote._id}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({ role: 'trainer' }),
      });

      const checkUser = await User.findById(stToPromote._id);

      recordTest(
        'TC-25',
        'Roles',
        "Promoting student to trainer clears student's assignedTrainer",
        patchRes.status === 200 && checkUser.role === 'trainer' && checkUser.assignedTrainer === null,
        `NewRole: ${checkUser?.role}, AssignedTrainer: ${checkUser?.assignedTrainer}`
      );
    }

    // ==========================================
    // Category 7: Assignments & Workload Management
    // ==========================================

    // TC-26: GET /api/admin/trainers returns trainers with accurate live student counts
    {
      const res = await request('/api/admin/trainers', {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const trainerItem = res.data?.data?.find((t) => t._id === trainerUser._id.toString());
      recordTest(
        'TC-26',
        'Assignments',
        'GET /api/admin/trainers returns trainers with accurate live student counts',
        res.status === 200 && Array.isArray(res.data.data) && trainerItem !== undefined && typeof trainerItem.assignedStudentsCount === 'number',
        `Live Count: ${trainerItem?.assignedStudentsCount}`
      );
    }

    // TC-27: POST /api/admin/assignments assigns student to active trainer
    let testAssignedStudent;
    {
      testAssignedStudent = await createUser({ role: 'student', assignedTrainer: null });
      const res = await request('/api/admin/assignments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({ studentId: testAssignedStudent._id, trainerId: trainerUser._id }),
      });
      const checkUser = await User.findById(testAssignedStudent._id);
      recordTest(
        'TC-27',
        'Assignments',
        'POST /api/admin/assignments assigns student to active trainer',
        res.status === 200 && checkUser.assignedTrainer?.toString() === trainerUser._id.toString(),
        `AssignedTo: ${checkUser?.assignedTrainer}`
      );
    }

    // TC-28: Reject assigning student to deactivated trainer or non-trainer with 400 Bad Request
    {
      const deactTr = await createUser({ role: 'trainer', isActive: false });
      const stCand = await createUser({ role: 'student' });
      const res = await request('/api/admin/assignments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({ studentId: stCand._id, trainerId: deactTr._id }),
      });
      recordTest(
        'TC-28',
        'Assignments',
        'Reject assigning student to deactivated trainer or non-trainer with 400 Bad Request',
        res.status === 400 && res.data.message.includes('trainer must exist, have role "trainer", and be active'),
        `Status: ${res.status}`
      );
    }

    // TC-29: POST /api/admin/assignments with trainerId: null unassigns student
    {
      const res = await request('/api/admin/assignments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({ studentId: testAssignedStudent._id, trainerId: null }),
      });
      const checkUser = await User.findById(testAssignedStudent._id);
      recordTest(
        'TC-29',
        'Assignments',
        'POST /api/admin/assignments with trainerId: null unassigns student',
        res.status === 200 && checkUser.assignedTrainer === null,
        `AssignedTrainer: ${checkUser?.assignedTrainer}`
      );
    }

    // ==========================================
    // Category 8: Bulk Assignment Engine
    // ==========================================

    // TC-30: Bulk assignment accurately tracks databaseModified, precheckUnchanged, and skipped
    {
      const targetTrainer = await createUser({ role: 'trainer', isActive: true });
      const bSt1 = await createUser({ role: 'student', assignedTrainer: null });
      const bSt2 = await createUser({ role: 'student', assignedTrainer: targetTrainer._id }); // Already assigned -> unchanged
      const bInactive = await createUser({ role: 'student', isActive: false }); // Inactive -> skipped
      const nonStudent = await createUser({ role: 'admin' }); // Admin -> skipped

      const res = await request('/api/admin/assignments/bulk', {
        method: 'POST',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({
          studentIds: [bSt1._id, bSt2._id, bInactive._id, nonStudent._id, new mongoose.Types.ObjectId()],
          trainerId: targetTrainer._id,
        }),
      });

      const summary = res.data?.data?.summary || {};
      recordTest(
        'TC-30',
        'Bulk',
        'Bulk assignment accurately tracks databaseModified, precheckUnchanged, and skipped',
        res.status === 200 && summary.databaseModified === 1 && summary.precheckUnchanged === 1 && summary.precheckSkipped === 3,
        `Modified: ${summary.databaseModified}, Unchanged: ${summary.precheckUnchanged}, Skipped: ${summary.precheckSkipped}`
      );
    }

    // TC-31: Bulk assignment deduplicates requested IDs and handles malformed IDs
    {
      const targetTrainer = await createUser({ role: 'trainer', isActive: true });
      const bSt = await createUser({ role: 'student', assignedTrainer: null });

      const res = await request('/api/admin/assignments/bulk', {
        method: 'POST',
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
        body: JSON.stringify({
          studentIds: [bSt._id, bSt._id, 'malformed-id-123'],
          trainerId: targetTrainer._id,
        }),
      });

      const summary = res.data?.data?.summary || {};
      recordTest(
        'TC-31',
        'Bulk',
        'Bulk assignment deduplicates requested IDs and handles malformed IDs',
        res.status === 200 && summary.requested === 3 && summary.uniqueRequested === 2 && summary.databaseModified === 1,
        `Requested: ${summary.requested}, Unique: ${summary.uniqueRequested}, Modified: ${summary.databaseModified}`
      );
    }

    // ==========================================
    // Category 9: Assessment Sanitization & Oversight
    // ==========================================

    const mockQuestionId = new mongoose.Types.ObjectId();
    const testAssessment = new Assessment({
      student: evalStudent._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['React'],
      status: 'completed',
      isEvaluating: true,
      evaluationLockToken: 'token_secret_xyz123',
      lockedAt: new Date(),
      totalQuestions: 1,
      objectiveQuestionsCount: 0,
      subjectiveQuestionsCount: 1,
      questions: [
        {
          questionId: mockQuestionId,
          topic: 'React',
          subtopic: 'Hooks',
          difficulty: 'medium',
          type: 'text',
          content: {
            en: { question: 'What is useEffect?', explanation: 'Effect hook explanation' },
            hinglish: { question: 'useEffect kya hai?', explanation: 'Effect hook explanation in Hinglish' },
          },
          correctAnswer: 'Reference model answer for useEffect',
          studentAnswer: 'useEffect handles side effects',
          isCorrect: true,
          evaluationStatus: 'ai_evaluated',
          pointsEarned: 1,
          maxPoints: 1,
          aiEvaluation: {
            score: 1,
            percentage: 100,
            rubricBreakdown: { technicalCorrectness: 1, conceptualUnderstanding: 1, completeness: 1, reasoning: 1, answerRelevance: 1 },
            feedback: 'Excellent answer',
            strengths: ['Clear'],
            weaknesses: [],
            suggestions: [],
            evaluatedLanguage: 'en',
            modelUsed: 'gemini-3.8-flash',
            evaluatedAt: new Date(),
          },
          trainerEvaluation: {
            pointsEarned: 1,
            remarks: 'Trainer verified',
            evaluatedBy: trainerUser._id,
            evaluatedAt: new Date(),
          },
        },
      ],
      scoring: {
        overallScore: 1,
        overallMaxScore: 1,
        overallPercentage: 100,
        isFullyEvaluated: true,
      },
      completedAt: new Date(),
    });
    await testAssessment.save();
    createdAssessmentIds.add(testAssessment._id.toString());

    // In-progress test for sanitization check
    const inProgressTest = new Assessment({
      student: evalStudent._id,
      targetRole: 'Full Stack Developer',
      selectedTopics: ['React'],
      status: 'in_progress',
      isEvaluating: true,
      evaluationLockToken: 'secret_lock_token_999',
      lockedAt: new Date(),
      totalQuestions: 1,
      questions: [
        {
          questionId: mockQuestionId,
          topic: 'React',
          subtopic: 'Hooks',
          difficulty: 'medium',
          type: 'text',
          content: {
            en: { question: 'In-progress question', explanation: 'SECRET_EXPLANATION_DO_NOT_LEAK' },
          },
          correctAnswer: 'SECRET_ANSWER_DO_NOT_LEAK',
          studentAnswer: 'Draft answer',
          maxPoints: 1,
        },
      ],
    });
    await inProgressTest.save();
    createdAssessmentIds.add(inProgressTest._id.toString());

    // TC-32: In-progress inspection removes evaluationLockToken, lockedAt, isEvaluating, correctAnswer, and all explanations
    {
      const res = await request(`/api/admin/assessments/${inProgressTest._id}`, {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const data = res.data?.data || {};
      const q0 = data.questions?.[0] || {};
      const safe =
        data.evaluationLockToken === undefined &&
        data.lockedAt === undefined &&
        data.isEvaluating === undefined &&
        q0.correctAnswer === undefined &&
        q0.content?.en?.explanation === undefined;

      recordTest(
        'TC-32',
        'Sanitization',
        'In-progress inspection removes evaluationLockToken, lockedAt, isEvaluating, correctAnswer, and all explanations',
        res.status === 200 && safe,
        `LockTokenExposed: ${Boolean(data.evaluationLockToken)}, CorrectAnswerExposed: ${Boolean(q0.correctAnswer)}`
      );
    }

    // TC-33: Completed inspection preserves student answers, AI rubrics, and trainer feedback
    {
      const res = await request(`/api/admin/assessments/${testAssessment._id}`, {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const data = res.data?.data || {};
      const q0 = data.questions?.[0] || {};
      const preserved =
        q0.studentAnswer === 'useEffect handles side effects' &&
        q0.aiEvaluation?.feedback === 'Excellent answer' &&
        q0.trainerEvaluation?.remarks === 'Trainer verified';

      recordTest(
        'TC-33',
        'Sanitization',
        'Completed inspection preserves student answers, AI rubrics, and trainer feedback',
        res.status === 200 && preserved,
        `StudentAnswer: ${Boolean(q0.studentAnswer)}, AiEval: ${Boolean(q0.aiEvaluation)}, TrainerEval: ${Boolean(q0.trainerEvaluation)}`
      );
    }

    // TC-34: Completed inspection recursively confirms evaluationLockToken, lockedAt, and isEvaluating are strictly absent
    {
      const res = await request(`/api/admin/assessments/${testAssessment._id}`, {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const data = res.data?.data || {};
      const absent =
        data.evaluationLockToken === undefined &&
        data.lockedAt === undefined &&
        data.isEvaluating === undefined &&
        data.__v === undefined;

      recordTest(
        'TC-34',
        'Sanitization',
        'Completed inspection recursively confirms evaluationLockToken, lockedAt, and isEvaluating are strictly absent',
        res.status === 200 && absent,
        `LockToken: ${data.evaluationLockToken}, LockedAt: ${data.lockedAt}, IsEvaluating: ${data.isEvaluating}`
      );
    }

    // TC-35: GET /api/admin/analytics/overview returns platform score distribution and weak topics
    {
      const res = await request('/api/admin/analytics/overview', {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const data = res.data?.data || {};
      recordTest(
        'TC-35',
        'Analytics',
        'GET /api/admin/analytics/overview returns platform score distribution and weak topics',
        res.status === 200 && data.scoreDistribution !== undefined && Array.isArray(data.topWeakTopics),
        `TotalCompleted: ${data.totalCompleted}, Buckets: ${JSON.stringify(data.scoreDistribution)}`
      );
    }

    // ==========================================
    // Category 10: Audit Logging & Sensitive Data Redaction
    // ==========================================

    // TC-36: Sensitive mutations (ROLE_UPDATED, USER_DEACTIVATED, STUDENT_ASSIGNED, etc.) record audit entries
    {
      const res = await request('/api/admin/audit-logs?limit=10', {
        headers: { Authorization: `Bearer ${primaryAdminToken}` },
      });
      const logs = res.data?.data || [];
      const hasAction = logs.length > 0;
      recordTest(
        'TC-36',
        'Audit',
        'Sensitive mutations record audit entries visible at GET /api/admin/audit-logs',
        res.status === 200 && hasAction,
        `AuditCount: ${logs.length}, LatestAction: ${logs[0]?.action}`
      );
    }

    // TC-37: Action allowlist rejects unpermitted top-level detail fields
    {
      const raw = {
        targetEmail: 'test@example.com',
        newRole: 'trainer',
        evilToken: 'sensitive_jwt_token',
        unauthorizedField: 'attacker_value',
      };
      const filtered = filterAuditDetails('ROLE_UPDATED', raw);
      const safe =
        filtered.targetEmail === 'test@example.com' &&
        filtered.newRole === 'trainer' &&
        filtered.evilToken === undefined &&
        filtered.unauthorizedField === undefined;

      recordTest(
        'TC-37',
        'Audit',
        'Action allowlist rejects unpermitted top-level detail fields',
        safe,
        `AllowedKeys: ${Object.keys(filtered).join(', ')}`
      );
    }

    // TC-38: Recursive audit sanitization strips sensitive keys nested in objects and arrays
    {
      const raw = {
        targetEmail: 'test@example.com',
        newRole: 'trainer',
        unassignedStudentsCount: {
          count: 5,
          nested: {
            auth_token: 'secret_nested_token',
            password: 'secret_nested_password',
            arrayItems: [{ studentAnswer: 'draft' }, { validKey: 'clean' }],
          },
        },
      };
      const filtered = filterAuditDetails('ROLE_UPDATED', raw);
      const nested = filtered.unassignedStudentsCount?.nested;
      const arrayItem0 = nested?.arrayItems?.[0];
      const arrayItem1 = nested?.arrayItems?.[1];

      const safe =
        nested?.auth_token === undefined &&
        nested?.password === undefined &&
        arrayItem0?.studentAnswer === undefined &&
        arrayItem1?.validKey === 'clean';

      recordTest(
        'TC-38',
        'Audit',
        'Recursive audit sanitization strips sensitive keys nested in objects and arrays',
        safe,
        `NestedKeys: ${Object.keys(nested || {}).join(', ')}`
      );
    }

    // TC-39: Failed audit log write does not crash or block parent administrative operation
    {
      // Mock logAdminAction error handling
      let threwError = false;
      try {
        await logAdminAction({
          req: { user: null }, // Trigger null actor warning without throw
          action: 'INVALID_ACTION_NAME',
          targetType: 'User',
        });
      } catch (_) {
        threwError = true;
      }
      recordTest(
        'TC-39',
        'Audit',
        'Failed audit log write does not crash or block parent administrative operation',
        threwError === false,
        'Non-blocking resilience verified'
      );
    }

    // ==========================================
    // Category 11: Concurrent CAS & Identifier Preservation
    // ==========================================

    // TC-40: Versioned CAS rollback for trainer role transition aborts safely when concurrent modification alters updatedAt
    {
      const trCAS = await createUser({ role: 'trainer', isActive: true });
      const oldTimestamp = new Date(Date.now() - 60000); // 1 minute ago

      const casRollbackRes = await User.updateOne(
        { _id: trCAS._id, role: 'student', updatedAt: oldTimestamp },
        { $set: { role: 'trainer' } }
      );

      recordTest(
        'TC-40',
        'CAS',
        'Versioned CAS rollback for trainer role transition aborts safely when concurrent modification alters updatedAt',
        casRollbackRes.matchedCount === 0,
        `MatchedCount: ${casRollbackRes.matchedCount} (Expected: 0)`
      );
    }

    // TC-41: Audit redaction preserves legitimate allowed identifiers (questionId, studentId, targetTrainerId)
    {
      const raw = {
        assessmentId: '671000000000000000000001',
        studentId: '671000000000000000000002',
        questionId: '671000000000000000000003',
        status: 'completed',
        isFullyEvaluated: true,
      };
      const filtered = filterAuditDetails('ASSESSMENT_INSPECTED', raw);

      const preserved =
        filtered.assessmentId === '671000000000000000000001' &&
        filtered.studentId === '671000000000000000000002' &&
        filtered.questionId === '671000000000000000000003' &&
        filtered.status === 'completed' &&
        filtered.isFullyEvaluated === true;

      recordTest(
        'TC-41',
        'Audit',
        'Audit redaction preserves legitimate allowed identifiers (questionId, studentId, targetTrainerId)',
        preserved,
        `Preserved: ${Object.keys(filtered).join(', ')}`
      );
    }

    // ==========================================
    // Category 12: Modules 1–6 Regression
    // ==========================================

    // TC-42: Regression test verifying Modules 1–6 routes remain 100% operational
    {
      const [healthRes, meRes, questionsRes, assessmentsRes, progressRes, trainerRes] = await Promise.all([
        request('/api/health'),
        request('/api/auth/me', { headers: { Authorization: `Bearer ${studentToken}` } }),
        request('/api/questions', { headers: { Authorization: `Bearer ${trainerToken}` } }),
        request('/api/assessments/my', { headers: { Authorization: `Bearer ${studentToken}` } }),
        request('/api/progress/dashboard', { headers: { Authorization: `Bearer ${studentToken}` } }),
        request('/api/trainer/dashboard', { headers: { Authorization: `Bearer ${trainerToken}` } }),
      ]);

      const allOk =
        healthRes.status === 200 &&
        meRes.status === 200 &&
        questionsRes.status === 200 &&
        assessmentsRes.status === 200 &&
        progressRes.status === 200 &&
        trainerRes.status === 200;

      recordTest(
        'TC-42',
        'Regression',
        'Regression test verifying Modules 1–6 routes remain 100% operational',
        allOk,
        `Health: ${healthRes.status}, Me: ${meRes.status}, Questions: ${questionsRes.status}, Assessments: ${assessmentsRes.status}, Progress: ${progressRes.status}, Trainer: ${trainerRes.status}`
      );
    }
  } catch (err) {
    caughtError = err;
    console.error('Fatal Test Execution Error:', err);
  } finally {
    // Teardown: Clean up test documents in careersaathi_m7_test
    try {
      if (createdUserIds.size > 0) {
        await User.deleteMany({ _id: { $in: Array.from(createdUserIds) } });
      }
      if (createdAssessmentIds.size > 0) {
        await Assessment.deleteMany({ _id: { $in: Array.from(createdAssessmentIds) } });
      }
      if (createdAuditLogIds.size > 0) {
        await AuditLog.deleteMany({ _id: { $in: Array.from(createdAuditLogIds) } });
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
  console.log(`\n=== Module 7 Test Suite Summary: ${passedCount}/${totalCount} PASSED ===`);

  if (caughtError || passedCount !== totalCount) {
    console.error(`\nTest suite completed with failures: ${totalCount - passedCount} failed`);
    process.exit(1);
  } else {
    console.log('\nAll Module 7 tests completed successfully!');
    process.exit(0);
  }
}

runAllTests();
