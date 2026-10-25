const express = require('express');
const router = express.Router();
const {
  getTrainerDashboard,
  getTrainerStudents,
  getTrainerStudentById,
  getStudentAssessments,
  getStudentProgressAnalytics,
  getTrainerAssessments,
  getTrainerAssessmentById,
  evaluateQuestion,
  submitTrainerFeedback,
} = require('../controllers/trainerController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All trainer routes require authentication and trainer or admin role
router.use(protect);
router.use(authorize('trainer', 'admin'));

// Trainer dashboard
router.get('/dashboard', getTrainerDashboard);

// Assigned students directory & profile
router.get('/students', getTrainerStudents);
router.get('/students/:studentId', getTrainerStudentById);
router.get('/students/:studentId/assessments', getStudentAssessments);
router.get('/students/:studentId/progress', getStudentProgressAnalytics);

// Cohort Assessment Management & review
router.get('/assessments', getTrainerAssessments);
router.get('/assessments/:assessmentId', getTrainerAssessmentById);
router.post('/assessments/:assessmentId/evaluate-question', evaluateQuestion);
router.post('/assessments/:assessmentId/feedback', submitTrainerFeedback);

module.exports = router;
