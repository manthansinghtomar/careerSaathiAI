const express = require('express');
const router = express.Router();
const {
  getAdminDashboard,
  getUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
  getTrainers,
  getUnassignedStudents,
  assignStudent,
  bulkAssignStudents,
  getPlatformAnalyticsOverview,
  getAdminAssessments,
  getAdminAssessmentById,
  getAuditLogs,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Universal Administrative Protection: All routes require authenticated user with role 'admin'
router.use(protect, authorize('admin'));

// 1. Dashboard & Platform KPIs
router.get('/dashboard', getAdminDashboard);

// 2. User Directory & Governance
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/role', updateUserRole);

// 3. Trainer & Student Assignment Management
router.get('/trainers', getTrainers);
router.get('/students/unassigned', getUnassignedStudents);
router.post('/assignments', assignStudent);
router.post('/assignments/bulk', bulkAssignStudents);

// 4. Platform Assessment Oversight & Analytics
router.get('/analytics/overview', getPlatformAnalyticsOverview);
router.get('/assessments', getAdminAssessments);
router.get('/assessments/:id', getAdminAssessmentById);

// 5. Audit Logging
router.get('/audit-logs', getAuditLogs);

module.exports = router;
