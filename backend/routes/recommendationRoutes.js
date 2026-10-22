const express = require('express');
const router = express.Router();
const {
  getMyRecommendations,
  getStudentRecommendations,
} = require('../controllers/recommendationController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Student access to own recommendations
router.get('/my', protect, authorize('student'), getMyRecommendations);

// Trainer & Admin access to student recommendations (scoping verified inside controller)
router.get('/students/:studentId', protect, authorize('trainer', 'admin'), getStudentRecommendations);

module.exports = router;
