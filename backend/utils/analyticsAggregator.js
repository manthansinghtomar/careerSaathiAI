/**
 * Analytics Aggregator Utility for CareerSaathi AI (Module 5)
 * Pure, deterministic calculation functions for scoring normalization,
 * topic mastery classification, practice activity, and response whitelisting.
 */

/**
 * Calculates normalized GPA-style averages on a consistent 0-100 percentage scale.
 * Strictly excludes in-progress and unevaluated assessments from overall score calculations.
 *
 * @param {Array<Object>} completedAssessments - Array of completed assessment objects/documents
 * @returns {Object} Normalized averages and score bounds
 */
function calculateNormalizedAverages(completedAssessments = []) {
  if (!Array.isArray(completedAssessments) || completedAssessments.length === 0) {
    return {
      averageOverallPercentage: null,
      latestOverallPercentage: null,
      bestOverallPercentage: null,
      objectiveAveragePercentage: null,
      subjectiveAveragePercentage: null,
      fullyEvaluatedCount: 0,
      pendingEvaluationCount: 0,
    };
  }

  // Filter assessments that are fully evaluated (all objective & subjective evaluation complete)
  const fullyEvaluated = completedAssessments.filter(
    (a) => a.scoring?.isFullyEvaluated === true
  );

  const pendingEvaluationCount = completedAssessments.filter(
    (a) => a.scoring?.isFullyEvaluated === false
  ).length;

  // 1. Overall Average Percentage (strictly over fully evaluated tests)
  const averageOverallPercentage =
    fullyEvaluated.length > 0
      ? Math.round(
          fullyEvaluated.reduce(
            (sum, a) => sum + (Number(a.scoring?.overallPercentage) || 0),
            0
          ) / fullyEvaluated.length
        )
      : null;

  // 2. Latest and Best overall percentages
  // Sort fully evaluated by completedAt or createdAt descending to identify the latest
  const sortedEvaluated = [...fullyEvaluated].sort((a, b) => {
    const timeA = new Date(a.completedAt || a.createdAt).getTime();
    const timeB = new Date(b.completedAt || b.createdAt).getTime();
    return timeB - timeA;
  });

  const latestOverallPercentage =
    sortedEvaluated.length > 0
      ? Math.round(Number(sortedEvaluated[0].scoring?.overallPercentage) || 0)
      : null;

  const bestOverallPercentage =
    fullyEvaluated.length > 0
      ? Math.max(
          ...fullyEvaluated.map(
            (a) => Math.round(Number(a.scoring?.overallPercentage) || 0)
          )
        )
      : null;

  // 3. Objective Average Percentage (only assessments with >= 1 objective question)
  const withObjective = completedAssessments.filter(
    (a) => (Number(a.scoring?.objectiveMaxScore) || 0) > 0
  );

  const objectiveAveragePercentage =
    withObjective.length > 0
      ? Math.round(
          withObjective.reduce(
            (sum, a) => sum + (Number(a.scoring?.objectivePercentage) || 0),
            0
          ) / withObjective.length
        )
      : null;

  // 4. Subjective Average Percentage (only assessments with subjective questions where evaluation is complete)
  const withSubjectiveEvaluated = completedAssessments.filter(
    (a) =>
      (Number(a.scoring?.subjectiveMaxScore) || 0) > 0 &&
      a.scoring?.isFullyEvaluated === true
  );

  const subjectiveAveragePercentage =
    withSubjectiveEvaluated.length > 0
      ? Math.round(
          withSubjectiveEvaluated.reduce(
            (sum, a) => sum + (Number(a.scoring?.subjectivePercentage) || 0),
            0
          ) / withSubjectiveEvaluated.length
        )
      : null;

  return {
    averageOverallPercentage,
    latestOverallPercentage,
    bestOverallPercentage,
    objectiveAveragePercentage,
    subjectiveAveragePercentage,
    fullyEvaluatedCount: fullyEvaluated.length,
    pendingEvaluationCount,
  };
}

/**
 * Classifies a topic into strong, developing, or weak based on accuracy & sample size.
 *
 * @param {number|null} accuracyPercentage - Topic accuracy (0-100)
 * @param {number} totalQuestionsAttempted - Total questions answered in topic
 * @param {number} [pendingQuestionsCount=0] - Number of subjective answers awaiting AI evaluation
 * @returns {'strong'|'developing'|'weak'|'pending'|'unassessed'}
 */
function classifyTopicMastery(
  accuracyPercentage,
  totalQuestionsAttempted = 0,
  pendingQuestionsCount = 0
) {
  if (accuracyPercentage === null || accuracyPercentage === undefined) {
    if (pendingQuestionsCount > 0) return 'pending';
    return 'unassessed';
  }

  // Strong requires solid accuracy (>= 75%) and minimum sample size (>= 3 questions)
  if (accuracyPercentage >= 75 && totalQuestionsAttempted >= 3) {
    return 'strong';
  }

  // Developing: 60-74% or >=75% with insufficient question count (<3 questions)
  if (accuracyPercentage >= 60) {
    return 'developing';
  }

  // Weak: < 60%
  return 'weak';
}

/**
 * Calculates distinct UTC calendar practice days and recent activity from assessment timestamps.
 *
 * @param {Array<Object>} completedAssessments - Array of completed assessments
 * @param {Date} [referenceDate=new Date()] - Deterministic reference date for testing
 * @returns {Object} Activity metrics
 */
function calculatePracticeActivity(
  completedAssessments = [],
  referenceDate = new Date()
) {
  const now =
    referenceDate instanceof Date && !isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();

  const sevenDaysAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const uniqueDayIndices = new Set();
  let completedThisWeek = 0;
  let lastAssessmentDate = null;

  completedAssessments.forEach((a) => {
    const compDate = a.completedAt ? new Date(a.completedAt) : null;
    if (!compDate || isNaN(compDate.getTime())) return;

    // Track latest completion date
    if (!lastAssessmentDate || compDate > lastAssessmentDate) {
      lastAssessmentDate = compDate;
    }

    // Normalized UTC Day Index
    const utcDay = Math.floor(
      Date.UTC(
        compDate.getUTCFullYear(),
        compDate.getUTCMonth(),
        compDate.getUTCDate()
      ) / 86400000
    );
    uniqueDayIndices.add(utcDay);

    // Activity in last 7 days
    if (compDate.getTime() >= sevenDaysAgoMs) {
      completedThisWeek += 1;
    }
  });

  return {
    totalPracticeDays: uniqueDayIndices.size,
    completedThisWeek,
    lastAssessmentDate,
  };
}

/**
 * Strips internal and sensitive fields from assessment documents for safe history listing.
 * Guarantees in-progress assessments NEVER expose answers, solutions, or explanations.
 *
 * @param {Object} assessment - Mongoose document or plain object
 * @returns {Object} Safe client payload
 */
function formatSafeHistoryItem(assessment) {
  if (!assessment) return null;
  const a = typeof assessment.toObject === 'function' ? assessment.toObject() : { ...assessment };

  const isCompleted = a.status === 'completed';

  if (!isCompleted) {
    // In-progress / abandoned: Whitelist ONLY safe operational metadata
    return {
      _id: a._id,
      targetRole: a.targetRole || 'Full Stack Developer',
      selectedTopics: a.selectedTopics || [],
      status: a.status || 'in_progress',
      totalQuestions: a.totalQuestions || 0,
      objectiveQuestionsCount: a.objectiveQuestionsCount || 0,
      subjectiveQuestionsCount: a.subjectiveQuestionsCount || 0,
      startedAt: a.startedAt || a.createdAt,
      createdAt: a.createdAt,
    };
  }

  // Completed: Include sanitized scoring and results summary
  return {
    _id: a._id,
    targetRole: a.targetRole || 'Full Stack Developer',
    selectedTopics: a.selectedTopics || [],
    status: 'completed',
    totalQuestions: a.totalQuestions || 0,
    objectiveQuestionsCount: a.objectiveQuestionsCount || 0,
    subjectiveQuestionsCount: a.subjectiveQuestionsCount || 0,
    isFullyEvaluated: Boolean(a.scoring?.isFullyEvaluated),
    scoring: {
      overallScore: a.scoring?.overallScore ?? 0,
      overallMaxScore: a.scoring?.overallMaxScore ?? 0,
      overallPercentage: a.scoring?.overallPercentage ?? 0,
      objectiveScore: a.scoring?.objectiveScore ?? 0,
      objectiveMaxScore: a.scoring?.objectiveMaxScore ?? 0,
      objectivePercentage: a.scoring?.objectivePercentage ?? 0,
      subjectiveScore: a.scoring?.subjectiveScore ?? 0,
      subjectiveMaxScore: a.scoring?.subjectiveMaxScore ?? 0,
      subjectivePercentage: a.scoring?.subjectivePercentage ?? 0,
    },
    weakTopics: a.weakTopics || [],
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    createdAt: a.createdAt,
  };
}

module.exports = {
  calculateNormalizedAverages,
  classifyTopicMastery,
  calculatePracticeActivity,
  formatSafeHistoryItem,
};
