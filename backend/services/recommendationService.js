const mongoose = require('mongoose');
const Recommendation = require('../models/Recommendation');
const Assessment = require('../models/Assessment');
const User = require('../models/User');
const { getActiveProvider } = require('./llm/providerFactory');
const { calculateNormalizedAverages } = require('../utils/analyticsAggregator');
const { aggregateStudentTopics } = require('../controllers/progressController');

const SUPPORTED_TOPICS = ['JavaScript', 'React', 'Node.js', 'MongoDB'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'balanced'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];
const VALID_ACTION_CATEGORIES = ['study', 'practice', 'revision'];

/**
 * Explicit in-code cache inspection.
 * Evaluates TTL expiration, student profile modifications, and assessment lifecycle changes
 * in a single fast index-backed query without relying on MongoDB background TTL monitors.
 *
 * @param {ObjectId} studentId
 * @param {Date} studentUpdatedAt
 * @param {boolean} forceRefresh
 * @returns {Promise<Object|null>} Cached recommendation document or null
 */
async function getCachedRecommendation(studentId, studentUpdatedAt, forceRefresh = false) {
  if (forceRefresh) {
    return null;
  }

  const cached = await Recommendation.findOne({ student: studentId });
  if (!cached) {
    return null;
  }

  // 1. Explicit in-code expiration check (strict application-level TTL enforcement)
  if (!cached.expiresAt || new Date(cached.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  // 2. Profile modification invalidation
  if (
    studentUpdatedAt &&
    new Date(studentUpdatedAt).getTime() > new Date(cached.generatedAt).getTime()
  ) {
    return null;
  }

  // 3. Assessment lifecycle invalidation: checks new completions, AI evaluations, and manual grading in one query
  const latestAssessment = await Assessment.findOne({ student: studentId, status: 'completed' })
    .sort({ updatedAt: -1 })
    .select('updatedAt');

  if (
    latestAssessment &&
    new Date(latestAssessment.updatedAt).getTime() > new Date(cached.generatedAt).getTime()
  ) {
    return null;
  }

  return cached;
}

/**
 * Builds the structured, anonymized prompt for the AI LLM provider.
 * Strictly excludes student names, emails, passwords, tokens, and raw question/answer text.
 */
function buildRecommendationPrompt({ profile, performance, preferredLanguage = 'en' }) {
  const isHinglish = preferredLanguage === 'hinglish';

  const languageInstructions = isHinglish
    ? `LANGUAGE REQUIREMENT:
The candidate prefers Hinglish (Hindi written in Roman/English script).
Write all 'reason', 'suggestedFocus', and 'action' fields in natural, supportive Roman-script Hinglish.
Example: "Aapka React me component lifecycle thoda weak hai. State aur props ke concepts pehle clear karein."`
    : `LANGUAGE REQUIREMENT:
Write all 'reason', 'suggestedFocus', and 'action' fields in professional, concise, encouraging technical English.`;

  return `You are CareerSaathi AI's Senior Technical Coach & Learning Path Architect.
Generate personalized learning recommendations for a student based strictly on their anonymized skill profile and assessment analytics.

Candidate Profile:
- Target Role: ${profile.targetRole || 'Full Stack Developer'}
- Declared Skill Level: ${profile.currentSkillLevel || 'beginner'}
- Declared Focus Skills: ${(profile.focusSkills || []).join(', ') || 'JavaScript, React, Node.js, MongoDB'}
- Preferred Language: ${preferredLanguage}

Performance Analytics:
- Overall GPA Percentage: ${performance.overallPercentage !== null ? performance.overallPercentage + '%' : 'No fully evaluated assessments yet'}
- Total Assessments Completed: ${performance.totalAssessmentsCompleted}
- Weak Topics (<60% accuracy): ${(performance.weakTopics || []).join(', ') || 'None identified'}
- Topic Breakdown:
${JSON.stringify(performance.topicBreakdown || [], null, 2)}

${languageInstructions}

CRITICAL RULES:
1. Permitted topics for 'recommendedTopics' and 'practiceAssessments.selectedTopics' are strictly limited to: "JavaScript", "React", "Node.js", "MongoDB".
2. Prioritize weak topics (<60% accuracy) as 'high' priority, unassessed focus skills as 'high' or 'medium', developing topics as 'medium', and strong topics as 'low'.
3. 'practiceAssessments' must contain 1 or 2 launch-ready assessment suggestions with difficulty set to 'easy', 'medium', or 'hard' calibrated to their skill level.
4. Output MUST be ONLY a valid, parseable JSON object matching the exact schema below without surrounding text or markdown formatting.

JSON Schema:
{
  "recommendedTopics": [
    {
      "topic": "<one of: JavaScript, React, Node.js, MongoDB>",
      "priority": "<high | medium | low>",
      "reason": "<data-driven explanation>",
      "suggestedFocus": "<specific core subtopic or concept>"
    }
  ],
  "nextActions": [
    {
      "action": "<concise actionable learning task>",
      "category": "<study | practice | revision>",
      "estimatedMinutes": <integer between 10 and 60>
    }
  ],
  "practiceAssessments": [
    {
      "targetRole": "${profile.targetRole || 'Full Stack Developer'}",
      "selectedTopics": ["<topic1>", "<topic2>"],
      "difficulty": "<easy | medium | hard>",
      "reason": "<why this assessment is recommended now>"
    }
  ]
}`;
}

/**
 * Validates AI JSON response strictly according to approved schema.
 * Rejects invalid topics, malformed structures, or unpermitted enum values.
 */
function validateAiRecommendationJson(rawJson) {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('AI recommendation response is not a valid JSON object');
  }

  const { recommendedTopics, nextActions, practiceAssessments } = rawJson;

  if (!Array.isArray(recommendedTopics) || recommendedTopics.length === 0) {
    throw new Error('recommendedTopics must be a non-empty array');
  }

  for (const item of recommendedTopics) {
    if (!item.topic || !SUPPORTED_TOPICS.includes(item.topic)) {
      throw new Error(`Invalid recommended topic: "${item.topic}". Supported: ${SUPPORTED_TOPICS.join(', ')}`);
    }
    if (!item.priority || !VALID_PRIORITIES.includes(item.priority)) {
      throw new Error(`Invalid topic priority: "${item.priority}". Must be high, medium, or low`);
    }
    if (!item.reason || typeof item.reason !== 'string' || !item.reason.trim()) {
      throw new Error('Topic recommendation reason is required and must be non-empty string');
    }
  }

  if (!Array.isArray(nextActions) || nextActions.length === 0) {
    throw new Error('nextActions must be a non-empty array');
  }

  for (const action of nextActions) {
    if (!action.action || typeof action.action !== 'string' || !action.action.trim()) {
      throw new Error('Action text is required and must be non-empty string');
    }
    if (action.category && !VALID_ACTION_CATEGORIES.includes(action.category)) {
      action.category = 'practice';
    }
    if (typeof action.estimatedMinutes !== 'number' || isNaN(action.estimatedMinutes)) {
      action.estimatedMinutes = 20;
    }
  }

  if (!Array.isArray(practiceAssessments) || practiceAssessments.length === 0) {
    throw new Error('practiceAssessments must be a non-empty array');
  }

  for (const pa of practiceAssessments) {
    if (!Array.isArray(pa.selectedTopics) || pa.selectedTopics.length === 0) {
      throw new Error('Practice assessment selectedTopics must be non-empty array');
    }
    const invalidTopics = pa.selectedTopics.filter((t) => !SUPPORTED_TOPICS.includes(t));
    if (invalidTopics.length > 0) {
      throw new Error(`Invalid practice assessment topic(s): ${invalidTopics.join(', ')}`);
    }
    if (!pa.difficulty || !VALID_DIFFICULTIES.includes(pa.difficulty)) {
      pa.difficulty = 'easy';
    }
    if (!pa.reason || typeof pa.reason !== 'string' || !pa.reason.trim()) {
      throw new Error('Practice assessment recommendation reason is required');
    }
  }

  return rawJson;
}

/**
 * Pure deterministic heuristic recommendation algorithm.
 * Guarantees 100% platform availability if external AI is offline or returns invalid output.
 */
function generateHeuristicRecommendations({ profile, performance, fallbackReason = null }) {
  const isHinglish = profile.preferredLanguage === 'hinglish';
  const targetRole = profile.targetRole || 'Full Stack Developer';
  const skillLevel = profile.currentSkillLevel || 'beginner';
  const focusSkills = (profile.focusSkills && profile.focusSkills.length > 0)
    ? profile.focusSkills.filter((s) => SUPPORTED_TOPICS.includes(s))
    : ['JavaScript', 'React'];

  const topicBreakdown = performance.topicBreakdown || [];
  const topicMap = new Map();
  topicBreakdown.forEach((t) => topicMap.set(t.topic, t));

  // Determine difficulty based on skill level and overall GPA
  let recommendedDifficulty = 'easy';
  const overallPct = performance.overallPercentage;

  if (skillLevel === 'advanced' && (overallPct === null || overallPct >= 75)) {
    recommendedDifficulty = 'hard';
  } else if (skillLevel === 'intermediate' || (overallPct !== null && overallPct >= 50 && overallPct < 75)) {
    recommendedDifficulty = 'medium';
  } else {
    recommendedDifficulty = 'easy';
  }

  const recommendedTopics = [];
  const nextActions = [];

  // Cold start check: 0 completed assessments
  if (performance.totalAssessmentsCompleted === 0) {
    const primaryTopic = focusSkills[0] || 'JavaScript';
    const secondaryTopic = focusSkills[1] || 'React';

    recommendedTopics.push({
      topic: primaryTopic,
      priority: 'high',
      reason: isHinglish
        ? `Aapne abhi tak koi test complete nahi kiya hai. Apni journey shuru karne ke liye ${primaryTopic} ka baseline test dein.`
        : `You haven't completed any assessments yet. Begin your learning journey with a foundational diagnostic in ${primaryTopic}.`,
      suggestedFocus: 'Fundamentals and core language mechanics',
    });

    if (secondaryTopic && secondaryTopic !== primaryTopic) {
      recommendedTopics.push({
        topic: secondaryTopic,
        priority: 'medium',
        reason: isHinglish
          ? `${targetRole} role ke liye ${secondaryTopic} ek important skill hai.`
          : `${secondaryTopic} is a core focus skill for your ${targetRole} target role.`,
        suggestedFocus: 'Core concepts and basic practical patterns',
      });
    }

    nextActions.push({
      action: isHinglish
        ? `${primaryTopic} ka ek short diagnostic assessment attempt karein.`
        : `Take an introductory ${primaryTopic} diagnostic assessment to benchmark your skills.`,
      category: 'practice',
      estimatedMinutes: 15,
    });

    nextActions.push({
      action: isHinglish
        ? `Apne career profile ke focus skills (${focusSkills.join(', ')}) ko review karein.`
        : `Review your target focus skills (${focusSkills.join(', ')}) in your profile.`,
      category: 'study',
      estimatedMinutes: 10,
    });

    const practiceAssessments = [
      {
        targetRole,
        selectedTopics: [primaryTopic],
        difficulty: recommendedDifficulty,
        reason: isHinglish
          ? `Introductory assessment jo aapki current understanding ko measure karega.`
          : `Introductory baseline assessment to benchmark your starting proficiency.`,
        launchConfig: {
          endpoint: '/api/assessments/generate',
          method: 'POST',
          body: {
            targetRole,
            selectedTopics: [primaryTopic],
            difficulty: recommendedDifficulty,
            questionCount: 5,
          },
        },
      },
    ];

    return {
      source: 'rule_based_fallback',
      modelUsed: null,
      fallbackReason,
      recommendedTopics,
      nextActions,
      practiceAssessments,
    };
  }

  // Active student: Rank topics by diagnostic health
  const weakList = [];
  const unassessedList = [];
  const developingList = [];
  const strongList = [];

  SUPPORTED_TOPICS.forEach((topic) => {
    const data = topicMap.get(topic);
    if (!data || data.status === 'unassessed') {
      if (focusSkills.includes(topic)) {
        unassessedList.push(topic);
      }
    } else if (data.status === 'weak' || (data.accuracyPercentage !== null && data.accuracyPercentage < 60)) {
      weakList.push({ topic, accuracy: data.accuracyPercentage });
    } else if (data.status === 'developing') {
      developingList.push({ topic, accuracy: data.accuracyPercentage });
    } else if (data.status === 'strong') {
      strongList.push({ topic, accuracy: data.accuracyPercentage });
    }
  });

  // 1. Weak topics (Priority High)
  weakList.forEach(({ topic, accuracy }) => {
    recommendedTopics.push({
      topic,
      priority: 'high',
      reason: isHinglish
        ? `${topic} me aapka accuracy ${accuracy !== null ? accuracy + '%' : '<60%'} hai, jo benchmark se kam hai.`
        : `Accuracy in ${topic} is currently ${accuracy !== null ? accuracy + '%' : '<60%'}, which is below target benchmark.`,
      suggestedFocus: 'Core principles, common edge cases, and debugging',
    });

    nextActions.push({
      action: isHinglish
        ? `${topic} ke fundamental concepts ko revise karein aur practice questions solve karein.`
        : `Review fundamental concepts in ${topic} and practice hands-on exercises.`,
      category: 'study',
      estimatedMinutes: 25,
    });
  });

  // 2. Unassessed focus skills (Priority High/Medium)
  unassessedList.forEach((topic) => {
    recommendedTopics.push({
      topic,
      priority: weakList.length === 0 ? 'high' : 'medium',
      reason: isHinglish
        ? `${topic} aapka focus skill hai lekin abhi tak assess nahi hua hai.`
        : `${topic} is in your target focus skills but has not yet been assessed.`,
      suggestedFocus: 'Introductory assessment and syntax fundamentals',
    });

    nextActions.push({
      action: isHinglish
        ? `${topic} ka ek baseline assessment lein taaki aapka skill benchmark ho sake.`
        : `Take a baseline assessment in ${topic} to benchmark your understanding.`,
      category: 'practice',
      estimatedMinutes: 20,
    });
  });

  // 3. Developing topics (Priority Medium)
  developingList.forEach(({ topic, accuracy }) => {
    if (recommendedTopics.length < 4) {
      recommendedTopics.push({
        topic,
        priority: 'medium',
        reason: isHinglish
          ? `${topic} me progress achi hai (${accuracy}%), thodi aur practice se mastery achieve ho jayegi.`
          : `Steady progress in ${topic} (${accuracy}%). A few targeted practice sessions will solidify mastery.`,
        suggestedFocus: 'Practical application, architectural patterns, and performance',
      });
    }
  });

  // 4. Strong topics (Priority Low - revision)
  strongList.forEach(({ topic, accuracy }) => {
    if (recommendedTopics.length < 4) {
      recommendedTopics.push({
        topic,
        priority: 'low',
        reason: isHinglish
          ? `${topic} me solid mastery hai (${accuracy}%). Periodic revision maintain karein.`
          : `Strong mastery established in ${topic} (${accuracy}%). Schedule periodic revision to stay sharp.`,
        suggestedFocus: 'Advanced patterns and complex system trade-offs',
      });
    }
  });

  // Fallback default if all arrays empty
  if (recommendedTopics.length === 0) {
    recommendedTopics.push({
      topic: 'JavaScript',
      priority: 'medium',
      reason: isHinglish
        ? 'JavaScript platform ka foundational pillar hai. Isko regularly revise karte rahein.'
        : 'JavaScript is a cornerstone skill for full-stack engineering. Maintain regular practice.',
      suggestedFocus: 'Asynchronous programming and modern ES features',
    });
  }

  if (nextActions.length === 0) {
    nextActions.push({
      action: isHinglish
        ? 'Apne target role ke mutabiq next topic ka assessment attempt karein.'
        : 'Take a practice assessment in your primary target role topic.',
      category: 'practice',
      estimatedMinutes: 20,
    });
  }

  // Build launch-ready practice assessment configurations
  const practiceTopics = [];
  if (weakList.length > 0) {
    practiceTopics.push(weakList[0].topic);
  } else if (unassessedList.length > 0) {
    practiceTopics.push(unassessedList[0]);
  } else if (developingList.length > 0) {
    practiceTopics.push(developingList[0].topic);
  } else {
    practiceTopics.push('JavaScript');
  }

  const practiceAssessments = [
    {
      targetRole,
      selectedTopics: practiceTopics,
      difficulty: recommendedDifficulty,
      reason: isHinglish
        ? `Aapke performance diagnostic ke basis pe ${practiceTopics.join(', ')} par targeted test.`
        : `Targeted practice assessment in ${practiceTopics.join(', ')} tailored to your current accuracy.`,
      launchConfig: {
        endpoint: '/api/assessments/generate',
        method: 'POST',
        body: {
          targetRole,
          selectedTopics: practiceTopics,
          difficulty: recommendedDifficulty,
          questionCount: 5,
        },
      },
    },
  ];

  return {
    source: 'rule_based_fallback',
    modelUsed: null,
    fallbackReason,
    recommendedTopics,
    nextActions,
    practiceAssessments,
  };
}

/**
 * Concurrency-safely persists student recommendations:
 * - Strictly fences every update with `generatedAt: { $lt: generationStartTime }`.
 * - Zero unconditional updates; lagging results never overwrite newer ones.
 * - Catches and resolves E11000 duplicate key conflicts on initial creation races.
 * - Safeguard: If prevailing document is missing after attempts, bounded recovery or controlled error.
 *
 * @param {ObjectId} studentId - Student user ID
 * @param {Object} recommendationData - Structured recommendation fields
 * @param {Date} generationStartTime - Exact timestamp when generation began
 * @returns {Promise<Object>} Persisted or prevailing Recommendation document
 */
async function persistRecommendation(studentId, recommendationData, generationStartTime) {
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour TTL

  // Maximum 3 attempts to resolve race conditions deterministically
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Step 1: Atomically fenced update matching ONLY older timestamp (NO upsert)
    const updated = await Recommendation.findOneAndUpdate(
      {
        student: studentId,
        generatedAt: { $lt: generationStartTime },
      },
      {
        $set: {
          ...recommendationData,
          generatedAt: generationStartTime,
          expiresAt,
        },
      },
      { returnDocument: 'after' }
    );

    if (updated) {
      return updated;
    }

    // Step 2: If update matched 0 documents, inspect existing record
    const existing = await Recommendation.findOne({ student: studentId });
    if (existing) {
      // If the document in DB has generatedAt >= generationStartTime,
      // a newer or concurrent generation already committed.
      // NEVER overwrite it. Safely discard our lagging result and return prevailing document.
      if (new Date(existing.generatedAt).getTime() >= new Date(generationStartTime).getTime()) {
        return existing;
      }
      // If existing.generatedAt is still < generationStartTime, retry Step 1 atomically fenced
      continue;
    }

    // Step 3: No document exists in DB; attempt atomic creation with E11000 catch
    try {
      return await Recommendation.create({
        student: studentId,
        ...recommendationData,
        generatedAt: generationStartTime,
        expiresAt,
      });
    } catch (err) {
      if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
        // Another concurrent request created the document first; loop back to check its timestamp
        continue;
      }
      throw err;
    }
  }

  // Step 4: Final prevailing document fetch guarantee
  const prevailing = await Recommendation.findOne({ student: studentId });
  if (prevailing) {
    return prevailing;
  }

  // Safeguard 1: Handle missing prevailing document explicitly (never return null)
  const error = new Error('Severe Concurrency Error: Unable to acquire or persist student recommendation document after bounded attempts.');
  error.statusCode = 500;
  throw error;
}

/**
 * Main recommendation generator for a student.
 * Gathers diagnostics, runs AI generation with heuristic fallback, and enforces caching/fencing.
 */
async function getOrGenerateRecommendations({
  studentId,
  forceRefresh = false,
  transportOverride = null,
}) {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    const error = new Error('Invalid student ID format');
    error.statusCode = 400;
    throw error;
  }

  const student = await User.findById(studentId).select(
    'name email role preferredLanguage careerProfile gamification updatedAt isActive'
  );

  if (!student) {
    const error = new Error('Student not found');
    error.statusCode = 404;
    throw error;
  }

  // Check cache first
  const cached = await getCachedRecommendation(student._id, student.updatedAt, forceRefresh);
  if (cached) {
    return {
      recommendation: cached,
      isCached: true,
    };
  }

  const generationStartTime = new Date();

  // Gather student performance diagnostics
  const [topicBreakdown, completedAssessments] = await Promise.all([
    aggregateStudentTopics(student._id),
    Assessment.find({ student: student._id, status: 'completed' }).select(
      'scoring weakTopics completedAt updatedAt'
    ),
  ]);

  const stats = calculateNormalizedAverages(completedAssessments);

  // Extract all weak topics from assessments and topics breakdown
  const weakTopicsSet = new Set();
  completedAssessments.forEach((a) => {
    if (Array.isArray(a.weakTopics)) {
      a.weakTopics.forEach((t) => t && weakTopicsSet.add(t));
    }
  });
  topicBreakdown.forEach((t) => {
    if (t.status === 'weak') {
      weakTopicsSet.add(t.topic);
    }
  });

  const profile = {
    targetRole: student.careerProfile?.targetRole || 'Full Stack Developer',
    currentSkillLevel: student.careerProfile?.currentSkillLevel || 'beginner',
    preferredLanguage: student.preferredLanguage || 'en',
    focusSkills: student.careerProfile?.focusSkills || ['JavaScript', 'React', 'Node.js', 'MongoDB'],
  };

  const performance = {
    overallPercentage: stats.averageOverallPercentage,
    totalAssessmentsCompleted: completedAssessments.length,
    weakTopics: Array.from(weakTopicsSet),
    topicBreakdown: topicBreakdown.map((t) => ({
      topic: t.topic,
      accuracyPercentage: t.accuracyPercentage,
      status: t.status,
      totalQuestionsAttempted: t.totalQuestionsAttempted,
    })),
  };

  let generatedData = null;

  // Attempt AI Generation
  try {
    const provider = getActiveProvider();
    const prompt = buildRecommendationPrompt({
      profile,
      performance,
      preferredLanguage: profile.preferredLanguage,
    });

    const rawResponse = await provider.generateContent({
      prompt,
      transportOverride,
    });

    let parsedJson;
    try {
      parsedJson = typeof rawResponse === 'object' && rawResponse !== null
        ? rawResponse
        : JSON.parse(rawResponse.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (parseErr) {
      throw new Error(`Failed to parse AI output as JSON: ${parseErr.message}`);
    }

    const validated = validateAiRecommendationJson(parsedJson);

    // Format practice assessments launch configs
    const practiceAssessmentsWithLaunch = validated.practiceAssessments.map((pa) => ({
      targetRole: pa.targetRole || profile.targetRole,
      selectedTopics: pa.selectedTopics,
      difficulty: pa.difficulty || 'easy',
      reason: pa.reason,
      launchConfig: {
        endpoint: '/api/assessments/generate',
        method: 'POST',
        body: {
          targetRole: pa.targetRole || profile.targetRole,
          selectedTopics: pa.selectedTopics,
          difficulty: pa.difficulty || 'easy',
          questionCount: 5,
        },
      },
    }));

    generatedData = {
      source: 'ai',
      modelUsed: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      fallbackReason: null,
      profileSnapshot: profile,
      performanceSnapshot: performance,
      recommendedTopics: validated.recommendedTopics,
      nextActions: validated.nextActions,
      practiceAssessments: practiceAssessmentsWithLaunch,
    };
  } catch (aiError) {
    // Graceful fallback to deterministic heuristic engine
    const heuristicResult = generateHeuristicRecommendations({
      profile,
      performance,
      fallbackReason: aiError.message,
    });

    generatedData = {
      source: 'rule_based_fallback',
      modelUsed: null,
      fallbackReason: aiError.message,
      profileSnapshot: profile,
      performanceSnapshot: performance,
      recommendedTopics: heuristicResult.recommendedTopics,
      nextActions: heuristicResult.nextActions,
      practiceAssessments: heuristicResult.practiceAssessments,
    };
  }

  // Atomically persist with timestamp fencing
  const persistedDoc = await persistRecommendation(student._id, generatedData, generationStartTime);

  return {
    recommendation: persistedDoc,
    isCached: false,
  };
}

module.exports = {
  getOrGenerateRecommendations,
  getCachedRecommendation,
  persistRecommendation,
  buildRecommendationPrompt,
  validateAiRecommendationJson,
  generateHeuristicRecommendations,
  SUPPORTED_TOPICS,
  VALID_DIFFICULTIES,
  VALID_PRIORITIES,
};
