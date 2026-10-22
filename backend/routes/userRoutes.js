const express = require('express');
const router = express.Router();
const {
  getStudents,
  updateUserRole,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/students', protect, authorize('trainer', 'admin'), getStudents);
router.patch('/:id/role', protect, authorize('admin'), updateUserRole);

module.exports = router;
