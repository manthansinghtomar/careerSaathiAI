const express = require('express');
const router = express.Router();
const { recordHeartbeat, getStreak } = require('../controllers/streakController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All streak routes are protected and strictly accessible by students only
router.use(protect);
router.use(authorize('student'));

router.post('/heartbeat', recordHeartbeat);
router.get('/summary', getStreak);

module.exports = router;
