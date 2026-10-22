const mongoose = require('mongoose');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const AuditLog = require('../models/AuditLog');
const {
  calculateNormalizedAverages,
  formatSafeHistoryItem,
} = require('../utils/analyticsAggregator');
const { logAdminAction } = require('../utils/auditLogger');

/**
 * Escapes regex special characters to prevent Regular Expression Denial of Service (ReDoS).
 * @param {string} text
 * @returns {string} Escaped string
 */
function escapeRegex(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Explicit schema whitelisting for completed assessment inspection.
 * Preserves student answers, AI rubrics, and trainer feedback for administrative audit,
 * while strictly stripping internal concurrency locking tokens and metadata.
 *
 * @param {Object} assessment
 * @returns {Object} Safe audit payload
 */
function formatCompletedAssessment(assessment) {
  const a = typeof assessment.toObject === 'function' ? assessment.toObject() : assessment;

  const result = {
    _id: a._id,
    student: a.student,
    targetRole: a.targetRole || 'Full Stack Developer',
    selectedTopics: a.selectedTopics || [],
    status: 'completed',
    totalQuestions: a.totalQuestions || 0,
    objectiveQuestionsCount: a.objectiveQuestionsCount || 0,
    subjectiveQuestionsCount: a.subjectiveQuestionsCount || 0,
    scoring: a.scoring
      ? {
          objectiveScore: a.scoring.objectiveScore ?? 0,
          objectiveMaxScore: a.scoring.objectiveMaxScore ?? 0,
          objectivePercentage: a.scoring.objectivePercentage ?? 0,
          subjectiveScore: a.scoring.subjectiveScore ?? 0,
          subjectiveMaxScore: a.scoring.subjectiveMaxScore ?? 0,
          subjectivePercentage: a.scoring.subjectivePercentage ?? 0,
          overallScore: a.scoring.overallScore ?? 0,
          overallMaxScore: a.scoring.overallMaxScore ?? 0,
          overallPercentage: a.scoring.overallPercentage ?? 0,
          isFullyEvaluated: Boolean(a.scoring.isFullyEvaluated),
        }
      : null,
    topicWiseResults: a.topicWiseResults || [],
    weakTopics: a.weakTopics || [],
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };

  if (a.trainerFeedback && a.trainerFeedback.remarks) {
    result.trainerFeedback = {
      remarks: a.trainerFeedback.remarks,
      trainer: a.trainerFeedback.trainer,
      givenAt: a.trainerFeedback.givenAt,
    };
  }

  if (Array.isArray(a.questions)) {
    result.questions = a.questions.map((q) => {
      const cleanQ = {
        questionId: q.questionId,
        topic: q.topic,
        subtopic: q.subtopic || 'General',
        difficulty: q.difficulty,
        type: q.type,
        content: {
          en: {
            question: q.content?.en?.question || '',
            explanation: q.content?.en?.explanation || '',
          },
          hinglish: {
            question: q.content?.hinglish?.question || '',
            explanation: q.content?.hinglish?.explanation || '',
          },
        },
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        studentAnswer: q.studentAnswer,
        isCorrect: q.isCorrect,
        evaluationStatus: q.evaluationStatus,
        pointsEarned: q.pointsEarned ?? 0,
        maxPoints: q.maxPoints ?? 1,
      };

      if (q.aiEvaluation) {
        cleanQ.aiEvaluation = {
          score: q.aiEvaluation.score,
          percentage: q.aiEvaluation.percentage,
          rubricBreakdown: q.aiEvaluation.rubricBreakdown || {},
          feedback: q.aiEvaluation.feedback,
          strengths: q.aiEvaluation.strengths || [],
          weaknesses: q.aiEvaluation.weaknesses || [],
          suggestions: q.aiEvaluation.suggestions || [],
          evaluatedLanguage: q.aiEvaluation.evaluatedLanguage,
          modelUsed: q.aiEvaluation.modelUsed,
          evaluatedAt: q.aiEvaluation.evaluatedAt,
        };
      }

      if (q.trainerEvaluation && q.trainerEvaluation.pointsEarned !== null && q.trainerEvaluation.pointsEarned !== undefined) {
        cleanQ.trainerEvaluation = {
          pointsEarned: q.trainerEvaluation.pointsEarned,
          remarks: q.trainerEvaluation.remarks,
          evaluatedBy: q.trainerEvaluation.evaluatedBy,
          evaluatedAt: q.trainerEvaluation.evaluatedAt,
        };
      }

      return cleanQ;
    });
  }

  return result;
}

/**
 * Sanitizes in-progress assessment documents.
 * Guarantees zero leakage of reference answers, solutions, explanations, or locking tokens.
 *
 * @param {Object} assessment
 * @returns {Object} Safe client payload
 */
function formatInProgressAssessment(assessment) {
  const a = typeof assessment.toObject === 'function' ? assessment.toObject() : assessment;

  const result = {
    _id: a._id,
    student: a.student,
    targetRole: a.targetRole || 'Full Stack Developer',
    selectedTopics: a.selectedTopics || [],
    status: 'in_progress',
    totalQuestions: a.totalQuestions || 0,
    objectiveQuestionsCount: a.objectiveQuestionsCount || 0,
    subjectiveQuestionsCount: a.subjectiveQuestionsCount || 0,
    startedAt: a.startedAt || a.createdAt,
    createdAt: a.createdAt,
  };

  if (Array.isArray(a.questions)) {
    result.questions = a.questions.map((q) => ({
      questionId: q.questionId,
      topic: q.topic,
      subtopic: q.subtopic || 'General',
      difficulty: q.difficulty,
      type: q.type,
      content: {
        en: { question: q.content?.en?.question || '' },
        hinglish: { question: q.content?.hinglish?.question || '' },
      },
      options: q.type === 'mcq' ? (q.options || []) : [],
      studentAnswer: q.studentAnswer || null,
      maxPoints: q.maxPoints || 1,
    }));
  }

  return result;
}

/**
 * Unified assessment inspection formatter.
 * @param {Object} assessment
 * @returns {Object}
 */
function formatAdminAssessmentInspection(assessment) {
  if (!assessment) return null;
  return assessment.status === 'completed'
    ? formatCompletedAssessment(assessment)
    : formatInProgressAssessment(assessment);
}

// ==========================================
// 1. Admin Dashboard & Platform Health KPIs
// ==========================================
// @desc    Get platform-wide dashboard KPIs
// @route   GET /api/admin/dashboard
// @access  Protected (Admin only)
const getAdminDashboard = async (req, res, next) => {
  try {
    const [
      totalUsers,
      studentsCount,
      trainersCount,
      adminsCount,
      activeUsersCount,
      deactivatedUsersCount,
      assignedStudentsCount,
      unassignedStudentsCount,
      totalAssessments,
      completedAssessments,
      inProgressAssessments,
      abandonedAssessments,
      completedAssessmentsDocs,
      latestUsers,
      latestCompletedTests,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'trainer' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ role: 'student', assignedTrainer: { $ne: null } }),
      User.countDocuments({ role: 'student', assignedTrainer: null }),
      Assessment.countDocuments(),
      Assessment.countDocuments({ status: 'completed' }),
      Assessment.countDocuments({ status: 'in_progress' }),
      Assessment.countDocuments({ status: 'abandoned' }),
      Assessment.find({ status: 'completed' }).select('scoring completedAt createdAt weakTopics'),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id name email role isActive createdAt'),
      Assessment.find({ status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(5)
        .populate('student', '_id name email')
        .select('_id student targetRole scoring completedAt'),
    ]);

    // Calculate normalized platform averages (excluding pending evaluations)
    const normalizedStats = calculateNormalizedAverages(completedAssessmentsDocs);

    // Aggregate platform-wide top weak topics
    const weakTopicFrequency = {};
    completedAssessmentsDocs.forEach((a) => {
      if (Array.isArray(a.weakTopics)) {
        a.weakTopics.forEach((topic) => {
          if (topic) {
            weakTopicFrequency[topic] = (weakTopicFrequency[topic] || 0) + 1;
          }
        });
      }
    });

    const topWeakTopics = Object.entries(weakTopicFrequency)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const safeRecentAssessments = latestCompletedTests.map((a) => ({
      _id: a._id,
      student: a.student ? { _id: a.student._id, name: a.student.name, email: a.student.email } : null,
      targetRole: a.targetRole,
      overallScore: a.scoring?.overallScore ?? 0,
      overallPercentage: a.scoring?.overallPercentage ?? 0,
      isFullyEvaluated: Boolean(a.scoring?.isFullyEvaluated),
      completedAt: a.completedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        userCounts: {
          totalUsers,
          studentsCount,
          trainersCount,
          adminsCount,
          activeUsersCount,
          deactivatedUsersCount,
        },
        assignmentStats: {
          assignedStudentsCount,
          unassignedStudentsCount,
        },
        assessmentStats: {
          totalAssessments,
          completedAssessments,
          inProgressAssessments,
          abandonedAssessments,
          fullyEvaluatedCount: normalizedStats.fullyEvaluatedCount,
          pendingEvaluationCount: normalizedStats.pendingEvaluationCount,
        },
        platformPerformance: {
          averageOverallPercentage: normalizedStats.averageOverallPercentage,
          objectiveAveragePercentage: normalizedStats.objectiveAveragePercentage,
          subjectiveAveragePercentage: normalizedStats.subjectiveAveragePercentage,
          topWeakTopics,
        },
        recentActivity: {
          latestUsers,
          latestCompletedAssessments: safeRecentAssessments,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. User Directory & Governance
// ==========================================
// @desc    List all users with pagination, filters, and ReDoS-safe search
// @route   GET /api/admin/users
// @access  Protected (Admin only)
const getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};

    // Safe regex search across name and email
    if (req.query.search && typeof req.query.search === 'string') {
      const escaped = escapeRegex(req.query.search.trim());
      if (escaped) {
        filter.$or = [
          { name: { $regex: escaped, $options: 'i' } },
          { email: { $regex: escaped, $options: 'i' } },
        ];
      }
    }

    if (req.query.role && ['student', 'trainer', 'admin'].includes(req.query.role)) {
      filter.role = req.query.role;
    }

    if (req.query.isActive !== undefined) {
      if (req.query.isActive === 'true') filter.isActive = true;
      if (req.query.isActive === 'false') filter.isActive = false;
    }

    if (req.query.assigned !== undefined) {
      filter.role = 'student';
      if (req.query.assigned === 'true') filter.assignedTrainer = { $ne: null };
      if (req.query.assigned === 'false') filter.assignedTrainer = null;
    }

    if (req.query.trainerId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.trainerId)) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: 'Invalid trainerId format',
        });
      }
      filter.role = 'student';
      filter.assignedTrainer = req.query.trainerId;
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .populate('assignedTrainer', '_id name email')
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed user profile by ID
// @route   GET /api/admin/users/:id
// @access  Protected (Admin only)
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid user ID format',
      });
    }

    const user = await User.findById(id)
      .populate('assignedTrainer', '_id name email')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'User not found',
      });
    }

    const responseData = user.toObject();

    if (user.role === 'student') {
      const completedAssessments = await Assessment.find({
        student: user._id,
        status: 'completed',
      }).select('scoring completedAt weakTopics');

      const stats = calculateNormalizedAverages(completedAssessments);
      responseData.assessmentSummary = {
        totalCompleted: completedAssessments.length,
        averageOverallPercentage: stats.averageOverallPercentage,
        latestOverallPercentage: stats.latestOverallPercentage,
        weakTopics: Array.from(
          new Set(completedAssessments.flatMap((a) => a.weakTopics || []))
        ),
      };
    } else if (user.role === 'trainer') {
      const assignedStudents = await User.find({
        assignedTrainer: user._id,
      }).select('_id name email isActive createdAt');

      responseData.assignedStudentsCount = assignedStudents.length;
      responseData.assignedStudents = assignedStudents;
    }

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Activate or deactivate a user account with CAS rollback on trainer deactivation
// @route   PATCH /api/admin/users/:id/status
// @access  Protected (Admin only)
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Missing or invalid isActive boolean field',
      });
    }

    const primaryAdminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    if (!primaryAdminEmail) {
      return res.status(500).json({
        success: false,
        status: 500,
        message: 'Configuration Error: ADMIN_EMAIL is not configured. Status modifications are temporarily locked.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid user ID format',
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'User not found',
      });
    }

    // Guard 1: Prevent self-deactivation
    if (req.user._id.toString() === targetUser._id.toString() && !isActive) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: Administrators cannot deactivate their own account.',
      });
    }

    // Guard 2: Prevent primary admin deactivation
    if (targetUser.email.toLowerCase() === primaryAdminEmail && !isActive) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: The primary platform administrator cannot be deactivated.',
      });
    }

    // Guard 3: Secondary admins cannot deactivate other admins
    const isActorPrimaryAdmin = req.user.email.toLowerCase() === primaryAdminEmail;
    if (targetUser.role === 'admin' && !isActorPrimaryAdmin && !isActive) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: Only the primary administrator can deactivate administrator accounts.',
      });
    }

    // No-op if status is already target state
    if (targetUser.isActive === isActive) {
      return res.status(200).json({
        success: true,
        message: `User is already ${isActive ? 'active' : 'deactivated'}`,
        data: targetUser,
      });
    }

    let unassignedStudentsCount = 0;

    // Special CAS workflow for Trainer Deactivation
    if (targetUser.role === 'trainer' && !isActive) {
      const baselineUpdatedAt = targetUser.updatedAt;

      // Step 1: Atomic deactivation matching baseline timestamp
      const deactivationRes = await User.findOneAndUpdate(
        { _id: targetUser._id, role: 'trainer', isActive: true, updatedAt: baselineUpdatedAt },
        { $set: { isActive: false } },
        { returnDocument: 'after' }
      );

      if (!deactivationRes) {
        return res.status(409).json({
          success: false,
          status: 409,
          message: 'Conflict: Trainer state was modified concurrently. Deactivation aborted.',
        });
      }

      const postDeactivationTimestamp = deactivationRes.updatedAt;

      // Step 2: Unassign assigned students
      try {
        const unassignRes = await User.updateMany(
          { assignedTrainer: targetUser._id },
          { $set: { assignedTrainer: null } }
        );
        unassignedStudentsCount = unassignRes.modifiedCount;
      } catch (unassignError) {
        // Step 3: Versioned CAS Rollback
        const rollbackRes = await User.updateOne(
          { _id: targetUser._id, isActive: false, updatedAt: postDeactivationTimestamp },
          { $set: { isActive: true } }
        );

        if (rollbackRes.matchedCount === 0) {
          console.error(
            `[CRITICAL_COMPENSATION_FAILURE]: Trainer ${targetUser._id} was concurrently modified after deactivation. Automated rollback aborted.`
          );
          return res.status(500).json({
            success: false,
            status: 500,
            message: 'Failed to unassign students. Automated rollback aborted due to concurrent modification.',
            recoveryStatus: 'failed',
          });
        }

        return res.status(500).json({
          success: false,
          status: 500,
          message: 'Failed to unassign students. Trainer deactivation safely rolled back.',
          recoveryStatus: 'rolled_back',
        });
      }

      await logAdminAction({
        req,
        action: 'USER_DEACTIVATED',
        targetType: 'User',
        targetId: targetUser._id,
        details: {
          targetEmail: targetUser.email,
          previousStatus: true,
          newStatus: false,
          unassignedStudentsCount,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Trainer deactivated successfully and ${unassignedStudentsCount} student(s) unassigned`,
        unassignedStudentsCount,
        data: deactivationRes,
      });
    }

    // Standard activation/deactivation for students and non-trainers
    targetUser.isActive = isActive;
    await targetUser.save();

    await logAdminAction({
      req,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      targetType: 'User',
      targetId: targetUser._id,
      details: {
        targetEmail: targetUser.email,
        previousStatus: !isActive,
        newStatus: isActive,
        unassignedStudentsCount: 0,
      },
    });

    res.status(200).json({
      success: true,
      message: `User account ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: targetUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a user's role with versioned CAS rollback on trainer transitions
// @route   PATCH /api/admin/users/:id/role
// @access  Protected (Admin only)
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body || {};

    const primaryAdminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    if (!primaryAdminEmail) {
      return res.status(500).json({
        success: false,
        status: 500,
        message: 'Configuration Error: ADMIN_EMAIL is not configured. Role modifications are temporarily locked.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid user ID format',
      });
    }

    const allowedRoles = ['student', 'trainer', 'admin'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: `Invalid role specified. Permitted roles are: ${allowedRoles.join(', ')}`,
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'User not found',
      });
    }

    // Guard 1: Primary Admin Protection - Cannot demote primary admin
    if (targetUser.email.toLowerCase() === primaryAdminEmail && role !== 'admin') {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: The primary Administrator account cannot be demoted or re-assigned.',
      });
    }

    // Guard 2: Prevent Admin self-demotion lockout
    if (req.user._id.toString() === targetUser._id.toString() && role !== 'admin') {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: Administrators cannot demote their own account.',
      });
    }

    const isActorPrimaryAdmin = req.user.email.toLowerCase() === primaryAdminEmail;

    // Guard 3: Only Primary Admin can grant admin role
    if (role === 'admin' && !isActorPrimaryAdmin) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: Only the primary administrator can grant administrator privileges.',
      });
    }

    // Guard 4: Only Primary Admin can demote other admins
    if (targetUser.role === 'admin' && role !== 'admin' && !isActorPrimaryAdmin) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: Only the primary administrator can demote administrator accounts.',
      });
    }

    if (targetUser.role === role) {
      return res.status(200).json({
        success: true,
        message: `User already has role '${role}'`,
        data: targetUser,
      });
    }

    const previousRole = targetUser.role;
    let unassignedStudentsCount = 0;

    // Special CAS workflow for Trainer Demotion/Role Change
    if (previousRole === 'trainer' && role !== 'trainer') {
      const baselineUpdatedAt = targetUser.updatedAt;

      // Step 1: Update role matching baseline timestamp
      const roleUpdateRes = await User.findOneAndUpdate(
        { _id: targetUser._id, role: 'trainer', updatedAt: baselineUpdatedAt },
        { $set: { role, assignedTrainer: null } },
        { returnDocument: 'after' }
      );

      if (!roleUpdateRes) {
        return res.status(409).json({
          success: false,
          status: 409,
          message: 'Conflict: User was modified concurrently. Role update aborted.',
        });
      }

      const postUpdateTimestamp = roleUpdateRes.updatedAt;

      // Step 2: Unassign previously assigned students
      try {
        const unassignRes = await User.updateMany(
          { assignedTrainer: targetUser._id },
          { $set: { assignedTrainer: null } }
        );
        unassignedStudentsCount = unassignRes.modifiedCount;
      } catch (unassignError) {
        // Step 3: Versioned CAS Rollback
        const rollbackRes = await User.updateOne(
          { _id: targetUser._id, role, updatedAt: postUpdateTimestamp },
          { $set: { role: 'trainer' } }
        );

        if (rollbackRes.matchedCount === 0) {
          console.error(
            `[CRITICAL_COMPENSATION_FAILURE]: User ${targetUser._id} was concurrently modified after role update. Automated rollback aborted.`
          );
          return res.status(500).json({
            success: false,
            status: 500,
            message: 'Failed to unassign students. Automated rollback aborted due to concurrent modification.',
            recoveryStatus: 'failed',
          });
        }

        return res.status(500).json({
          success: false,
          status: 500,
          message: 'Failed to unassign students. Trainer role change safely rolled back.',
          recoveryStatus: 'rolled_back',
        });
      }

      await logAdminAction({
        req,
        action: 'ROLE_UPDATED',
        targetType: 'User',
        targetId: targetUser._id,
        details: {
          targetEmail: targetUser.email,
          previousRole,
          newRole: role,
          unassignedStudentsCount,
        },
      });

      return res.status(200).json({
        success: true,
        message: `User role updated to '${role}' successfully and ${unassignedStudentsCount} student(s) unassigned`,
        unassignedStudentsCount,
        data: roleUpdateRes,
      });
    }

    // Role change from student to trainer/admin: clear assignedTrainer
    if (previousRole === 'student') {
      targetUser.assignedTrainer = null;
    }

    targetUser.role = role;
    await targetUser.save();

    await logAdminAction({
      req,
      action: 'ROLE_UPDATED',
      targetType: 'User',
      targetId: targetUser._id,
      details: {
        targetEmail: targetUser.email,
        previousRole,
        newRole: role,
        unassignedStudentsCount: 0,
      },
    });

    res.status(200).json({
      success: true,
      message: `User role updated to '${role}' successfully`,
      data: targetUser,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. Trainer & Student Assignment Management
// ==========================================
// @desc    List all active trainers with their live assigned student workload counts
// @route   GET /api/admin/trainers
// @access  Protected (Admin only)
const getTrainers = async (req, res, next) => {
  try {
    const trainers = await User.find({ role: 'trainer', isActive: true })
      .select('_id name email isActive createdAt')
      .sort({ name: 1 });

    const trainerIds = trainers.map((t) => t._id);

    // Compute live assigned student counts
    const studentCountAgg = await User.aggregate([
      { $match: { role: 'student', assignedTrainer: { $in: trainerIds } } },
      { $group: { _id: '$assignedTrainer', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    studentCountAgg.forEach((item) => {
      countMap[item._id.toString()] = item.count;
    });

    const data = trainers.map((t) => ({
      _id: t._id,
      name: t.name,
      email: t.email,
      isActive: t.isActive,
      assignedStudentsCount: countMap[t._id.toString()] || 0,
      createdAt: t.createdAt,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated unassigned students
// @route   GET /api/admin/students/unassigned
// @access  Protected (Admin only)
const getUnassignedStudents = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { role: 'student', isActive: true, assignedTrainer: null };

    if (req.query.search && typeof req.query.search === 'string') {
      const escaped = escapeRegex(req.query.search.trim());
      if (escaped) {
        filter.$or = [
          { name: { $regex: escaped, $options: 'i' } },
          { email: { $regex: escaped, $options: 'i' } },
        ];
      }
    }

    const [total, students] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      count: students.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      data: students,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign, reassign, or unassign an individual student
// @route   POST /api/admin/assignments
// @access  Protected (Admin only)
const assignStudent = async (req, res, next) => {
  try {
    const { studentId, trainerId } = req.body || {};

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid or missing studentId',
      });
    }

    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Student not found',
      });
    }

    if (!student.isActive) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Cannot assign deactivated student',
      });
    }

    const previousTrainerId = student.assignedTrainer ? student.assignedTrainer.toString() : null;

    if (trainerId === null || trainerId === '') {
      // Unassign student
      student.assignedTrainer = null;
      await student.save();

      await logAdminAction({
        req,
        action: 'STUDENT_UNASSIGNED',
        targetType: 'User',
        targetId: student._id,
        details: {
          studentId: student._id.toString(),
          previousTrainerId,
          targetTrainerId: null,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Student unassigned successfully',
        data: student,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(trainerId)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid trainerId format',
      });
    }

    const trainer = await User.findOne({ _id: trainerId, role: 'trainer', isActive: true });
    if (!trainer) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid target trainer: trainer must exist, have role "trainer", and be active',
      });
    }

    student.assignedTrainer = trainer._id;
    await student.save();

    await logAdminAction({
      req,
      action: 'STUDENT_ASSIGNED',
      targetType: 'User',
      targetId: student._id,
      details: {
        studentId: student._id.toString(),
        previousTrainerId,
        targetTrainerId: trainer._id.toString(),
      },
    });

    const populatedStudent = await User.findById(student._id).populate('assignedTrainer', '_id name email');

    res.status(200).json({
      success: true,
      message: `Student successfully assigned to trainer ${trainer.name}`,
      data: populatedStudent,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk assign or unassign multiple students to a trainer
// @route   POST /api/admin/assignments/bulk
// @access  Protected (Admin only)
const bulkAssignStudents = async (req, res, next) => {
  try {
    const { studentIds, trainerId } = req.body || {};

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'studentIds must be a non-empty array of user IDs',
      });
    }

    if (studentIds.length > 100) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Batch size exceeds maximum limit of 100 students per request',
      });
    }

    let targetTrainer = null;
    let targetTrainerId = null;

    if (trainerId !== null && trainerId !== undefined && trainerId !== '') {
      if (!mongoose.Types.ObjectId.isValid(trainerId)) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: 'Invalid trainerId format',
        });
      }

      targetTrainer = await User.findOne({ _id: trainerId, role: 'trainer', isActive: true });
      if (!targetTrainer) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: 'Invalid target trainer: trainer must exist, have role "trainer", and be active',
        });
      }
      targetTrainerId = targetTrainer._id;
    }

    // Deduplicate studentIds
    const rawIds = studentIds.map((id) => String(id).trim());
    const uniqueIds = Array.from(new Set(rawIds));

    const validObjectIds = [];
    const skippedDetails = [];

    uniqueIds.forEach((id) => {
      if (mongoose.Types.ObjectId.isValid(id)) {
        validObjectIds.push(new mongoose.Types.ObjectId(id));
      } else {
        skippedDetails.push({ id, reason: 'invalid_id_format' });
      }
    });

    const candidateUsers = await User.find({ _id: { $in: validObjectIds } }).select(
      '_id role isActive assignedTrainer name email'
    );

    const candidateMap = new Map();
    candidateUsers.forEach((u) => candidateMap.set(u._id.toString(), u));

    const toUpdateIds = [];
    let precheckUnchanged = 0;

    validObjectIds.forEach((idObj) => {
      const idStr = idObj.toString();
      const user = candidateMap.get(idStr);

      if (!user) {
        skippedDetails.push({ id: idStr, reason: 'user_not_found' });
      } else if (!user.isActive) {
        skippedDetails.push({ id: idStr, reason: 'user_inactive' });
      } else if (user.role !== 'student') {
        skippedDetails.push({ id: idStr, reason: 'invalid_role' });
      } else {
        const currentTrainerStr = user.assignedTrainer ? user.assignedTrainer.toString() : null;
        const targetTrainerStr = targetTrainerId ? targetTrainerId.toString() : null;

        if (currentTrainerStr === targetTrainerStr) {
          precheckUnchanged += 1;
        } else {
          toUpdateIds.push(idObj);
        }
      }
    });

    let databaseModified = 0;
    let databaseMatched = 0;

    if (toUpdateIds.length > 0) {
      const updateRes = await User.updateMany(
        {
          _id: { $in: toUpdateIds },
          role: 'student',
          isActive: true,
        },
        { $set: { assignedTrainer: targetTrainerId } }
      );
      databaseModified = updateRes.modifiedCount;
      databaseMatched = updateRes.matchedCount;
    }

    await logAdminAction({
      req,
      action: targetTrainerId ? 'BULK_ASSIGNED' : 'BULK_UNASSIGNED',
      targetType: 'User',
      targetId: targetTrainerId || null,
      details: {
        targetTrainerId: targetTrainerId ? targetTrainerId.toString() : null,
        requestedCount: studentIds.length,
        databaseModified,
        databaseMatched,
        precheckUnchanged,
        precheckSkipped: skippedDetails.length,
      },
    });

    res.status(200).json({
      success: true,
      message: targetTrainerId
        ? `Bulk assignment completed: ${databaseModified} student(s) updated`
        : `Bulk unassignment completed: ${databaseModified} student(s) unassigned`,
      data: {
        summary: {
          requested: studentIds.length,
          uniqueRequested: uniqueIds.length,
          databaseModified,
          databaseMatched,
          precheckUnchanged,
          precheckSkipped: skippedDetails.length,
        },
        skippedDetails,
        targetTrainer: targetTrainer ? { _id: targetTrainer._id, name: targetTrainer.name } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. Platform Assessment Oversight & Analytics
// ==========================================
// @desc    Platform-wide score distribution & topic diagnostics
// @route   GET /api/admin/analytics/overview
// @access  Protected (Admin only)
const getPlatformAnalyticsOverview = async (req, res, next) => {
  try {
    const completedAssessments = await Assessment.find({ status: 'completed' }).select(
      'scoring weakTopics completedAt'
    );

    const stats = calculateNormalizedAverages(completedAssessments);

    const scoreBuckets = {
      under50: 0,
      between50and69: 0,
      between70and84: 0,
      between85and100: 0,
    };

    const weakTopicFrequency = {};

    completedAssessments.forEach((a) => {
      const pct = Number(a.scoring?.overallPercentage);
      if (!isNaN(pct) && a.scoring?.isFullyEvaluated) {
        if (pct < 50) scoreBuckets.under50++;
        else if (pct < 70) scoreBuckets.between50and69++;
        else if (pct < 85) scoreBuckets.between70and84++;
        else scoreBuckets.between85and100++;
      }

      if (Array.isArray(a.weakTopics)) {
        a.weakTopics.forEach((t) => {
          if (t) weakTopicFrequency[t] = (weakTopicFrequency[t] || 0) + 1;
        });
      }
    });

    const topWeakTopics = Object.entries(weakTopicFrequency)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
        totalCompleted: completedAssessments.length,
        fullyEvaluatedCount: stats.fullyEvaluatedCount,
        pendingEvaluationCount: stats.pendingEvaluationCount,
        averages: {
          overallPercentage: stats.averageOverallPercentage,
          objectivePercentage: stats.objectiveAveragePercentage,
          subjectivePercentage: stats.subjectiveAveragePercentage,
        },
        scoreDistribution: scoreBuckets,
        topWeakTopics,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List assessments platform-wide with pagination and safe summary
// @route   GET /api/admin/assessments
// @access  Protected (Admin only)
const getAdminAssessments = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status && ['in_progress', 'completed', 'abandoned'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.isFullyEvaluated !== undefined) {
      filter['scoring.isFullyEvaluated'] = req.query.isFullyEvaluated === 'true';
    }

    if (req.query.studentId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.studentId)) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: 'Invalid studentId format',
        });
      }
      filter.student = req.query.studentId;
    }

    if (req.query.topic && typeof req.query.topic === 'string') {
      filter.selectedTopics = req.query.topic;
    }

    const [total, assessments] = await Promise.all([
      Assessment.countDocuments(filter),
      Assessment.find(filter)
        .populate('student', '_id name email')
        .select('-questions -evaluationLockToken -lockedAt -isEvaluating')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      count: assessments.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      data: assessments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deep assessment audit inspection by admin
// @route   GET /api/admin/assessments/:id
// @access  Protected (Admin only)
const getAdminAssessmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid assessment ID format',
      });
    }

    const assessment = await Assessment.findById(id)
      .select('+questions.correctAnswer')
      .populate('student', '_id name email');

    if (!assessment) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Assessment not found',
      });
    }

    const sanitizedData = formatAdminAssessmentInspection(assessment);

    await logAdminAction({
      req,
      action: 'ASSESSMENT_INSPECTED',
      targetType: 'Assessment',
      targetId: assessment._id,
      details: {
        assessmentId: assessment._id.toString(),
        studentId: assessment.student ? (assessment.student._id || assessment.student).toString() : null,
        status: assessment.status,
        isFullyEvaluated: Boolean(assessment.scoring?.isFullyEvaluated),
      },
    });

    res.status(200).json({
      success: true,
      data: sanitizedData,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. Audit Log Inspection
// ==========================================
// @desc    Get paginated administrative audit logs
// @route   GET /api/admin/audit-logs
// @access  Protected (Admin only)
const getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.action && typeof req.query.action === 'string') {
      filter.action = req.query.action;
    }

    if (req.query.actorId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.actorId)) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: 'Invalid actorId format',
        });
      }
      filter.actor = req.query.actorId;
    }

    if (req.query.targetId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.targetId)) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: 'Invalid targetId format',
        });
      }
      filter.targetId = req.query.targetId;
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .populate('actor', '_id name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
  escapeRegex,
  formatCompletedAssessment,
  formatInProgressAssessment,
  formatAdminAssessmentInspection,
};
