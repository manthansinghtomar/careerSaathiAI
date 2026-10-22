/**
 * Provider-Independent Evaluation Service for CareerSaathi AI
 * Assembles rubric prompts, enforces strict schema validation (no silent clamping),
 * and computes exact mathematical scores for subjective answers.
 */

const { getActiveProvider } = require('./providerFactory');

const RUBRIC_WEIGHTS = {
  technicalCorrectness: 0.40,
  conceptualUnderstanding: 0.25,
  completeness: 0.15,
  reasoning: 0.10,
  answerRelevance: 0.10,
};

/**
 * Builds the structured evaluation prompt.
 */
const buildEvaluationPrompt = ({
  questionText,
  rubricReference,
  studentAnswer,
  preferredLanguage = 'en',
  topic = 'Technical',
}) => {
  const isHinglish = preferredLanguage === 'hinglish';

  const languageInstructions = isHinglish
    ? `IMPORTANT LANGUAGE REQUIREMENT:
The candidate's preferred language is Hinglish (Hindi written in Roman/English script).
Write all 'feedback', 'strengths', 'weaknesses', and 'suggestions' in conversational, natural Roman-script Hinglish.
Example: "Aapne closure ka concept ache se samjhaya, lekin outer function ke garbage collection aur memory cleanup ka point miss ho gaya. removeEventListener ka use karke isko aur behtar banaya ja sakta hai."`
    : `LANGUAGE REQUIREMENT:
Write all 'feedback', 'strengths', 'weaknesses', and 'suggestions' in professional, clear technical English.`;

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
 * Computes exact mathematical scores based on rubric breakdown and maxPoints.
 */
const computeScores = (rubricBreakdown, maxPoints = 1) => {
  const weightedScore =
    rubricBreakdown.technicalCorrectness * RUBRIC_WEIGHTS.technicalCorrectness +
    rubricBreakdown.conceptualUnderstanding * RUBRIC_WEIGHTS.conceptualUnderstanding +
    rubricBreakdown.completeness * RUBRIC_WEIGHTS.completeness +
    rubricBreakdown.reasoning * RUBRIC_WEIGHTS.reasoning +
    rubricBreakdown.answerRelevance * RUBRIC_WEIGHTS.answerRelevance;

  // Round to 2 decimal places: e.g. 8.45 / 10 -> 84.5%
  const percentage = Math.round((weightedScore / 10.0) * 10000) / 100;

  // Partial points earned: proportional to percentage (e.g. 0.65 on 1-point question)
  const pointsEarned = Math.round(((percentage / 100) * maxPoints) * 100) / 100;

  // Consistent boolean correctness policy: true if >= 70.0%
  const isCorrect = percentage >= 70.0;

  return {
    weightedScore: Math.round(weightedScore * 100) / 100,
    percentage,
    pointsEarned,
    isCorrect,
  };
};

/**
 * Evaluates a single technical answer using the configured LLM provider.
 */
const evaluateTextAnswer = async ({
  questionText,
  rubricReference,
  studentAnswer,
  preferredLanguage = 'en',
  topic = 'Technical',
  maxPoints = 1,
  transportOverride,
  providerOverride,
}) => {
  const provider = getActiveProvider(providerOverride);
  const prompt = buildEvaluationPrompt({
    questionText,
    rubricReference,
    studentAnswer,
    preferredLanguage,
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

  const { weightedScore, percentage, pointsEarned, isCorrect } = computeScores(
    parsed.rubricBreakdown,
    maxPoints
  );

  return {
    score: weightedScore,
    percentage,
    pointsEarned,
    isCorrect,
    rubricBreakdown: parsed.rubricBreakdown,
    feedback: parsed.feedback.trim(),
    strengths: parsed.strengths.map((s) => s.trim()),
    weaknesses: parsed.weaknesses.map((w) => w.trim()),
    suggestions: parsed.suggestions.map((s) => s.trim()),
    evaluatedLanguage: preferredLanguage === 'hinglish' ? 'hinglish' : 'en',
    modelUsed: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    evaluatedAt: new Date(),
  };
};

module.exports = {
  RUBRIC_WEIGHTS,
  buildEvaluationPrompt,
  validateRubricResponse,
  computeScores,
  evaluateTextAnswer,
};
