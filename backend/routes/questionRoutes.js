const express = require('express');
const router = express.Router();
const {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  toggleQuestionStatus,
} = require('../controllers/questionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All question bank management routes require trainer or admin role
router.use(protect);
router.use(authorize('trainer', 'admin'));

router.post('/', createQuestion);
router.get('/', getQuestions);
router.get('/:id', getQuestionById);
router.put('/:id', updateQuestion);
router.patch('/:id/status', toggleQuestionStatus);

module.exports = router;
