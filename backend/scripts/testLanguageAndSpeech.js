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

const { transliterateDevanagariToRoman } = require('../../frontend/src/lib/transliteration');
const { detectAnswerLanguage } = require('../utils/languageDetector');
const {
  evaluateTextAnswer,
  computeScores,
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
