const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const {
  calculateNormalizedAverages,
  classifyTopicMastery,
  calculatePracticeActivity,
  formatSafeHistoryItem,
} = require('../utils/analyticsAggregator');
const { safeDispatchNotification } = require('../services/notificationService');

const STALE_LOCK_TIMEOUT_MS = 30000; // 30 seconds cutoff for stale lock recovery

/**
 * Escapes special characters for safe regular expression querying (ReDoS protection).
 * @param {string} text
 * @returns {string} Escaped string
 */
function escapeRegex(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Verifies that a student exists and is assigned to the requesting trainer (or user is admin).
 * @param {string} studentId
 * @param {Object} reqUser - Authenticated user from authMiddleware
 * @returns {Promise<Object>} Student document
 */
async function verifyStudentOwnership(studentId, reqUser) {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    const error = new Error('Invalid student ID format');
    error.statusCode = 400;
    throw error;
  }

  const student = await User.findOne({ _id: studentId, role: 'student', isActive: true });
  if (!student) {
    const error = new Error('Student not found');
    error.statusCode = 404;
    throw error;
  }

  if (reqUser.role === 'trainer') {
    if (
      !student.assignedTrainer ||
      student.assignedTrainer.toString() !== reqUser._id.toString()
    ) {
      const error = new Error('Access forbidden: Student is not assigned to you');
      error.statusCode = 403;
      throw error;
    }
  }

  return student;
}

/**
 * Verifies that an assessment exists and belongs to a student assigned to the trainer (or admin).
 * @param {string} assessmentId
 * @param {Object} reqUser - Authenticated user
 * @returns {Promise<{ assessment: Object, student: Object }>}
 */
async function verifyAssessmentOwnership(assessmentId, reqUser) {
  if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
    const error = new Error('Invalid assessment ID format');
    error.statusCode = 400;
    throw error;
  }

  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) {
    const error = new Error('Assessment not found');
    error.statusCode = 404;
    throw error;
  }

  const student = await User.findById(assessment.student);
  if (!student) {
    const error = new Error('Associated student record not found');
    error.statusCode = 404;
    throw error;
  }

  if (reqUser.role === 'trainer') {
    if (
      !student.assignedTrainer ||
      student.assignedTrainer.toString() !== reqUser._id.toString()
    ) {
      const error = new Error('Access forbidden: Assessment does not belong to an assigned student');
      error.statusCode = 403;
      throw error;
    }
  }

  return { assessment, student };
}

/**
 * Acquires an atomic, tokenized lock on an assessment.
 * Supports legacy assessments where isEvaluating is undefined/null and auto-recovers stale locks (>30s).
 *
 * @param {string} assessmentId
 * @returns {Promise<{ lockedAssessment: Object, lockToken: string }>}
 */
async function acquireFencedLock(assessmentId) {
  const lockToken = crypto.randomUUID();
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_LOCK_TIMEOUT_MS);

  const lockedAssessment = await Assessment.findOneAndUpdate(
    {
      _id: assessmentId,
      status: 'completed',
      $or: [
        { isEvaluating: { $ne: true } },
        { lockedAt: { $lt: staleThreshold } },
      ],
    },
    {
      $set: {
        isEvaluating: true,
        evaluationLockToken: lockToken,
        lockedAt: now,
      },
    },
    { returnDocument: 'after' }
  ).select('+questions.correctAnswer');

  if (!lockedAssessment) {
    const current = await Assessment.findById(assessmentId);
    if (current?.isEvaluating === true) {
      const error = new Error('Evaluation or grading is already in progress for this assessment. Please wait.');
      error.statusCode = 409;
      throw error;
    }
    const error = new Error('Assessment cannot be graded or modified in its current state');
    error.statusCode = 400;
    throw error;
  }

  return { lockedAssessment, lockToken };
}

/**
 * Recalculates scoring totals and topic-wise diagnostics from question snapshots.
 * Preserves objective scoring and honors weighted maxPoints.
 *
 * @param {Array<Object>} questions
 * @param {number} objectiveScore
 * @param {number} objectiveMaxScore
 * @param {number} objectivePercentage
 * @returns {{ scoring: Object, topicWiseResults: Array<Object>, weakTopics: Array<String>, isFullyEvaluated: Boolean }}
 */
function recalculateAssessmentScores(questions, objectiveScore, objectiveMaxScore, objectivePercentage) {
  let subjectivePoints = 0;
  let subjectiveTotalMax = 0;
  let subjectiveEvalMax = 0;

  questions.forEach((q) => {
    if (q.type === 'text') {
      const qMax = Number.isFinite(q.maxPoints) && q.maxPoints > 0 ? q.maxPoints : 1;
      subjectiveTotalMax += qMax;
      if (['ai_evaluated', 'manual_evaluated'].includes(q.evaluationStatus)) {
        subjectiveEvalMax += qMax;
        subjectivePoints += Number.isFinite(q.pointsEarned) && q.pointsEarned > 0 ? q.pointsEarned : 0;
      }
    }
  });

  subjectivePoints = Math.round(subjectivePoints * 100) / 100;
  const subjectivePercentage =
    subjectiveTotalMax > 0 ? Math.round((subjectivePoints / subjectiveTotalMax) * 100) : 0;

  const overallScore = Math.round((objectiveScore + subjectivePoints) * 100) / 100;
  const overallMaxScore = objectiveMaxScore + subjectiveTotalMax;
  const overallPercentage =
    overallMaxScore > 0 ? Math.round((overallScore / overallMaxScore) * 100) : 0;

  const VALID_EVALUATED_STATUSES = ['auto_evaluated', 'ai_evaluated', 'manual_evaluated'];
  const isFullyEvaluated =
    questions.length > 0 &&
    questions.every(
      (q) => VALID_EVALUATED_STATUSES.includes(q.evaluationStatus) && q.pointsEarned !== null
    );

  // Dynamic snapshot traversal for topicWiseResults
  const topicStats = {};
  questions.forEach((q) => {
    if (!topicStats[q.topic]) {
      topicStats[q.topic] = {
        totalQuestions: 0,
        objectiveCorrect: 0,
        objectiveTotal: 0,
        subjectivePoints: 0,
        subjectiveEvalMax: 0,
      };
    }
    topicStats[q.topic].totalQuestions += 1;

    const qMax = Number.isFinite(q.maxPoints) && q.maxPoints > 0 ? q.maxPoints : 1;
    if (q.type === 'mcq') {
      topicStats[q.topic].objectiveTotal += qMax;
      if (q.isCorrect) {
        topicStats[q.topic].objectiveCorrect += Number.isFinite(q.pointsEarned) && q.pointsEarned > 0 ? q.pointsEarned : qMax;
      }
    } else if (q.type === 'text' && ['ai_evaluated', 'manual_evaluated'].includes(q.evaluationStatus)) {
      topicStats[q.topic].subjectiveEvalMax += qMax;
      topicStats[q.topic].subjectivePoints += Number.isFinite(q.pointsEarned) && q.pointsEarned > 0 ? q.pointsEarned : 0;
    }
  });

  const topicWiseResults = [];
  const weakTopics = [];

  Object.entries(topicStats).forEach(([topicName, stats]) => {
    const evalEarned = stats.objectiveCorrect + stats.subjectivePoints;
    const evalMax = stats.objectiveTotal + stats.subjectiveEvalMax;
    const topicPct = evalMax > 0 ? Math.round((evalEarned / evalMax) * 100) : 0;
    const isWeak = evalMax > 0 && topicPct < 60;

    if (isWeak) {
      weakTopics.push(topicName);
    }

    topicWiseResults.push({
      topic: topicName,
      totalQuestions: stats.totalQuestions,
      objectiveCorrect: stats.objectiveCorrect,
      objectiveTotal: stats.objectiveTotal,
      percentage: topicPct,
      isWeakTopic: isWeak,
    });
  });

  const scoring = {
    objectiveScore,
    objectiveMaxScore,
    objectivePercentage,
    subjectiveScore: subjectivePoints,
    subjectiveMaxScore: subjectiveTotalMax,
    subjectivePercentage,
    overallScore,
    overallMaxScore,
    overallPercentage,
    isFullyEvaluated,
  };

  return { scoring, topicWiseResults, weakTopics, isFullyEvaluated };
}

// =================================================================
// CONTROLLER HANDLERS
// =================================================================

// @desc    Get trainer dashboard KPIs, cohort performance, and weak topics
// @route   GET /api/trainer/dashboard
// @access  Protected (Trainer [assigned cohort], Admin [global cohort])
const getTrainerDashboard = async (req, res, next) => {
  try {
    const studentQuery = { role: 'student', isActive: true };
    if (req.user.role === 'trainer') {
      studentQuery.assignedTrainer = req.user._id;
    }

    const assignedStudents = await User.find(studentQuery).select(
      '_id name email gamification careerProfile preferredLanguage'
    );
    const studentIds = assignedStudents.map((s) => s._id);

    if (studentIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          cohort: {
            assignedStudentsCount: 0,
            activeStudentsCount: 0,
            totalAssessmentsCompleted: 0,
            pendingAiEvaluation: 0,
            needingTrainerReview: 0,
            cohortAveragePercentage: null,
            cohortObjectiveAverage: null,
            cohortSubjectiveAverage: null,
          },
          weakTopics: [],
          strongTopics: [],
          recentSubmissions: [],
        },
      });
    }

    // Fetch all assessments for the assigned cohort
    const allAssessments = await Assessment.find({ student: { $in: studentIds } })
      .select('student status scoring completedAt createdAt selectedTopics')
      .populate('student', 'name email')
      .sort({ completedAt: -1, createdAt: -1 });

    const completedAssessments = allAssessments.filter((a) => a.status === 'completed');

    // Calculate standardized GPA averages across the cohort
    const averages = calculateNormalizedAverages(completedAssessments);

    // Active students in trailing 7 days (by login streak date OR recent assessment)
    const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeStudentIdSet = new Set();

    assignedStudents.forEach((s) => {
      if (s.gamification?.lastActiveDate) {
        const lastActiveTime = new Date(s.gamification.lastActiveDate).getTime();
        if (lastActiveTime >= sevenDaysAgoMs) {
          activeStudentIdSet.add(s._id.toString());
        }
      }
    });

    completedAssessments.forEach((a) => {
      const compTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      if (compTime >= sevenDaysAgoMs && a.student?._id) {
        activeStudentIdSet.add(a.student._id.toString());
      }
    });

    const pendingAiEvaluation = completedAssessments.filter(
      (a) => a.scoring?.isFullyEvaluated === false
    ).length;

    const needingTrainerReview = completedAssessments.filter(
      (a) => a.scoring?.isFullyEvaluated === false || (Number(a.scoring?.overallPercentage) || 0) < 60
    ).length;

    // Run topic aggregation across the cohort
    const topicAggregation = await Assessment.aggregate([
      { $match: { student: { $in: studentIds }, status: 'completed' } },
      { $unwind: '$questions' },
      {
        $group: {
          _id: '$questions.topic',
          totalQuestions: { $sum: 1 },
          pointsEarned: {
            $sum: {
              $cond: [
                { $in: ['$questions.evaluationStatus', ['auto_evaluated', 'ai_evaluated', 'manual_evaluated']] },
                { $ifNull: ['$questions.pointsEarned', 0] },
                0,
              ],
            },
          },
          maxPoints: {
            $sum: {
              $cond: [
                { $in: ['$questions.evaluationStatus', ['auto_evaluated', 'ai_evaluated', 'manual_evaluated']] },
                { $ifNull: ['$questions.maxPoints', 1] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const categorizedTopics = topicAggregation.map((t) => {
      const accuracy = t.maxPoints > 0 ? Math.round((t.pointsEarned / t.maxPoints) * 100) : 0;
      return {
        topic: t._id,
        accuracy,
        totalQuestions: t.totalQuestions,
        status: classifyTopicMastery(accuracy, t.totalQuestions),
      };
    });

    const weakTopics = categorizedTopics.filter((t) => t.status === 'weak').map((t) => t.topic);
    const strongTopics = categorizedTopics.filter((t) => t.status === 'strong').map((t) => t.topic);

    // Latest 10 completed submissions
    const recentSubmissions = completedAssessments.slice(0, 10).map((a) => ({
      _id: a._id,
      studentId: a.student?._id,
      studentName: a.student?.name || 'Unknown',
      studentEmail: a.student?.email || '',
      selectedTopics: a.selectedTopics || [],
      overallPercentage: a.scoring?.overallPercentage ?? 0,
      isFullyEvaluated: Boolean(a.scoring?.isFullyEvaluated),
      completedAt: a.completedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        cohort: {
          assignedStudentsCount: assignedStudents.length,
          activeStudentsCount: activeStudentIdSet.size,
          totalAssessmentsCompleted: completedAssessments.length,
          pendingAiEvaluation,
          needingTrainerReview,
          cohortAveragePercentage: averages.averageOverallPercentage,
          cohortObjectiveAverage: averages.objectiveAveragePercentage,
          cohortSubjectiveAverage: averages.subjectiveAveragePercentage,
        },
        weakTopics,
        strongTopics,
        recentSubmissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated directory of assigned students with search and skill filters
// @route   GET /api/trainer/students
// @access  Protected (Trainer, Admin)
const getTrainerStudents = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, skillLevel, sortBy = 'createdAt' } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = { role: 'student', isActive: true };
    if (req.user.role === 'trainer') {
      query.assignedTrainer = req.user._id;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const escaped = escapeRegex(search.trim());
      query.$or = [
        { name: new RegExp(escaped, 'i') },
        { email: new RegExp(escaped, 'i') },
      ];
    }

    if (skillLevel && typeof skillLevel === 'string' && skillLevel.trim()) {
      query['careerProfile.currentSkillLevel'] = skillLevel.trim();
    }

    let sortObj = { createdAt: -1 };
    if (sortBy === 'name') sortObj = { name: 1 };
    else if (sortBy === 'lastActiveDate') sortObj = { 'gamification.lastActiveDate': -1 };

    const total = await User.countDocuments(query);
    const students = await User.find(query)
      .select('-password')
      .sort(sortObj)
      .skip(skip)
      .limit(parsedLimit);

    // Compute academic summary for each student in the directory
    const studentIds = students.map((s) => s._id);
    const assessments = await Assessment.find({
      student: { $in: studentIds },
      status: 'completed',
    }).select('student scoring completedAt createdAt');

    const assessmentMap = new Map();
    assessments.forEach((a) => {
      const sId = a.student.toString();
      if (!assessmentMap.has(sId)) assessmentMap.set(sId, []);
      assessmentMap.get(sId).push(a);
    });

    const studentsWithMetrics = students.map((s) => {
      const studentTests = assessmentMap.get(s._id.toString()) || [];
      const averages = calculateNormalizedAverages(studentTests);
      const activity = calculatePracticeActivity(studentTests);

      return {
        _id: s._id,
        name: s.name,
        email: s.email,
        preferredLanguage: s.preferredLanguage,
        careerProfile: s.careerProfile,
        gamification: {
          streakCount: s.gamification?.streakCount || 1,
          lastActiveDate: s.gamification?.lastActiveDate,
        },
        assessmentsCompleted: studentTests.length,
        averageOverallPercentage: averages.averageOverallPercentage,
        lastAssessmentDate: activity.lastAssessmentDate,
        pendingEvaluationCount: averages.pendingEvaluationCount,
        createdAt: s.createdAt,
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / parsedLimit));

    res.status(200).json({
      success: true,
      data: studentsWithMetrics,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasNextPage: skip + students.length < total,
        hasPrevPage: parsedPage > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed student profile and performance summary
// @route   GET /api/trainer/students/:studentId
// @access  Protected (Trainer [assigned only], Admin)
const getTrainerStudentById = async (req, res, next) => {
  try {
    const student = await verifyStudentOwnership(req.params.studentId, req.user);

    const completedAssessments = await Assessment.find({
      student: student._id,
      status: 'completed',
    }).select('scoring completedAt createdAt selectedTopics');

    const inProgressCount = await Assessment.countDocuments({
      student: student._id,
      status: 'in_progress',
    });

    const averages = calculateNormalizedAverages(completedAssessments);
    const activity = calculatePracticeActivity(completedAssessments);

    res.status(200).json({
      success: true,
      data: {
        student: {
          _id: student._id,
          name: student.name,
          email: student.email,
          role: student.role,
          preferredLanguage: student.preferredLanguage,
          careerProfile: student.careerProfile,
          gamification: student.gamification,
          createdAt: student.createdAt,
        },
        summary: {
          totalAssessmentsTaken: completedAssessments.length + inProgressCount,
          completedAssessments: completedAssessments.length,
          inProgressAssessments: inProgressCount,
          averageOverallPercentage: averages.averageOverallPercentage,
          latestOverallPercentage: averages.latestOverallPercentage,
          bestOverallPercentage: averages.bestOverallPercentage,
          objectiveAveragePercentage: averages.objectiveAveragePercentage,
          subjectiveAveragePercentage: averages.subjectiveAveragePercentage,
          totalPracticeDays: activity.totalPracticeDays,
          lastAssessmentDate: activity.lastAssessmentDate,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated assessment history of an assigned student
// @route   GET /api/trainer/students/:studentId/assessments
// @access  Protected (Trainer [assigned only], Admin)
const getStudentAssessments = async (req, res, next) => {
  try {
    const student = await verifyStudentOwnership(req.params.studentId, req.user);
    const { page = 1, limit = 10, status = 'all', topic } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = { student: student._id };
    if (status && status !== 'all') {
      const allowed = ['completed', 'in_progress', 'abandoned'];
      if (allowed.includes(status.toLowerCase().trim())) {
        filter.status = status.toLowerCase().trim();
      }
    }
    if (topic && typeof topic === 'string' && topic.trim()) {
      filter.selectedTopics = topic.trim();
    }

    const total = await Assessment.countDocuments(filter);
    const assessments = await Assessment.find(filter)
      .select('-questions')
      .sort({ completedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    const safeData = assessments.map((a) => formatSafeHistoryItem(a));
    const totalPages = Math.max(1, Math.ceil(total / parsedLimit));

    res.status(200).json({
      success: true,
      data: safeData,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasNextPage: skip + assessments.length < total,
        hasPrevPage: parsedPage > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get progress analytics (trends, topic mastery, KPIs) of an assigned student
// @route   GET /api/trainer/students/:studentId/progress
// @access  Protected (Trainer [assigned only], Admin)
const getStudentProgressAnalytics = async (req, res, next) => {
  try {
    const student = await verifyStudentOwnership(req.params.studentId, req.user);

    const completedAssessments = await Assessment.find({
      student: student._id,
      status: 'completed',
    }).sort({ completedAt: 1, createdAt: 1 });

    const averages = calculateNormalizedAverages(completedAssessments);
    const activity = calculatePracticeActivity(completedAssessments);

    const trends = completedAssessments.map((a) => ({
      assessmentId: a._id,
      date: a.completedAt || a.createdAt,
      overallPercentage: a.scoring?.overallPercentage ?? 0,
      objectivePercentage: a.scoring?.objectivePercentage ?? 0,
      subjectivePercentage: a.scoring?.subjectivePercentage ?? 0,
      isFullyEvaluated: Boolean(a.scoring?.isFullyEvaluated),
      topics: a.selectedTopics || [],
    }));

    const topicAggregation = await Assessment.aggregate([
      { $match: { student: student._id, status: 'completed' } },
      { $unwind: '$questions' },
      {
        $group: {
          _id: '$questions.topic',
          totalQuestions: { $sum: 1 },
          pointsEarned: {
            $sum: {
              $cond: [
                { $in: ['$questions.evaluationStatus', ['auto_evaluated', 'ai_evaluated', 'manual_evaluated']] },
                { $ifNull: ['$questions.pointsEarned', 0] },
                0,
              ],
            },
          },
          maxPoints: {
            $sum: {
              $cond: [
                { $in: ['$questions.evaluationStatus', ['auto_evaluated', 'ai_evaluated', 'manual_evaluated']] },
                { $ifNull: ['$questions.maxPoints', 1] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const topics = topicAggregation.map((t) => {
      const accuracy = t.maxPoints > 0 ? Math.round((t.pointsEarned / t.maxPoints) * 100) : 0;
      return {
        topic: t._id,
        accuracyPercentage: accuracy,
        totalQuestionsAttempted: t.totalQuestions,
        status: classifyTopicMastery(accuracy, t.totalQuestions),
      };
    });

    res.status(200).json({
      success: true,
      data: {
        kpis: {
          averageOverallPercentage: averages.averageOverallPercentage,
          latestOverallPercentage: averages.latestOverallPercentage,
          bestOverallPercentage: averages.bestOverallPercentage,
          objectiveAveragePercentage: averages.objectiveAveragePercentage,
          subjectiveAveragePercentage: averages.subjectiveAveragePercentage,
          totalPracticeDays: activity.totalPracticeDays,
          lastAssessmentDate: activity.lastAssessmentDate,
        },
        trends,
        topics,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get complete assessment inspection with student answers & AI evaluations
// @route   GET /api/trainer/assessments/:assessmentId
// @access  Protected (Trainer [assigned only], Admin)
const getTrainerAssessmentById = async (req, res, next) => {
  try {
    const { assessment, student } = await verifyAssessmentOwnership(req.params.assessmentId, req.user);

    const fullAssessment = await Assessment.findById(assessment._id)
      .select('+questions.correctAnswer')
      .populate('student', 'name email preferredLanguage careerProfile');

    const isCompleted = fullAssessment.status === 'completed';

    // Scrub answers if in-progress
    const questionsPayload = fullAssessment.questions.map((q) => {
      const qObj = q.toObject();
      if (!isCompleted) {
        delete qObj.correctAnswer;
        if (qObj.content?.en) delete qObj.content.en.explanation;
        if (qObj.content?.hinglish) delete qObj.content.hinglish.explanation;
      }
      return qObj;
    });

    res.status(200).json({
      success: true,
      data: {
        _id: fullAssessment._id,
        student: {
          _id: student._id,
          name: student.name,
          email: student.email,
          preferredLanguage: student.preferredLanguage,
        },
        targetRole: fullAssessment.targetRole,
        selectedTopics: fullAssessment.selectedTopics,
        status: fullAssessment.status,
        totalQuestions: fullAssessment.totalQuestions,
        objectiveQuestionsCount: fullAssessment.objectiveQuestionsCount,
        subjectiveQuestionsCount: fullAssessment.subjectiveQuestionsCount,
        scoring: fullAssessment.scoring,
        topicWiseResults: fullAssessment.topicWiseResults,
        weakTopics: fullAssessment.weakTopics,
        trainerFeedback: fullAssessment.trainerFeedback,
        questions: questionsPayload,
        startedAt: fullAssessment.startedAt,
        completedAt: fullAssessment.completedAt,
        createdAt: fullAssessment.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually grade or override a subjective question score with fenced atomic lock
// @route   POST /api/trainer/assessments/:assessmentId/evaluate-question
// @access  Protected (Trainer [assigned only], Admin)
const evaluateQuestion = async (req, res, next) => {
  const { assessmentId } = req.params;
  const { questionId, pointsEarned, remarks } = req.body || {};

  // 1. Initial Format & Ownership Validation
  let ownership;
  try {
    ownership = await verifyAssessmentOwnership(assessmentId, req.user);
  } catch (err) {
    return next(err);
  }

  // 2. Validate Question ID format
  if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: 'Valid questionId is required',
    });
  }

  // 3. Acquire Fenced Atomic Lock
  let lockContext;
  try {
    lockContext = await acquireFencedLock(assessmentId);
  } catch (err) {
    return next(err);
  }

  const { lockedAssessment, lockToken } = lockContext;

  try {
    // 4. Locate target question in snapshot
    const targetQ = lockedAssessment.questions.find(
      (q) => q.questionId.toString() === questionId.toString()
    );

    if (!targetQ) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Question not found in this assessment',
      });
    }

    if (targetQ.type !== 'text') {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Only subjective text questions can be evaluated manually',
      });
    }

    // 5. Validate pointsEarned and maxPoints bounds
    const qMax = Number.isFinite(targetQ.maxPoints) && targetQ.maxPoints > 0 ? targetQ.maxPoints : 1;
    targetQ.maxPoints = qMax;

    if (typeof pointsEarned !== 'number' || !Number.isFinite(pointsEarned)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: `pointsEarned must be a finite number between 0 and ${qMax}`,
      });
    }

    if (pointsEarned < 0 || pointsEarned > qMax) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: `pointsEarned (${pointsEarned}) is out of bounds [0 - ${qMax}]`,
      });
    }

    // 6. Validate remarks
    if (!remarks || typeof remarks !== 'string' || remarks.trim().length < 2 || remarks.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Remarks must be a non-empty string between 2 and 1000 characters',
      });
    }

    // 7. Update Question Snapshot in memory
    targetQ.pointsEarned = Math.round(pointsEarned * 100) / 100;
    targetQ.evaluationStatus = 'manual_evaluated';
    targetQ.isCorrect = targetQ.pointsEarned / qMax >= 0.7; // Aligns with 70% threshold policy

    targetQ.trainerEvaluation = {
      pointsEarned: targetQ.pointsEarned,
      remarks: remarks.trim(),
      evaluatedBy: req.user._id,
      evaluatedAt: new Date(),
    };

    // 8. Deterministically recalculate scoring and topic-wise diagnostics
    const objectiveScore = lockedAssessment.scoring?.objectiveScore || 0;
    const objectiveMaxScore = lockedAssessment.scoring?.objectiveMaxScore || 0;
    const objectivePercentage = lockedAssessment.scoring?.objectivePercentage || 0;

    const { scoring, topicWiseResults, weakTopics } = recalculateAssessmentScores(
      lockedAssessment.questions,
      objectiveScore,
      objectiveMaxScore,
      objectivePercentage
    );

    // 9. FENCED CONDITIONAL COMMIT:
    // Requires exact match on evaluationLockToken. Stale commits are rejected immediately.
    const commitResult = await Assessment.findOneAndUpdate(
      {
        _id: assessmentId,
        evaluationLockToken: lockToken, // FENCING CONDITION
      },
      {
        $set: {
          questions: lockedAssessment.questions,
          scoring,
          topicWiseResults,
          weakTopics,
          isEvaluating: false,
          evaluationLockToken: null,
          lockedAt: null,
        },
      },
      { returnDocument: 'after' }
    );

    if (!commitResult) {
      return res.status(409).json({
        success: false,
        status: 409,
        message: 'Operation conflict: Evaluation lock expired or was superseded before commit. Changes were safely aborted.',
      });
    }

    safeDispatchNotification({
      recipient: commitResult.student,
      type: 'trainer_feedback',
      title: 'Trainer Graded Your Question',
      message: `A trainer has graded a question in your ${commitResult.targetRole} assessment.`,
      data: {
        assessmentId: commitResult._id,
        extra: { questionId },
      },
      idempotencyKey: `trainer_grade:${commitResult._id}:${questionId}`,
    });

    res.status(200).json({
      success: true,
      message: 'Question graded manually and assessment scores recalculated successfully',
      data: commitResult,
    });
  } catch (error) {
    next(error);
  } finally {
    // Guaranteed fenced unlock release (only releases if token still owned)
    await Assessment.findOneAndUpdate(
      { _id: assessmentId, evaluationLockToken: lockToken },
      { $set: { isEvaluating: false, evaluationLockToken: null, lockedAt: null } }
    );
  }
};

// @desc    Submit overall trainer coaching remarks for an assessment with fenced atomic lock
// @route   POST /api/trainer/assessments/:assessmentId/feedback
// @access  Protected (Trainer [assigned only], Admin)
const submitTrainerFeedback = async (req, res, next) => {
  const { assessmentId } = req.params;
  const { remarks } = req.body || {};

  try {
    await verifyAssessmentOwnership(assessmentId, req.user);
  } catch (err) {
    return next(err);
  }

  if (!remarks || typeof remarks !== 'string' || remarks.trim().length < 2 || remarks.trim().length > 1000) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: 'Remarks must be a non-empty string between 2 and 1000 characters',
    });
  }

  let lockContext;
  try {
    lockContext = await acquireFencedLock(assessmentId);
  } catch (err) {
    return next(err);
  }

  const { lockToken } = lockContext;

  try {
    const feedbackPayload = {
      remarks: remarks.trim(),
      trainer: req.user._id,
      givenAt: new Date(),
    };

    // FENCED CONDITIONAL COMMIT
    const commitResult = await Assessment.findOneAndUpdate(
      {
        _id: assessmentId,
        evaluationLockToken: lockToken,
      },
      {
        $set: {
          trainerFeedback: feedbackPayload,
          isEvaluating: false,
          evaluationLockToken: null,
          lockedAt: null,
        },
      },
      { returnDocument: 'after' }
    );

    if (!commitResult) {
      return res.status(409).json({
        success: false,
        status: 409,
        message: 'Operation conflict: Evaluation lock expired or was superseded before commit. Feedback was safely aborted.',
      });
    }

    safeDispatchNotification({
      recipient: commitResult.student,
      type: 'trainer_feedback',
      title: 'Trainer Coaching Feedback',
      message: `Your trainer provided feedback on your ${commitResult.targetRole} assessment: "${remarks.substring(0, 100)}"`,
      data: {
        assessmentId: commitResult._id,
      },
      idempotencyKey: `trainer_feedback:${commitResult._id}:${Date.now()}`,
    });

    res.status(200).json({
      success: true,
      message: 'Trainer feedback submitted successfully',
      data: commitResult,
    });
  } catch (error) {
    next(error);
  } finally {
    await Assessment.findOneAndUpdate(
      { _id: assessmentId, evaluationLockToken: lockToken },
      { $set: { isEvaluating: false, evaluationLockToken: null, lockedAt: null } }
    );
  }
};

// @desc    Get paginated cohort assessments for trainer's assigned students
// @route   GET /api/trainer/assessments
// @access  Protected (Trainer [cohort only], Admin)
const getTrainerAssessments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status = 'all', mode, topic, studentId } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    let targetStudentIds = [];

    if (studentId) {
      const student = await verifyStudentOwnership(studentId, req.user);
      targetStudentIds = [student._id];
    } else if (req.user.role === 'trainer') {
      const assignedStudents = await User.find({
        role: 'student',
        assignedTrainer: req.user._id,
        isActive: true,
      }).select('_id');
      targetStudentIds = assignedStudents.map((s) => s._id);
    }

    const filter = {};
    if (studentId || req.user.role === 'trainer') {
      filter.student = { $in: targetStudentIds };
    }

    if (status && status !== 'all') {
      const allowed = ['completed', 'in_progress', 'abandoned'];
      if (allowed.includes(status.toLowerCase().trim())) {
        filter.status = status.toLowerCase().trim();
      }
    }

    if (mode && ['mcq', 'text', 'mixed'].includes(mode.toLowerCase().trim())) {
      filter.mode = mode.toLowerCase().trim();
    }

    if (topic && typeof topic === 'string' && topic.trim()) {
      filter.selectedTopics = topic.trim();
    }

    const total = await Assessment.countDocuments(filter);
    const assessments = await Assessment.find(filter)
      .populate('student', 'name email careerProfile')
      .select('-questions')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    const safeData = assessments.map((a) => {
      const base = formatSafeHistoryItem(a);
      return {
        ...base,
        student: a.student
          ? {
              _id: a.student._id,
              name: a.student.name,
              email: a.student.email,
              targetRole: a.student.careerProfile?.targetRole || 'Full Stack Developer',
            }
          : null,
        mode: a.mode || 'mixed',
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / parsedLimit));

    res.status(200).json({
      success: true,
      data: safeData,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasNextPage: skip + assessments.length < total,
        hasPrevPage: parsedPage > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTrainerDashboard,
  getTrainerStudents,
  getTrainerStudentById,
  getStudentAssessments,
  getStudentProgressAnalytics,
  getTrainerAssessments,
  getTrainerAssessmentById,
  evaluateQuestion,
  submitTrainerFeedback,
  // Exported helpers for deterministic testing
  escapeRegex,
  recalculateAssessmentScores,
};
