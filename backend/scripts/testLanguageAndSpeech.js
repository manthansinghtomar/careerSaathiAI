/**
 * CareerSaathi AI — Automated Verification Test Suite for Language & Speech Features
 *
 * Tests:
 * 1. Roman Hinglish Transliteration (Devanagari to Roman with technical term preservation)
 * 2. English Recognition Regression (Pure English untouched)
 * 3. Language Validation (English vs. Hinglish/Devanagari, Technical terms, Uncertain cases)
 * 4. Authoritative Scoring Penalties (Raw technical preservation, 15% deduction on mismatch)
 */

process.env.NODE_ENV = 'test';
require('dotenv').config();

const mongoose = require('mongoose');
const { transliterateDevanagariToRoman } = require('../../frontend/src/lib/transliteration');
const { detectAnswerLanguage } = require('../utils/languageDetector');
const Assessment = require('../models/Assessment');
const {
  evaluateTextAnswer,
  computeScores,
  RUBRIC_WEIGHTS,
  LANGUAGE_MISMATCH_PENALTY_PERCENTAGE,
} = require('../services/llm/evaluationService');

const testResults = [];
function recordTest(id, category, description, passed, details = '') {
  testResults.push({ id, category, description, passed, details });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${id}: ${description} ${details ? '(' + details + ')' : ''}`);
}

async function runTestSuite() {
  console.log('\n=== CareerSaathi AI — Language & Speech Transliteration Test Suite ===\n');

  // --- Category 1: Roman Hinglish Transliteration Tests ---
  console.log('--- Category 1: Roman Hinglish Transliteration ---');

  const hindiDevanagari1 = 'रिएक्ट एक जावास्क्रिप्ट लाइब्रेरी है जो यूआई बनाने के लिए यूज होती है।';
  const romanResult1 = transliterateDevanagariToRoman(hindiDevanagari1);
  const expectedKeywords1 = ['React', 'JavaScript', 'library', 'UI', 'banane', 'ke', 'liye', 'use', 'hoti', 'hai'];
  const allKeywordsPresent1 = expectedKeywords1.every((kw) =>
    romanResult1.toLowerCase().includes(kw.toLowerCase())
  );
  recordTest(
    'TC-TRANS-01',
    'Transliteration',
    'Converts Devanagari Hindi to Roman Hinglish with tech term preservation',
    allKeywordsPresent1,
    `Output: "${romanResult1}"`
  );

  const hindiDevanagari2 = 'स्टेट और प्रॉप्स कॉम्पोनेंट के अंदर डेटा पास करने के लिए इस्तेमाल होते हैं।';
  const romanResult2 = transliterateDevanagariToRoman(hindiDevanagari2);
  const hasTechPreserved2 =
    romanResult2.toLowerCase().includes('props') &&
    romanResult2.toLowerCase().includes('state') &&
    romanResult2.toLowerCase().includes('data');
  recordTest(
    'TC-TRANS-02',
    'Transliteration',
    'Preserves props, state, data, and component in Roman output',
    hasTechPreserved2,
    `Output: "${romanResult2}"`
  );

  // --- Category 2: English Regression Tests ---
  console.log('\n--- Category 2: English Recognition Regression ---');

  const englishInput1 = 'React is a component-based JavaScript library for building responsive user interfaces.';
  const transliteratedEnglish1 = transliterateDevanagariToRoman(englishInput1);
  recordTest(
    'TC-ENG-REG-01',
    'English Regression',
    'English text remains 100% unchanged through transliterator',
    transliteratedEnglish1 === englishInput1,
    `Untouched: ${transliteratedEnglish1 === englishInput1}`
  );

  const englishInput2 = 'The useEffect hook runs side effects after component mounting and state updates.';
  const transliteratedEnglish2 = transliterateDevanagariToRoman(englishInput2);
  recordTest(
    'TC-ENG-REG-02',
    'English Regression',
    'English text with programming hooks and keywords remains 100% unchanged',
    transliteratedEnglish2 === englishInput2,
    `Untouched: ${transliteratedEnglish2 === englishInput2}`
  );

  // --- Category 3: Language Detection Tests ---
  console.log('\n--- Category 3: Language Validation & False Positive Prevention ---');

  // Test 3.1: Clean English technical answer
  const cleanEnglish = 'React utilizes a virtual DOM to optimize rendering performance by reconciling changes.';
  const detectEnglish = detectAnswerLanguage(cleanEnglish, 'en');
  recordTest(
    'TC-LANG-01',
    'Language Detection',
    'Identifies clean English technical answer with match status',
    detectEnglish.status === 'match' && detectEnglish.detectedLanguage === 'en',
    `Status: ${detectEnglish.status}, Lang: ${detectEnglish.detectedLanguage}`
  );

  // Test 3.2: Technical terms alone do NOT trigger false positives
  const techTermsOnly = 'React virtual DOM component state props useState useEffect';
  const detectTech = detectAnswerLanguage(techTermsOnly, 'en');
  recordTest(
    'TC-LANG-02',
    'Language Detection',
    'Technical terms alone do not trigger language mismatch penalty',
    detectTech.status !== 'mismatch',
    `Status: ${detectTech.status} (Non-punitive)`
  );

  // Test 3.3: Confirmed Roman Hinglish mismatch in English mode
  const hinglishAnswer = 'React ek JavaScript library hai jo UI banane ke liye use hoti hai.';
  const detectHinglish = detectAnswerLanguage(hinglishAnswer, 'en');
  recordTest(
    'TC-LANG-03',
    'Language Detection',
    'Flags confirmed Roman Hinglish in English mode as mismatch',
    detectHinglish.status === 'mismatch' && detectHinglish.detectedLanguage === 'hinglish',
    `Status: ${detectHinglish.status}, Confidence: ${detectHinglish.confidence}`
  );

  // Test 3.4: Devanagari Hindi in English mode is flagged by language, not purely script
  const devanagariAnswer = 'रिएक्ट एक जावास्क्रिप्ट लाइब्रेरी है जो यूआई बनाने के लिए यूज होती है।';
  const detectDevanagari = detectAnswerLanguage(devanagariAnswer, 'en');
  recordTest(
    'TC-LANG-04',
    'Language Detection',
    'Flags Devanagari Hindi in English mode as mismatch',
    detectDevanagari.status === 'mismatch' && detectDevanagari.detectedLanguage === 'hinglish',
    `Status: ${detectDevanagari.status}, Lang: ${detectDevanagari.detectedLanguage}`
  );

  // Test 3.5: Hinglish mode accepts both Hinglish and English without mismatch
  const hinglishInHinglishMode = detectAnswerLanguage(hinglishAnswer, 'hinglish');
  const englishInHinglishMode = detectAnswerLanguage(cleanEnglish, 'hinglish');
  recordTest(
    'TC-LANG-05',
    'Language Detection',
    'Hinglish mode accepts both Hinglish and English without penalty',
    hinglishInHinglishMode.status === 'match' && englishInHinglishMode.status === 'match',
    `Hinglish status: ${hinglishInHinglishMode.status}, English status: ${englishInHinglishMode.status}`
  );

  // Test 3.6: Uncertain / very short input is not penalized
  const shortAnswer = 'OK done';
  const detectShort = detectAnswerLanguage(shortAnswer, 'en');
  recordTest(
    'TC-LANG-06',
    'Language Detection',
    'Brief / uncertain answer is marked uncertain and not penalized as mismatch',
    detectShort.status !== 'mismatch',
    `Status: ${detectShort.status}`
  );

  // --- Category 4: Evaluation Service & Authoritative Scoring Tests ---
  console.log('\n--- Category 4: Scoring Calculations & Penalty Application ---');

  const mockRubricJson = JSON.stringify({
    rubricBreakdown: {
      technicalCorrectness: 8.5,
      conceptualUnderstanding: 8.0,
      completeness: 8.0,
      reasoning: 8.0,
      answerRelevance: 9.0,
    },
    feedback: 'Solid explanation of React state mechanics.',
    strengths: ['Clear terminology', 'Good examples'],
    weaknesses: ['Could mention memory leak considerations'],
    suggestions: ['Explore useEffect dependency arrays in depth'],
  });

  const mockTransport = async () => mockRubricJson;

  // Test 4.1: English mode with English answer receives full score without deduction
  const evalResultEnglish = await evaluateTextAnswer({
    questionText: 'Explain how React state works.',
    rubricReference: 'State holds component-specific memory and triggers re-render.',
    studentAnswer: cleanEnglish,
    preferredLanguage: 'en',
    topic: 'React',
    maxPoints: 1,
    transportOverride: mockTransport,
  });

  recordTest(
    'TC-SCORE-01',
    'Scoring',
    'English answer in English mode retains 100% of raw percentage (no penalty)',
    evalResultEnglish.rawPercentage === evalResultEnglish.percentage &&
      evalResultEnglish.languagePenalty === 0 &&
      evalResultEnglish.languageMismatch === false,
    `Raw: ${evalResultEnglish.rawPercentage}%, Final: ${evalResultEnglish.percentage}%, Penalty: ${evalResultEnglish.languagePenalty}%`
  );

  // Test 4.2: English mode with Hinglish answer applies 15% penalty while preserving raw score
  const evalResultHinglish = await evaluateTextAnswer({
    questionText: 'Explain how React state works.',
    rubricReference: 'State holds component-specific memory and triggers re-render.',
    studentAnswer: hinglishAnswer,
    preferredLanguage: 'en',
    topic: 'React',
    maxPoints: 1,
    transportOverride: mockTransport,
  });

  const expectedRawPct = evalResultEnglish.rawPercentage; // 83.0%
  const expectedFinalPct = Math.max(0, expectedRawPct - LANGUAGE_MISMATCH_PENALTY_PERCENTAGE); // 83 - 15 = 68.0%

  recordTest(
    'TC-SCORE-02',
    'Scoring',
    'Confirmed language mismatch applies exactly 15% deduction while preserving rawScore',
    evalResultHinglish.rawPercentage === expectedRawPct &&
      evalResultHinglish.percentage === expectedFinalPct &&
      evalResultHinglish.languageMismatch === true &&
      evalResultHinglish.languagePenalty === 15,
    `Raw: ${evalResultHinglish.rawPercentage}%, Final: ${evalResultHinglish.percentage}%, Penalty: ${evalResultHinglish.languagePenalty}%`
  );

  // Test 4.3: Feedback includes explicit explanation of deduction
  const feedbackHasNotice =
    evalResultHinglish.feedback.includes('Language Adherence Deduction') &&
    evalResultHinglish.feedback.includes('15%');
  recordTest(
    'TC-SCORE-03',
    'Scoring',
    'Evaluation feedback clearly articulates deduction and raw vs adjusted score',
    feedbackHasNotice,
    `Feedback snippet: ${evalResultHinglish.feedback.slice(-150).replace(/\n/g, ' ')}`
  );

  // Test 4.4: Recalculates pointsEarned and isCorrect policy based on adjusted percentage
  // 68.0% < 70% threshold -> isCorrect becomes false
  recordTest(
    'TC-SCORE-04',
    'Scoring',
    'Recalculates pointsEarned and isCorrect based on adjusted score (68.0% -> false)',
    evalResultHinglish.pointsEarned === 0.68 && evalResultHinglish.isCorrect === false,
    `pointsEarned: ${evalResultHinglish.pointsEarned}, isCorrect: ${evalResultHinglish.isCorrect}`
  );

  // Test 4.5: Hinglish mode with Hinglish answer receives NO penalty
  const evalResultHinglishMode = await evaluateTextAnswer({
    questionText: 'Explain how React state works.',
    rubricReference: 'State holds component-specific memory and triggers re-render.',
    studentAnswer: hinglishAnswer,
    preferredLanguage: 'hinglish',
    topic: 'React',
    maxPoints: 1,
    transportOverride: mockTransport,
  });

  recordTest(
    'TC-SCORE-05',
    'Scoring',
    'Hinglish answer in Hinglish mode receives zero penalty',
    evalResultHinglishMode.languagePenalty === 0 &&
      evalResultHinglishMode.rawPercentage === evalResultHinglishMode.percentage &&
      evalResultHinglishMode.languageMismatch === false,
    `Penalty: ${evalResultHinglishMode.languagePenalty}%, Final: ${evalResultHinglishMode.percentage}%`
  );

  // --- Category 5: Three Language Modes Specification & Schema Integration Tests ---
  console.log('\n--- Category 5: Three Language Modes Specification & Schema Integration ---');

  // Test 5.1: English answer in English mode (using languageMode='english') receives zero penalty
  const evalModeEnglish = await evaluateTextAnswer({
    questionText: 'Explain how React state works.',
    rubricReference: 'State holds component-specific memory and triggers re-render.',
    studentAnswer: cleanEnglish,
    languageMode: 'english',
    topic: 'React',
    maxPoints: 1,
    transportOverride: mockTransport,
  });
  recordTest(
    'TC-MODE-01',
    'Language Modes',
    'English answer in English mode: zero penalty',
    evalModeEnglish.rawPercentage === evalModeEnglish.percentage &&
      evalModeEnglish.languagePenalty === 0 &&
      evalModeEnglish.languageMismatch === false &&
      evalModeEnglish.evaluatedLanguage === 'english',
    `Raw: ${evalModeEnglish.rawPercentage}%, Final: ${evalModeEnglish.percentage}%, Penalty: ${evalModeEnglish.languagePenalty}%`
  );

  // Test 5.2: Confirmed Hinglish answer in English mode receives exactly one 15% deduction
  const evalModeEnglishWithHinglish = await evaluateTextAnswer({
    questionText: 'Explain how React state works.',
    rubricReference: 'State holds component-specific memory and triggers re-render.',
    studentAnswer: hinglishAnswer,
    languageMode: 'english',
    topic: 'React',
    maxPoints: 1,
    transportOverride: mockTransport,
  });
  recordTest(
    'TC-MODE-02',
    'Language Modes',
    'Confirmed Hinglish answer in English mode: exactly one 15% deduction',
    evalModeEnglishWithHinglish.languageMismatch === true &&
      evalModeEnglishWithHinglish.languagePenalty === 15 &&
      evalModeEnglishWithHinglish.rawPercentage === 83 &&
      evalModeEnglishWithHinglish.percentage === 68,
    `Raw: ${evalModeEnglishWithHinglish.rawPercentage}%, Final: ${evalModeEnglishWithHinglish.percentage}%, Penalty: ${evalModeEnglishWithHinglish.languagePenalty}%`
  );

  // Test 5.3: Hinglish answer in Hinglish mode receives zero penalty
  const evalModeHinglishWithHinglish = await evaluateTextAnswer({
    questionText: 'Explain how React state works.',
    rubricReference: 'State holds component-specific memory and triggers re-render.',
    studentAnswer: hinglishAnswer,
    languageMode: 'hinglish',
    topic: 'React',
    maxPoints: 1,
    transportOverride: mockTransport,
  });
  recordTest(
    'TC-MODE-03',
    'Language Modes',
    'Hinglish answer in Hinglish mode: zero penalty',
    evalModeHinglishWithHinglish.languageMismatch === false &&
      evalModeHinglishWithHinglish.languagePenalty === 0 &&
      evalModeHinglishWithHinglish.rawPercentage === evalModeHinglishWithHinglish.percentage &&
      evalModeHinglishWithHinglish.evaluatedLanguage === 'hinglish',
    `Penalty: ${evalModeHinglishWithHinglish.languagePenalty}%, Final: ${evalModeHinglishWithHinglish.percentage}%`
  );

  // Test 5.4: English answer in Hinglish mode receives zero penalty
  const evalModeHinglishWithEnglish = await evaluateTextAnswer({
    questionText: 'Explain how React state works.',
    rubricReference: 'State holds component-specific memory and triggers re-render.',
    studentAnswer: cleanEnglish,
    languageMode: 'hinglish',
    topic: 'React',
    maxPoints: 1,
    transportOverride: mockTransport,
  });
  recordTest(
    'TC-MODE-04',
    'Language Modes',
    'English answer in Hinglish mode: zero penalty',
    evalModeHinglishWithEnglish.languageMismatch === false &&
      evalModeHinglishWithEnglish.languagePenalty === 0 &&
      evalModeHinglishWithEnglish.rawPercentage === evalModeHinglishWithEnglish.percentage,
    `Penalty: ${evalModeHinglishWithEnglish.languagePenalty}%, Final: ${evalModeHinglishWithEnglish.percentage}%`
  );

  // Test 5.5: English, Roman Hinglish, and Devanagari Hindi in Flexible mode: zero penalty
  const evalModeFlexibleEnglish = await evaluateTextAnswer({
    questionText: 'Explain how React state works.',
    rubricReference: 'State holds component-specific memory and triggers re-render.',
    studentAnswer: cleanEnglish,
    languageMode: 'flexible',
    topic: 'React',
    maxPoints: 1,
    transportOverride: mockTransport,
  });
  const evalModeFlexibleHinglish = await evaluateTextAnswer({
    questionText: 'Explain how React state works.',
    rubricReference: 'State holds component-specific memory and triggers re-render.',
    studentAnswer: hinglishAnswer,
    languageMode: 'flexible',
    topic: 'React',
    maxPoints: 1,
    transportOverride: mockTransport,
  });
  const evalModeFlexibleDevanagari = await evaluateTextAnswer({
    questionText: 'Explain how React state works.',
    rubricReference: 'State holds component-specific memory and triggers re-render.',
    studentAnswer: devanagariAnswer,
    languageMode: 'flexible',
    topic: 'React',
    maxPoints: 1,
    transportOverride: mockTransport,
  });

  const flexibleAllZeroPenalty =
    evalModeFlexibleEnglish.languagePenalty === 0 &&
    evalModeFlexibleEnglish.languageMismatch === false &&
    evalModeFlexibleHinglish.languagePenalty === 0 &&
    evalModeFlexibleHinglish.languageMismatch === false &&
    evalModeFlexibleDevanagari.languagePenalty === 0 &&
    evalModeFlexibleDevanagari.languageMismatch === false &&
    evalModeFlexibleEnglish.evaluatedLanguage === 'flexible';

  recordTest(
    'TC-MODE-05',
    'Language Modes',
    'English, Roman Hinglish, and Devanagari Hindi in Flexible mode: zero penalty',
    flexibleAllZeroPenalty,
    `EN Penalty: ${evalModeFlexibleEnglish.languagePenalty}%, Hinglish: ${evalModeFlexibleHinglish.languagePenalty}%, Devanagari: ${evalModeFlexibleDevanagari.languagePenalty}%`
  );

  // Test 5.6: Technical keywords alone do not trigger mismatch in any language mode
  const techDetectEnglish = detectAnswerLanguage(techTermsOnly, 'english');
  const techDetectHinglish = detectAnswerLanguage(techTermsOnly, 'hinglish');
  const techDetectFlexible = detectAnswerLanguage(techTermsOnly, 'flexible');
  recordTest(
    'TC-MODE-06',
    'Language Modes',
    'Technical keywords alone do not trigger mismatch in any mode',
    techDetectEnglish.status !== 'mismatch' &&
      techDetectHinglish.status !== 'mismatch' &&
      techDetectFlexible.status !== 'mismatch',
    `EN: ${techDetectEnglish.status}, Hinglish: ${techDetectHinglish.status}, Flexible: ${techDetectFlexible.status}`
  );

  // Test 5.7: Missing languageMode on legacy assessment defaults to English
  const legacyAssessmentDoc = new Assessment({
    student: new mongoose.Types.ObjectId(),
    targetRole: 'Full Stack Developer',
    selectedTopics: ['React'],
    totalQuestions: 1,
    questions: [
      {
        questionId: new mongoose.Types.ObjectId(),
        topic: 'React',
        difficulty: 'medium',
        type: 'text',
        content: { en: { question: 'Explain React state' } },
        correctAnswer: 'State holds component-specific memory',
      },
    ],
  });
  const safeLegacy = legacyAssessmentDoc.toSafeTakingJSON();
  recordTest(
    'TC-MODE-07',
    'Language Modes',
    'Missing languageMode on legacy assessment defaults to English and is included in toSafeTakingJSON()',
    legacyAssessmentDoc.languageMode === 'english' && safeLegacy.languageMode === 'english',
    `Doc languageMode: ${legacyAssessmentDoc.languageMode}, SafeTaking: ${safeLegacy.languageMode}`
  );

  // Test 5.8: Raw score remains unchanged after a penalty
  recordTest(
    'TC-MODE-08',
    'Language Modes',
    'Raw score remains unchanged after a penalty deduction',
    evalModeEnglishWithHinglish.rawScore === evalModeEnglish.rawScore &&
      evalModeEnglishWithHinglish.rawPercentage === evalModeEnglish.rawPercentage &&
      evalModeEnglishWithHinglish.percentage < evalModeEnglishWithHinglish.rawPercentage,
    `RawScore: ${evalModeEnglishWithHinglish.rawScore}, RawPct: ${evalModeEnglishWithHinglish.rawPercentage}%, AdjustedPct: ${evalModeEnglishWithHinglish.percentage}%`
  );

  // Test 5.9: Adjusted score and pointsEarned remain mathematically consistent
  const expectedPoints = Math.round(((evalModeEnglishWithHinglish.percentage / 100) * 1) * 100) / 100;
  recordTest(
    'TC-MODE-09',
    'Language Modes',
    'Adjusted score and pointsEarned remain mathematically consistent',
    evalModeEnglishWithHinglish.pointsEarned === expectedPoints &&
      evalModeEnglishWithHinglish.isCorrect === (evalModeEnglishWithHinglish.percentage >= 70.0),
    `pointsEarned: ${evalModeEnglishWithHinglish.pointsEarned}, expected: ${expectedPoints}, isCorrect: ${evalModeEnglishWithHinglish.isCorrect}`
  );

  // Test 5.10: Existing evaluation behavior and rubric weights remain unchanged
  const sumWeights = Object.values(RUBRIC_WEIGHTS).reduce((acc, w) => acc + w, 0);
  recordTest(
    'TC-MODE-10',
    'Language Modes',
    'Existing rubric dimension weights remain unchanged and sum strictly to 1.0 (100%)',
    Math.abs(sumWeights - 1.0) < 0.0001 &&
      RUBRIC_WEIGHTS.technicalCorrectness === 0.40 &&
      RUBRIC_WEIGHTS.conceptualUnderstanding === 0.25 &&
      RUBRIC_WEIGHTS.completeness === 0.15 &&
      RUBRIC_WEIGHTS.reasoning === 0.10 &&
      RUBRIC_WEIGHTS.answerRelevance === 0.10,
    `Sum: ${sumWeights}, TechnicalCorrectness weight: ${RUBRIC_WEIGHTS.technicalCorrectness}`
  );

  // Summary
  const passedCount = testResults.filter((r) => r.passed).length;
  const totalCount = testResults.length;
  console.log(`\n=== Test Summary: ${passedCount}/${totalCount} PASSED ===\n`);

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite execution failed:', err);
  process.exit(1);
});
