/**
 * Provider-Independent Evaluation Service for CareerSaathi AI
 * Assembles rubric prompts, enforces strict schema validation (no silent clamping),
 * and computes exact mathematical scores for subjective answers.
 */

const { getActiveProvider } = require('./providerFactory');
const { detectAnswerLanguage } = require('../../utils/languageDetector');

/**
 * Standard rubric dimension weights summing to 1.0 (100%)
 */
const RUBRIC_WEIGHTS = {
  technicalCorrectness: 0.40,
  conceptualUnderstanding: 0.25,
  completeness: 0.15,
  reasoning: 0.10,
  answerRelevance: 0.10,
};

/**
 * Configurable Language Adherence Penalty Policy
 * When English mode is selected and a confirmed Hindi/Hinglish mismatch is detected,
 * a documented deduction is applied to the overall percentage.
 * Raw technical scores are strictly preserved separately.
 */
const LANGUAGE_MISMATCH_PENALTY_PERCENTAGE = 15; // 15 percentage points deduction

/**
 * Builds the structured evaluation prompt.
 */
const buildEvaluationPrompt = ({
  questionText,
  rubricReference,
  studentAnswer,
  languageMode,
  preferredLanguage = 'english',
  topic = 'Technical',
}) => {
  const normMode = String(languageMode || preferredLanguage || 'english').toLowerCase().trim();
  const isHinglish = normMode === 'hinglish';
  const isFlexible = normMode === 'flexible';

  let languageInstructions;
  if (isHinglish) {
    languageInstructions = `IMPORTANT LANGUAGE REQUIREMENT:
The candidate's selected assessment mode is Hinglish (Hindi written in Roman/English script).
Accept answers written in conversational Roman-script Hinglish or English.
Evaluate strictly on engineering accuracy, factual understanding, and reasoning regardless of language style.
Write all 'feedback', 'strengths', 'weaknesses', and 'suggestions' in conversational, natural Roman-script Hinglish.
Example: "Aapne closure ka concept ache se samjhaya, lekin outer function ke garbage collection aur memory cleanup ka point miss ho gaya. removeEventListener ka use karke isko aur behtar banaya ja sakta hai."`;
  } else if (isFlexible) {
    languageInstructions = `IMPORTANT LANGUAGE REQUIREMENT:
The candidate's selected assessment mode is Flexible (Multilingual).
Accept answers in professional English, Roman-script Hinglish, or Devanagari Hindi.
Evaluate strictly on engineering accuracy, factual understanding, and reasoning regardless of language or script. Do NOT penalize or reduce scores for the candidate's language choice.
Write all 'feedback', 'strengths', 'weaknesses', and 'suggestions' in professional, clear technical English.`;
  } else {
    languageInstructions = `LANGUAGE REQUIREMENT:
The assessment mode expects technical English.
CRITICAL: Score the candidate's answer on the rubric dimensions (technicalCorrectness, conceptualUnderstanding, completeness, reasoning, answerRelevance) strictly based on factual and conceptual merit alone. Do not reduce rubric scores for language adherence here, as language adherence is evaluated separately by the system.
Write all 'feedback', 'strengths', 'weaknesses', and 'suggestions' in professional, clear technical English.`;
  }

  return `You are CareerSaathi AI's Senior Technical Interviewer evaluating a candidate for a Full Stack Developer role.
Assess the candidate's subjective technical answer strictly against the provided Technical Reference Rubric.

Topic: ${topic}
Question:
${questionText}

Technical Reference Rubric (Expected Key Concepts):
${rubricReference}

Candidate's Submitted Answer:
${studentAnswer || '(Candidate left the answer empty)'}

${languageInstructions}

Evaluation Rubric Dimensions (Score each dimension strictly from 0.0 to 10.0):
1. technicalCorrectness (Weight 40%): Factual accuracy, correct technical terminology, mechanisms, syntax.
2. conceptualUnderstanding (Weight 25%): Grasp of core engineering principles and fundamentals.
3. completeness (Weight 15%): Covered all aspects of the prompt, including edge cases.
4. reasoning (Weight 10%): Quality of justification, practical trade-offs, and logical structure.
5. answerRelevance (Weight 10%): Direct and concise response without fluff, evasiveness, or hallucinations.

CRITICAL INSTRUCTIONS:
- If the candidate's answer is completely empty, nonsensical, or irrelevant, assign 0.0 across all dimensions.
- You must return ONLY a valid, parseable JSON object matching the exact schema below without any surrounding text or markdown formatting.

JSON Schema:
{
  "rubricBreakdown": {
    "technicalCorrectness": <number between 0.0 and 10.0>,
    "conceptualUnderstanding": <number between 0.0 and 10.0>,
    "completeness": <number between 0.0 and 10.0>,
    "reasoning": <number between 0.0 and 10.0>,
    "answerRelevance": <number between 0.0 and 10.0>
  },
  "feedback": "<concise diagnostic summary>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "suggestions": ["<actionable improvement tip 1>", "<actionable improvement tip 2>"]
}`;
};

/**
 * Validates AI JSON response strictly according to the approved schema.
 * Rejects invalid scores and malformed structures without silent clamping.
 */
const validateRubricResponse = (rawJson) => {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('AI response is not a valid JSON object');
  }

  const { rubricBreakdown, feedback, strengths, weaknesses, suggestions } = rawJson;

  if (!rubricBreakdown || typeof rubricBreakdown !== 'object') {
    throw new Error('Missing or invalid rubricBreakdown object in AI response');
  }

  const requiredDimensions = [
    'technicalCorrectness',
    'conceptualUnderstanding',
    'completeness',
    'reasoning',
    'answerRelevance',
  ];

  for (const dim of requiredDimensions) {
    const val = rubricBreakdown[dim];
    if (typeof val !== 'number' || isNaN(val)) {
      throw new Error(`Rubric dimension "${dim}" must be a valid number`);
    }

    // Strict validation: Reject out-of-range scores (no silent clamping)
    if (val < 0.0 || val > 10.0) {
      throw new Error(
        `Rubric dimension "${dim}" value (${val}) is out of bounds [0.0 - 10.0]`
      );
    }
  }

  if (typeof feedback !== 'string' || !feedback.trim()) {
    throw new Error('Missing or invalid feedback string in AI response');
  }

  if (!Array.isArray(strengths) || strengths.some((s) => typeof s !== 'string' || !s.trim())) {
    throw new Error('strengths must be an array of non-empty strings');
  }

  if (!Array.isArray(weaknesses) || weaknesses.some((w) => typeof w !== 'string' || !w.trim())) {
    throw new Error('weaknesses must be an array of non-empty strings');
  }

  if (!Array.isArray(suggestions) || suggestions.some((s) => typeof s !== 'string' || !s.trim())) {
    throw new Error('suggestions must be an array of non-empty strings');
  }

  return true;
};

/**
 * Computes exact mathematical scores based on rubric breakdown, maxPoints, and optional penalty.
 */
const computeScores = (rubricBreakdown, maxPoints = 1, penaltyPercentage = 0) => {
  const weightedScore =
    rubricBreakdown.technicalCorrectness * RUBRIC_WEIGHTS.technicalCorrectness +
    rubricBreakdown.conceptualUnderstanding * RUBRIC_WEIGHTS.conceptualUnderstanding +
    rubricBreakdown.completeness * RUBRIC_WEIGHTS.completeness +
    rubricBreakdown.reasoning * RUBRIC_WEIGHTS.reasoning +
    rubricBreakdown.answerRelevance * RUBRIC_WEIGHTS.answerRelevance;

  // Round raw percentage to 2 decimal places: e.g. 8.45 / 10 -> 84.5%
  const rawPercentage = Math.round((weightedScore / 10.0) * 10000) / 100;

  // Adjusted percentage after penalty deduction (clamped at minimum 0)
  const percentage = Math.max(0, Math.round((rawPercentage - penaltyPercentage) * 100) / 100);

  // Partial points earned: proportional to final percentage
  const pointsEarned = Math.round(((percentage / 100) * maxPoints) * 100) / 100;

  // Consistent boolean correctness policy: true if final percentage >= 70.0%
  const isCorrect = percentage >= 70.0;

  return {
    weightedScore: Math.round(weightedScore * 100) / 100,
    rawPercentage,
    percentage,
    pointsEarned,
    isCorrect,
  };
};

/**
 * Evaluates a single technical answer using the configured LLM provider,
 * validates language adherence, and applies transparent scoring adjustments.
 */
const evaluateTextAnswer = async ({
  questionText,
  rubricReference,
  studentAnswer,
  languageMode,
  preferredLanguage = 'english',
  topic = 'Technical',
  maxPoints = 1,
  transportOverride,
  providerOverride,
}) => {
  const explicitLanguageMode = languageMode ? String(languageMode).toLowerCase().trim() : null;
  const legacyPref = preferredLanguage ? String(preferredLanguage).toLowerCase().trim() : 'english';
  const normMode = explicitLanguageMode || (legacyPref === 'en' ? 'en' : legacyPref);
  const activePromptMode = normMode === 'en' ? 'english' : normMode;
  const activeMode = activePromptMode;

  const provider = getActiveProvider(providerOverride);
  const prompt = buildEvaluationPrompt({
    questionText,
    rubricReference,
    studentAnswer,
    languageMode: activePromptMode,
    preferredLanguage: activePromptMode,
    topic,
  });

  const rawOutput = await provider.generateContent({
    prompt,
    transportOverride,
  });

  // Extract JSON payload safely from raw text (handles potential markdown wrapping)
  let parsed;
  try {
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in LLM output');
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    const err = new Error(`Failed to parse AI evaluation response as JSON: ${parseErr.message}`);
    err.statusCode = 502;
    throw err;
  }

  // Strict validation: Reject malformed or out-of-range AI output
  validateRubricResponse(parsed);

  // 1. Compute raw technical score
  const { weightedScore, rawPercentage } = computeScores(
    parsed.rubricBreakdown,
    maxPoints,
    0
  );

  // 2. Perform authoritative language validation
  const langResult = detectAnswerLanguage(studentAnswer, activeMode);

  let languagePenalty = 0;
  let languageMismatch = false;
  let languageWarning = null;
  let feedbackExplanation = '';

  if (activeMode === 'english' && langResult.status === 'mismatch') {
    // Confirmed mismatch: English mode selected, but answer was predominantly Hindi/Hinglish
    languageMismatch = true;
    languagePenalty = LANGUAGE_MISMATCH_PENALTY_PERCENTAGE;
    languageWarning =
      'Selected assessment mode requires English, but this answer was identified as Hindi/Hinglish.';
    feedbackExplanation = `\n\n[Language Adherence Deduction]: Selected mode requires English, but this answer was identified as Hindi/Hinglish. A ${languagePenalty}% language deduction was applied (Raw technical score: ${rawPercentage}% → Adjusted score: ${Math.max(0, rawPercentage - languagePenalty)}%).`;
  } else if (activeMode === 'english' && langResult.status === 'uncertain' && langResult.details?.hindiMarkers > 0) {
    // Uncertain detection: Non-punitive warning without marks deduction
    languageWarning =
      'Language adherence could not be definitively confirmed. No score deduction was applied.';
    feedbackExplanation =
      '\n\n[Language Note]: Language adherence was uncertain. Technical score was preserved without deduction.';
  }

  // 3. Compute final scores incorporating language penalty
  const { percentage, pointsEarned, isCorrect } = computeScores(
    parsed.rubricBreakdown,
    maxPoints,
    languagePenalty
  );

  return {
    score: weightedScore,
    rawScore: weightedScore,
    percentage,
    rawPercentage,
    pointsEarned,
    isCorrect,
    rubricBreakdown: parsed.rubricBreakdown,
    feedback: `${parsed.feedback.trim()}${feedbackExplanation}`,
    strengths: parsed.strengths.map((s) => s.trim()),
    weaknesses: parsed.weaknesses.map((w) => w.trim()),
    suggestions: parsed.suggestions.map((s) => s.trim()),
    languageMismatch,
    languagePenalty,
    detectedLanguage: langResult.detectedLanguage,
    languageWarning,
    evaluatedLanguage: explicitLanguageMode || (legacyPref === 'en' ? 'en' : activePromptMode),
    modelUsed: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    evaluatedAt: new Date(),
  };
};

module.exports = {
  RUBRIC_WEIGHTS,
  LANGUAGE_MISMATCH_PENALTY_PERCENTAGE,
  buildEvaluationPrompt,
  validateRubricResponse,
  computeScores,
  evaluateTextAnswer,
};

