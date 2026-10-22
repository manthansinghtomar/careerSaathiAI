const express = require('express');
const router = express.Router();
const {
  getDashboardSummary,
  getAssessmentHistory,
  getProgressTrends,
  getTopicAnalytics,
} = require('../controllers/progressController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All progress analytics routes are protected and strictly accessible by students only
router.use(protect);
router.use(authorize('student'));

router.get('/dashboard', getDashboardSummary);
router.get('/history', getAssessmentHistory);
router.get('/trends', getProgressTrends);
router.get('/topics', getTopicAnalytics);

module.exports = router;
