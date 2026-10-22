const mongoose = require('mongoose');
const User = require('../models/User');
const { getOrGenerateRecommendations } = require('../services/recommendationService');

/**
 * Sanitizes recommendation document for client response.
 * Guarantees zero leakage of internal Mongoose versioning, passwords, or tokens.
 */
function formatRecommendationResponse(recommendationDoc, isCached = false) {
  if (!recommendationDoc) return null;
  const doc = typeof recommendationDoc.toObject === 'function'
    ? recommendationDoc.toObject()
    : { ...recommendationDoc };

  return {
    _id: doc._id,
    student: doc.student,
    source: doc.source,
    modelUsed: doc.modelUsed,
    fallbackReason: doc.fallbackReason,
    isCached: Boolean(isCached),
    generatedAt: doc.generatedAt,
    expiresAt: doc.expiresAt,
    profileSnapshot: doc.profileSnapshot || {},
    performanceSnapshot: doc.performanceSnapshot || {},
    recommendedTopics: doc.recommendedTopics || [],
    nextActions: doc.nextActions || [],
    practiceAssessments: doc.practiceAssessments || [],
  };
}

// @desc    Get personalized recommendations for authenticated student
// @route   GET /api/recommendations/my
// @access  Protected (Student only)
const getMyRecommendations = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const forceRefresh = req.query.refresh === 'true';

    const result = await getOrGenerateRecommendations({
      studentId,
      forceRefresh,
    });

    res.status(200).json({
      success: true,
      data: formatRecommendationResponse(result.recommendation, result.isCached),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recommendations for an assigned student (Trainer) or any student (Admin)
// @route   GET /api/recommendations/students/:studentId
// @access  Protected (Trainer [assigned student only], Admin)
const getStudentRecommendations = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid student ID format',
      });
    }

    const student = await User.findById(studentId).select(
      '_id name email role assignedTrainer isActive'
    );

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Student not found',
      });
    }

    // Role-based boundary enforcement: Trainers restricted to assigned students
    if (req.user.role === 'trainer') {
      if (
        !student.assignedTrainer ||
        student.assignedTrainer.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          status: 403,
          message: 'Access forbidden: Trainer can only view recommendations for assigned students',
        });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: Role is not authorized to view student recommendations',
      });
    }

    const forceRefresh = req.query.refresh === 'true';

    const result = await getOrGenerateRecommendations({
      studentId: student._id,
      forceRefresh,
    });

    res.status(200).json({
      success: true,
      data: formatRecommendationResponse(result.recommendation, result.isCached),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyRecommendations,
  getStudentRecommendations,
  formatRecommendationResponse,
};
