const express = require('express');
const router = express.Router();
const {
  generateAssessment,
  getAssessmentById,
  submitAssessment,
  getAssessmentResults,
  getMyAssessments,
  evaluateAssessment,
} = require('../controllers/assessmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Student assessment workflows
router.post('/generate', authorize('student'), generateAssessment);
router.get('/my', authorize('student'), getMyAssessments);
router.post('/:id/submit', authorize('student'), submitAssessment);

// Assessment evaluation (AI Rubric Evaluation)
router.post('/:id/evaluate', authorize('student', 'trainer', 'admin'), evaluateAssessment);

// Assessment inspection & results (authorization scoped inside controllers)
router.get('/:id', authorize('student', 'trainer', 'admin'), getAssessmentById);
router.get('/:id/results', authorize('student', 'trainer', 'admin'), getAssessmentResults);

module.exports = router;
