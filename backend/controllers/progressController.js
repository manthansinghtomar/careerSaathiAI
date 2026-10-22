const Assessment = require('../models/Assessment');
const User = require('../models/User');
const {
  calculateNormalizedAverages,
  classifyTopicMastery,
  calculatePracticeActivity,
  formatSafeHistoryItem,
} = require('../utils/analyticsAggregator');

/**
 * Shared helper to run topic analytics aggregation pipeline for a student.
 * Aggregates questions across completed assessments without double counting.
 */
async function aggregateStudentTopics(studentId) {
  const pipeline = [
    {
      $match: {
        student: studentId,
        status: 'completed',
      },
    },
    { $unwind: '$questions' },
    {
      $group: {
        _id: '$questions.topic',
        totalQuestionsAttempted: { $sum: 1 },
        objectiveQuestions: {
          $sum: { $cond: [{ $eq: ['$questions.type', 'mcq'] }, 1, 0] },
        },
        objectiveCorrect: {
          $sum: { $cond: [{ $eq: ['$questions.isCorrect', true] }, 1, 0] },
        },
        pointsEarned: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$questions.evaluationStatus',
                  ['auto_evaluated', 'ai_evaluated', 'manual_evaluated'],
                ],
              },
              { $ifNull: ['$questions.pointsEarned', 0] },
              0,
            ],
          },
        },
        maxEvaluatedPoints: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$questions.evaluationStatus',
                  ['auto_evaluated', 'ai_evaluated', 'manual_evaluated'],
                ],
              },
              { $ifNull: ['$questions.maxPoints', 1] },
              0,
            ],
          },
        },
        pendingQuestionsCount: {
          $sum: {
            $cond: [
              { $eq: ['$questions.evaluationStatus', 'pending_evaluation'] },
              1,
              0,
            ],
          },
        },
        assessmentsSet: { $addToSet: '$_id' },
      },
    },
  ];

  const results = await Assessment.aggregate(pipeline);

  return results.map((item) => {
    const accuracy =
      item.maxEvaluatedPoints > 0
        ? Math.round((item.pointsEarned / item.maxEvaluatedPoints) * 100)
        : null;

    const status = classifyTopicMastery(
      accuracy,
      item.totalQuestionsAttempted,
      item.pendingQuestionsCount
    );

    return {
      topic: item._id,
      totalQuestionsAttempted: item.totalQuestionsAttempted,
      objectiveQuestions: item.objectiveQuestions,
      objectiveCorrect: item.objectiveCorrect,
      pointsEarned: Math.round(item.pointsEarned * 100) / 100,
      maxPoints: item.maxEvaluatedPoints,
      accuracyPercentage: accuracy,
      pendingQuestionsCount: item.pendingQuestionsCount,
      status,
      assessmentsCount: Array.isArray(item.assessmentsSet) ? item.assessmentsSet.length : 0,
    };
  });
}

// @desc    Get student dashboard summary & analytics KPIs
// @route   GET /api/progress/dashboard
// @access  Protected (Student only)
const getDashboardSummary = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    // Fetch all student assessments sorted chronologically descending
    const allAssessments = await Assessment.find({ student: studentId })
      .select('-questions')
      .sort({ completedAt: -1, createdAt: -1 });

    const completedAssessments = allAssessments.filter((a) => a.status === 'completed');
    const inProgressAssessments = allAssessments.filter((a) => a.status === 'in_progress');

    // Calculate standardized score averages
    const averages = calculateNormalizedAverages(completedAssessments);

    // Calculate practice days and recent completion activity
    const activity = calculatePracticeActivity(completedAssessments);

    // Calculate login streak using existing UTC day index semantics
    const streakCount = req.user.gamification?.streakCount || 1;
    const lastActiveDate = req.user.gamification?.lastActiveDate || null;
    const todayUtc = Math.floor(Date.now() / 86400000);
    const lastActiveUtc = lastActiveDate
      ? Math.floor(new Date(lastActiveDate).getTime() / 86400000)
      : null;

    const dayDiff = lastActiveUtc !== null ? todayUtc - lastActiveUtc : null;
    const isBroken = dayDiff !== null && dayDiff > 1;
    const currentStreak = isBroken ? 1 : streakCount;
    const isActiveToday = dayDiff === 0;

    // Fetch aggregate topics for strong / weak diagnostics
    const aggregatedTopics = await aggregateStudentTopics(studentId);
    const strongTopics = aggregatedTopics
      .filter((t) => t.status === 'strong')
      .map((t) => t.topic);
    const weakTopics = aggregatedTopics
      .filter((t) => t.status === 'weak')
      .map((t) => t.topic);

    // Format top 5 recent assessments safely
    const recentAssessments = allAssessments
      .slice(0, 5)
      .map((a) => formatSafeHistoryItem(a));

    res.status(200).json({
      success: true,
      data: {
        student: {
          name: req.user.name,
          targetRole: req.user.careerProfile?.targetRole || 'Full Stack Developer',
          preferredLanguage: req.user.preferredLanguage || 'en',
        },
        kpis: {
          totalAssessmentsTaken: allAssessments.length,
          completedAssessments: completedAssessments.length,
          inProgressAssessments: inProgressAssessments.length,
          fullyEvaluatedAssessments: averages.fullyEvaluatedCount,
          pendingEvaluationAssessments: averages.pendingEvaluationCount,
          averageOverallPercentage: averages.averageOverallPercentage,
          latestOverallPercentage: averages.latestOverallPercentage,
          bestOverallPercentage: averages.bestOverallPercentage,
          objectiveAveragePercentage: averages.objectiveAveragePercentage,
          subjectiveAveragePercentage: averages.subjectiveAveragePercentage,
        },
        streak: {
          currentStreak,
          lastActiveDate,
          isActiveToday,
          assessmentDaysCount: activity.totalPracticeDays,
        },
        activity: {
          totalPracticeDays: activity.totalPracticeDays,
          completedThisWeek: activity.completedThisWeek,
          lastAssessmentDate: activity.lastAssessmentDate,
        },
        recentAssessments,
        weakTopics,
        strongTopics,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated, filterable assessment history
// @route   GET /api/progress/history
// @access  Protected (Student only)
const getAssessmentHistory = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const { page = 1, limit = 10, status = 'all', topic } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    // Strict ownership & optional query filtering
    const filter = { student: studentId };

    if (status && status !== 'all') {
      const allowedStatuses = ['completed', 'in_progress', 'abandoned'];
      if (allowedStatuses.includes(status.toLowerCase().trim())) {
        filter.status = status.toLowerCase().trim();
      }
    }

    if (topic && typeof topic === 'string' && topic.trim()) {
      filter.selectedTopics = topic.trim();
    }

    const total = await Assessment.countDocuments(filter);

    // Strictly exclude questions array to prevent solution leakage
    const rawAssessments = await Assessment.find(filter)
      .select('-questions')
      .sort({ completedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    const data = rawAssessments.map((a) => formatSafeHistoryItem(a));

    const totalPages = Math.max(1, Math.ceil(total / parsedLimit));

    res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasNextPage: skip + rawAssessments.length < total,
        hasPrevPage: parsedPage > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get chronological score trends for visual charts
// @route   GET /api/progress/trends
// @access  Protected (Student only)
const getProgressTrends = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const { limit = 20, evaluatedOnly = 'true' } = req.query;

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const isEvaluatedOnly = String(evaluatedOnly).toLowerCase() === 'true';

    const filter = {
      student: studentId,
      status: 'completed',
    };

    if (isEvaluatedOnly) {
      filter['scoring.isFullyEvaluated'] = true;
    }

    // Chronological order (ascending by completion / creation time)
    const assessments = await Assessment.find(filter)
      .select('scoring selectedTopics completedAt createdAt')
      .sort({ completedAt: 1, createdAt: 1 })
      .limit(parsedLimit);

    const points = assessments.map((a) => ({
      assessmentId: a._id,
      date: a.completedAt || a.createdAt,
      overallPercentage: a.scoring?.overallPercentage ?? 0,
      objectivePercentage: a.scoring?.objectivePercentage ?? 0,
      subjectivePercentage: a.scoring?.subjectivePercentage ?? 0,
      isFullyEvaluated: Boolean(a.scoring?.isFullyEvaluated),
      topics: a.selectedTopics || [],
    }));

    res.status(200).json({
      success: true,
      count: points.length,
      data: points,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get aggregated topic mastery analytics across all completed assessments
// @route   GET /api/progress/topics
// @access  Protected (Student only)
const getTopicAnalytics = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    const topics = await aggregateStudentTopics(studentId);

    // Sort topics by accuracy descending, then by total questions descending
    topics.sort((a, b) => {
      const accA = a.accuracyPercentage ?? -1;
      const accB = b.accuracyPercentage ?? -1;
      if (accB !== accA) return accB - accA;
      return b.totalQuestionsAttempted - a.totalQuestionsAttempted;
    });

    const summary = {
      totalTopicsAssessed: topics.length,
      strongTopicsCount: topics.filter((t) => t.status === 'strong').length,
      developingTopicsCount: topics.filter((t) => t.status === 'developing').length,
      weakTopicsCount: topics.filter((t) => t.status === 'weak').length,
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        topics,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary,
  getAssessmentHistory,
  getProgressTrends,
  getTopicAnalytics,
};
