const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllRead,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// All notification routes are protected (all roles: student, trainer, admin)
router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markNotificationRead);

module.exports = router;
