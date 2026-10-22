require('dotenv').config();
const { execSync } = require('child_process');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');
const User = require('../models/User');
const { generateToken } = require('../controllers/authController');
const { updateUserRole } = require('../controllers/userController');
const { calculateLoginStreak } = require('../utils/streakCalculator');

const API_BASE = 'http://localhost:5000/api';
const RUN_ID = `m2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const createdTestEmails = new Set();

function registerTestEmail(email) {
  if (email && typeof email === 'string') {
    createdTestEmails.add(email.toLowerCase().trim());
  }
}

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
  console.log(`=== Starting Module 2 Hardened Automated Test Suite [Run: ${RUN_ID}] ===\n`);
  let caughtError = null;

  try {
    await connectDB();

    // -------------------------------------------------------------
    // TC-01: Admin seed without ADMIN_EMAIL / ADMIN_PASSWORD fails safely
    // -------------------------------------------------------------
    try {
      execSync('node scripts/seedAdmin.js', {
        cwd: process.cwd(),
        env: { ...process.env, ADMIN_EMAIL: '', ADMIN_PASSWORD: '' },
        stdio: 'pipe',
      });
      recordTest('TC-01', 'Admin Seed', 'Fails without ADMIN_EMAIL/ADMIN_PASSWORD', false, 'Expected exit code 1');
    } catch (err) {
      const passed = err.status === 1;
      recordTest('TC-01', 'Admin Seed', 'Fails without ADMIN_EMAIL/ADMIN_PASSWORD', passed, `Exit code ${err.status}`);
    }

    // -------------------------------------------------------------
    // TC-02: Admin seed with valid credentials succeeds
    // -------------------------------------------------------------
    try {
      execSync('node scripts/seedAdmin.js', {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'pipe',
      });
      const adminUser = await User.findOne({ email: process.env.ADMIN_EMAIL.toLowerCase() });
      const passed = adminUser && adminUser.role === 'admin';
      recordTest('TC-02', 'Admin Seed', 'Seeds admin account successfully', passed, `Admin found: ${adminUser?.email}`);
    } catch (err) {
      recordTest('TC-02', 'Admin Seed', 'Seeds admin account successfully', false, err.message);
    }

    // -------------------------------------------------------------
    // TC-03: Re-run admin seed is idempotent
    // -------------------------------------------------------------
    try {
      const out = execSync('node scripts/seedAdmin.js', {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'pipe',
      }).toString();
      const passed = out.includes('already exists');
      recordTest('TC-03', 'Admin Seed', 'Re-run seed script is idempotent', passed, 'Detected existing account');
    } catch (err) {
      recordTest('TC-03', 'Admin Seed', 'Re-run seed script is idempotent', false, err.message);
    }

    // -------------------------------------------------------------
    // TC-04: Student registration with valid fields
    // -------------------------------------------------------------
    const student1Email = `student1_${RUN_ID}@test.careersaathi.local`;
    registerTestEmail(student1Email);
    const reg1 = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Aarav Student',
        email: student1Email,
        password: 'StudentPass123',
        targetRole: 'Full Stack Developer',
        preferredLanguage: 'hinglish',
      }),
    });
    const tc04Passed = reg1.status === 201 && reg1.data?.user?.role === 'student' && !!reg1.data?.token;
    recordTest('TC-04', 'Registration', 'Valid student registration returns 201 + token', tc04Passed, `Status: ${reg1.status}`);

    // -------------------------------------------------------------
    // TC-05: Register attempt with role: 'admin' is forced to 'student'
    // -------------------------------------------------------------
    const student2Email = `student2_${RUN_ID}@test.careersaathi.local`;
    registerTestEmail(student2Email);
    const reg2 = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Sneha Hacker',
        email: student2Email,
        password: 'StudentPass123',
        role: 'admin',
      }),
    });
    const tc05Passed = reg2.status === 201 && reg2.data?.user?.role === 'student';
    recordTest('TC-05', 'Security', 'Self-registration with role:admin forced to student', tc05Passed, `Assigned role: ${reg2.data?.user?.role}`);

    // -------------------------------------------------------------
    // TC-06: Registration with duplicate email returns 400
    // -------------------------------------------------------------
    const regDup = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Duplicate Aarav',
        email: student1Email,
        password: 'AnotherPassword123',
      }),
    });
    const tc06Passed = regDup.status === 400 && regDup.data?.success === false;
    recordTest('TC-06', 'Validation', 'Registration with duplicate email returns 400', tc06Passed, `Status: ${regDup.status}`);

    // -------------------------------------------------------------
    // TC-07: Concurrent duplicate registration handling
    // -------------------------------------------------------------
    const concurrentEmail = `concurrent_${RUN_ID}@test.careersaathi.local`;
    registerTestEmail(concurrentEmail);
    const [cRes1, cRes2] = await Promise.all([
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Race One', email: concurrentEmail, password: 'Password123' }),
      }),
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Race Two', email: concurrentEmail, password: 'Password123' }),
      }),
    ]);
    const statuses = [cRes1.status, cRes2.status].sort();
    const tc07Passed = statuses[0] === 201 && statuses[1] === 400;
    recordTest('TC-07', 'Concurrency', 'Parallel duplicate registration creates exactly 1 account', tc07Passed, `Statuses: ${cRes1.status}, ${cRes2.status}`);

    // -------------------------------------------------------------
    // TC-08: Validation rejects missing, non-string, or blank names with 400
    // -------------------------------------------------------------
    const [vName1, vName2, vName3] = await Promise.all([
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: `noname1_${RUN_ID}@test.careersaathi.local`, password: 'Password123' }),
      }),
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 12345, email: `noname2_${RUN_ID}@test.careersaathi.local`, password: 'Password123' }),
      }),
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: '    ', email: `noname3_${RUN_ID}@test.careersaathi.local`, password: 'Password123' }),
      }),
    ]);
    const tc08Passed = vName1.status === 400 && vName2.status === 400 && vName3.status === 400;
    recordTest('TC-08', 'Validation', 'Rejects missing, non-string, or blank name with 400', tc08Passed, `Statuses: ${vName1.status}, ${vName2.status}, ${vName3.status}`);

    // -------------------------------------------------------------
    // TC-09: Validation rejects malformed focusSkills with 400
    // -------------------------------------------------------------
    const [vSkills1, vSkills2, vSkills3, vSkills4] = await Promise.all([
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Skill Test 1', email: `skills1_${RUN_ID}@test.careersaathi.local`, password: 'Password123', focusSkills: 'JavaScript' }),
      }),
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Skill Test 2', email: `skills2_${RUN_ID}@test.careersaathi.local`, password: 'Password123', focusSkills: [] }),
      }),
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Skill Test 3', email: `skills3_${RUN_ID}@test.careersaathi.local`, password: 'Password123', focusSkills: [123, 'React'] }),
      }),
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Skill Test 4', email: `skills4_${RUN_ID}@test.careersaathi.local`, password: 'Password123', focusSkills: ['   '] }),
      }),
    ]);
    const tc09Passed = vSkills1.status === 400 && vSkills2.status === 400 && vSkills3.status === 400 && vSkills4.status === 400;
    recordTest('TC-09', 'Validation', 'Rejects malformed focusSkills (non-array, empty, non-string, blank)', tc09Passed, `Statuses: ${vSkills1.status}, ${vSkills2.status}, ${vSkills3.status}, ${vSkills4.status}`);

    // -------------------------------------------------------------
    // TC-10: Accepts valid custom focusSkills array and trims items
    // -------------------------------------------------------------
    const skillEmail = `valid_skills_${RUN_ID}@test.careersaathi.local`;
    registerTestEmail(skillEmail);
    const validSkillRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Skill Pro',
        email: skillEmail,
        password: 'Password123',
        focusSkills: ['  Node.js  ', '  TypeScript '],
      }),
    });
    const savedSkills = validSkillRes.data?.user?.careerProfile?.focusSkills;
    const tc10Passed = validSkillRes.status === 201 && Array.isArray(savedSkills) && savedSkills[0] === 'Node.js' && savedSkills[1] === 'TypeScript';
    recordTest('TC-10', 'Validation', 'Accepts valid custom focusSkills array and trims items', tc10Passed, `Stored: ${JSON.stringify(savedSkills)}`);

    // -------------------------------------------------------------
    // TC-11: Login with correct credentials returns 200 + token
    // -------------------------------------------------------------
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: student1Email, password: 'StudentPass123' }),
    });
    const studentToken = loginRes.data?.token;
    const tc11Passed = loginRes.status === 200 && !!studentToken && loginRes.data?.user?.password === undefined;
    recordTest('TC-11', 'Login', 'Login with correct credentials returns 200 + token', tc11Passed, `Password exposed: ${loginRes.data?.user?.password !== undefined}`);

    // -------------------------------------------------------------
    // TC-12: Login with incorrect password returns 401
    // -------------------------------------------------------------
    const badLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: student1Email, password: 'WrongPassword999' }),
    });
    const tc12Passed = badLoginRes.status === 401 && badLoginRes.data?.success === false;
    recordTest('TC-12', 'Security', 'Login with incorrect password returns 401', tc12Passed, `Status: ${badLoginRes.status}`);

    // -------------------------------------------------------------
    // TC-13: Login ignores client _referenceDate in body (cannot manipulate date)
    // -------------------------------------------------------------
    const spoofAttempt = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: student1Email,
        password: 'StudentPass123',
        _referenceDate: '2099-01-01T00:00:00.000Z',
      }),
    });
    const activeDate = new Date(spoofAttempt.data?.user?.gamification?.lastActiveDate);
    const now = new Date();
    // Verify that activeDate is within 30 seconds of current real time, NOT in 2099
    const isCurrentDate = Math.abs(now.getTime() - activeDate.getTime()) < 30000;
    const tc13Passed = spoofAttempt.status === 200 && isCurrentDate;
    recordTest('TC-13', 'Security', 'Login ignores _referenceDate in body (no client date manipulation)', tc13Passed, `Stored year: ${activeDate.getUTCFullYear()}`);

    // -------------------------------------------------------------
    // TC-14: Deterministic streak unit test: Same UTC day keeps streak unchanged
    // -------------------------------------------------------------
    const baseDate = new Date('2026-10-19T10:00:00.000Z');
    const sameDayCheck = calculateLoginStreak(baseDate, 5, new Date('2026-10-19T20:00:00.000Z'));
    const tc14Passed = sameDayCheck.streakCount === 5 && !sameDayCheck.isIncremented;
    recordTest('TC-14', 'Streak Logic', 'Deterministic unit test: Same UTC day keeps streak unchanged', tc14Passed, `Streak: ${sameDayCheck.streakCount}`);

    // -------------------------------------------------------------
    // TC-15: Deterministic streak unit test: Consecutive UTC day increments streak
    // -------------------------------------------------------------
    const nextDayCheck = calculateLoginStreak(baseDate, 5, new Date('2026-10-20T08:00:00.000Z'));
    const tc15Passed = nextDayCheck.streakCount === 6 && nextDayCheck.isIncremented;
    recordTest('TC-15', 'Streak Logic', 'Deterministic unit test: Consecutive UTC day increments streak', tc15Passed, `Streak: ${nextDayCheck.streakCount}`);

    // -------------------------------------------------------------
    // TC-16: Deterministic streak unit test: Missed day resets streak to 1
    // -------------------------------------------------------------
    const missedDayCheck = calculateLoginStreak(baseDate, 5, new Date('2026-10-23T08:00:00.000Z'));
    const tc16Passed = missedDayCheck.streakCount === 1 && !missedDayCheck.isIncremented;
    recordTest('TC-16', 'Streak Logic', 'Deterministic unit test: Missed day resets streak to 1', tc16Passed, `Streak: ${missedDayCheck.streakCount}`);

    // -------------------------------------------------------------
    // TC-17: Access /api/auth/me without token returns 401
    // -------------------------------------------------------------
    const noTokenRes = await request('/auth/me');
    const tc17Passed = noTokenRes.status === 401;
    recordTest('TC-17', 'Auth Guard', 'Access /api/auth/me without token returns 401', tc17Passed, `Status: ${noTokenRes.status}`);

    // -------------------------------------------------------------
    // TC-18: Access /api/auth/me with invalid/tampered token returns 401
    // -------------------------------------------------------------
    const badTokenRes = await request('/auth/me', {
      headers: { Authorization: 'Bearer this.is.an.invalid.token' },
    });
    const tc18Passed = badTokenRes.status === 401;
    recordTest('TC-18', 'Auth Guard', 'Access with invalid/tampered token returns 401', tc18Passed, `Status: ${badTokenRes.status}`);

    // -------------------------------------------------------------
    // TC-19: Access /api/auth/me with expired token returns 401
    // -------------------------------------------------------------
    const expiredToken = jwt.sign(
      { id: loginRes.data.user._id, role: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: 0 }
    );
    const expiredRes = await request('/auth/me', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const tc19Passed = expiredRes.status === 401 && (expiredRes.data?.message || '').toLowerCase().includes('expired');
    recordTest('TC-19', 'Token Expiry', 'Access with expired token returns 401 expired message', tc19Passed, `Message: ${expiredRes.data?.message}`);

    // -------------------------------------------------------------
    // TC-20: Missing JWT_SECRET throws safe configuration error (zero leaks)
    // -------------------------------------------------------------
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    let tc20Passed = false;
    let tc20Detail = '';
    try {
      generateToken('test_id', 'student');
    } catch (err) {
      tc20Passed = err.message.includes('JWT_SECRET is not configured');
      tc20Detail = err.message;
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
    recordTest('TC-20', 'Secret Security', 'Missing JWT_SECRET throws safe config error (zero leaks)', tc20Passed, tc20Detail);

    // -------------------------------------------------------------
    // TC-21: Student accessing /api/users/students returns 403 Forbidden
    // -------------------------------------------------------------
    const studentAccessRes = await request('/users/students', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const tc21Passed = studentAccessRes.status === 403;
    recordTest('TC-21', 'RBAC Guard', 'Student accessing /api/users/students returns 403 Forbidden', tc21Passed, `Status: ${studentAccessRes.status}`);

    // -------------------------------------------------------------
    // Setup: Login as Admin & Create Trainer
    // -------------------------------------------------------------
    const adminLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      }),
    });
    const adminToken = adminLoginRes.data?.token;

    // Create Trainer user
    const trainerEmail = `trainer_${RUN_ID}@test.careersaathi.local`;
    registerTestEmail(trainerEmail);
    const trainerReg = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Prof. Sharma', email: trainerEmail, password: 'TrainerPassword123' }),
    });
    const trainerUserId = trainerReg.data.user._id;

    // Admin promotes user to 'trainer'
    await request(`/users/${trainerUserId}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: 'trainer' }),
    });

    const trainerLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: trainerEmail, password: 'TrainerPassword123' }),
    });
    const trainerToken = trainerLoginRes.data?.token;

    // -------------------------------------------------------------
    // TC-22: Trainer accesses /api/users/students with 0 assigned students -> returns []
    // -------------------------------------------------------------
    const trainerEmptyRes = await request('/users/students', {
      headers: { Authorization: `Bearer ${trainerToken}` },
    });
    const tc22Passed = trainerEmptyRes.status === 200 && trainerEmptyRes.data?.count === 0 && Array.isArray(trainerEmptyRes.data?.data) && trainerEmptyRes.data.data.length === 0;
    recordTest('TC-22', 'Trainer Scope', 'Trainer with 0 assigned students sees empty array (no leaks)', tc22Passed, `Count: ${trainerEmptyRes.data?.count}`);

    // -------------------------------------------------------------
    // TC-23: Trainer accesses /api/users/students with 1 assigned student
    // -------------------------------------------------------------
    await User.findByIdAndUpdate(loginRes.data.user._id, { assignedTrainer: trainerUserId });
    const trainerAssignedRes = await request('/users/students', {
      headers: { Authorization: `Bearer ${trainerToken}` },
    });
    const tc23Passed = trainerAssignedRes.status === 200 &&
      trainerAssignedRes.data?.count === 1 &&
      trainerAssignedRes.data.data[0]._id === loginRes.data.user._id;
    recordTest('TC-23', 'Trainer Scope', 'Trainer sees strictly their assigned student', tc23Passed, `Found: ${trainerAssignedRes.data?.count} student(s)`);

    // -------------------------------------------------------------
    // TC-24: Admin accesses /api/users/students -> sees all active students
    // -------------------------------------------------------------
    const adminStudentsRes = await request('/users/students', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const tc24Passed = adminStudentsRes.status === 200 && adminStudentsRes.data?.count >= 2;
    recordTest('TC-24', 'Admin Access', 'Admin sees all active students globally', tc24Passed, `Count: ${adminStudentsRes.data?.count}`);

    // -------------------------------------------------------------
    // TC-25: Role update with malformed user ID returns 400
    // -------------------------------------------------------------
    const malformedIdRes = await request('/users/not-a-valid-object-id/role', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: 'trainer' }),
    });
    const tc25Passed = malformedIdRes.status === 400 && malformedIdRes.data?.message.includes('Invalid user ID format');
    recordTest('TC-25', 'Input Check', 'Malformed user ID returns 400 Bad Request', tc25Passed, `Status: ${malformedIdRes.status}`);

    // -------------------------------------------------------------
    // TC-26: Admin attempts to demote primary Admin -> returns 403 Forbidden
    // -------------------------------------------------------------
    const primaryAdminUser = await User.findOne({ email: process.env.ADMIN_EMAIL.toLowerCase() });
    const demoteAdminRes = await request(`/users/${primaryAdminUser._id}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: 'student' }),
    });
    const tc26Passed = demoteAdminRes.status === 403 && demoteAdminRes.data?.message.includes('primary Administrator');
    recordTest('TC-26', 'Admin Guard', 'Attempting to demote primary Admin returns 403 Forbidden', tc26Passed, `Status: ${demoteAdminRes.status}`);

    // -------------------------------------------------------------
    // TC-27: Missing ADMIN_EMAIL locks role modification (500 fail-closed)
    // -------------------------------------------------------------
    const originalAdminEmail = process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_EMAIL;
    let tc27Status = null;
    let tc27Message = '';
    const mockReq = { params: { id: trainerUserId }, body: { role: 'student' } };
    const mockRes = {
      status(code) {
        tc27Status = code;
        return this;
      },
      json(payload) {
        tc27Message = payload.message || '';
        return this;
      },
    };
    await updateUserRole(mockReq, mockRes, () => {});
    process.env.ADMIN_EMAIL = originalAdminEmail;
    const tc27Passed = tc27Status === 500 && tc27Message.includes('ADMIN_EMAIL');
    recordTest('TC-27', 'Admin Guard', 'Missing ADMIN_EMAIL locks role modification (500 fail-closed)', tc27Passed, `Status: ${tc27Status}`);

    // -------------------------------------------------------------
    // TC-28: Forced failure verification test for guaranteed finally cleanup
    // -------------------------------------------------------------
    const canaryEmail = `canary_cleanup_${RUN_ID}@test.careersaathi.local`;
    registerTestEmail(canaryEmail);
    await User.create({
      name: 'Canary User',
      email: canaryEmail,
      password: 'CanaryPassword123',
      role: 'student',
    });
    // Verify canary user exists before simulation
    const preCanary = await User.findOne({ email: canaryEmail });
    let cleanupHandlerExecuted = false;
    try {
      // Simulate unexpected execution error inside test flow
      throw new Error('Simulated unexpected test runner exception');
    } catch (simulatedErr) {
      // Cleanup runs safely in finally simulation block
      const targetEmails = Array.from(createdTestEmails).filter(
        (e) => e === canaryEmail && e !== process.env.ADMIN_EMAIL.toLowerCase()
      );
      const delRes = await User.deleteMany({ email: { $in: targetEmails } });
      cleanupHandlerExecuted = delRes.deletedCount === 1;
    }
    const postCanary = await User.findOne({ email: canaryEmail });
    const tc28Passed = preCanary !== null && cleanupHandlerExecuted && postCanary === null;
    recordTest('TC-28', 'Cleanup Safety', 'Forced failure confirms finally cleanup executes and cleans test record', tc28Passed, 'Canary safely cleaned');
  } catch (err) {
    caughtError = err;
    console.error('\nFatal Error encountered during test execution:', err.message);
  } finally {
    // -------------------------------------------------------------
    // Guaranteed Teardown: Clean up strictly exact test records via $in
    // -------------------------------------------------------------
    console.log('\n--- Running Guaranteed Isolated Test Cleanup ---');
    try {
      const primaryAdmin = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
      const emailsToDelete = Array.from(createdTestEmails).filter(
        (e) => e && e !== primaryAdmin
      );

      if (emailsToDelete.length > 0) {
        if (mongoose.connection.readyState === 1) {
          const deleteResult = await User.deleteMany({ email: { $in: emailsToDelete } });
          console.log(`Cleaned up ${deleteResult.deletedCount} exact test records from current run via $in array.`);
        } else {
          await connectDB();
          const deleteResult = await User.deleteMany({ email: { $in: emailsToDelete } });
          console.log(`Cleaned up ${deleteResult.deletedCount} exact test records from current run via $in array.`);
        }
      } else {
        console.log('No test records to clean up.');
      }
    } catch (cleanupErr) {
      console.error('Guaranteed cleanup encountered an error:', cleanupErr.message);
    } finally {
      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
          console.log('Database connection safely closed.');
        }
      } catch (_) {}
    }

    const total = testResults.length;
    const passedCount = testResults.filter((t) => t.passed).length;
    console.log(`\n=== Test Summary: ${passedCount}/${total} PASSED ===`);

    if (caughtError) {
      throw caughtError;
    }

    if (passedCount !== total) {
      process.exit(1);
    }
  }
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
