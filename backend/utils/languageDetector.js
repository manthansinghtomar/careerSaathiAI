/**
 * Deterministic Language Validation Utility for CareerSaathi AI
 *
 * Distinguishes English technical answers from Hindi/Hinglish (both Roman script
 * and Devanagari script) based on grammatical function markers and auxiliary verbs.
 * Excludes technical terms, programming keywords, and acronyms from language evaluation
 * to avoid false positives. Zero external dependencies.
 */

// Common English functional and grammatical markers
const ENGLISH_GRAMMAR_MARKERS = new Set([
  'the', 'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'this', 'that', 'these', 'those', 'which', 'what', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
  'with', 'at', 'from', 'into', 'during', 'including', 'until', 'against', 'among', 'throughout',
  'to', 'in', 'for', 'on', 'by', 'about', 'like', 'through', 'over', 'before', 'between', 'after',
  'since', 'without', 'under', 'within', 'along', 'across', 'behind', 'beyond',
  'and', 'or', 'because', 'although', 'though', 'while', 'if', 'unless', 'so', 'than', 'as',
  'it', 'its', 'they', 'their', 'them', 'we', 'our', 'us', 'you', 'your', 'yours', 'i', 'my', 'me',
  'he', 'she', 'him', 'her', 'his', 'an', 'a',
]);

// Common Hindi/Hinglish grammatical markers and auxiliary verbs (Roman script)
const HINGLISH_ROMAN_MARKERS = new Set([
  'hai', 'hain', 'tha', 'the', 'thi', 'hoga', 'hogi', 'honge', 'raha', 'rahe', 'rahi', 'hua', 'hue', 'hui',
  'karta', 'karte', 'karti', 'karna', 'karne', 'kiya', 'karega', 'hota', 'hote', 'hoti', 'hone',
  'sakta', 'sakte', 'sakti', 'sakein', 'chahiye', 'banata', 'banate', 'banane', 'banaya',
  'aap', 'hum', 'mera', 'meri', 'mere', 'iska', 'iski', 'iske', 'uska', 'uski', 'uske', 'unka', 'unki', 'unke',
  'yeh', 'woh', 'ye', 'isme', 'usme', 'jisme', 'jismein',
  'ke', 'ki', 'ka', 'ko', 'se', 'mein', 'me', 'par', 'pe', 'liye', 'saath',
  'aur', 'ya', 'lekin', 'magar', 'kyunki', 'kyuki', 'isliye', 'jab', 'tab', 'agar', 'to',
  'ek', 'kuch', 'bahut', 'jyada', 'kam', 'pehle', 'baad', 'kaise', 'kya',
]);

// Hindi grammatical markers in Devanagari script (ensures script-independent validation)
const HINDI_DEVANAGARI_MARKERS = new Set([
  'है', 'हैं', 'था', 'थे', 'थी', 'होगा', 'होगी', 'होंगे', 'रहा', 'रहे', 'रही', 'हुआ', 'हुए', 'हुई',
  'करता', 'करते', 'करती', 'करना', 'करने', 'किया', 'होता', 'होते', 'होती', 'होने',
  'सकता', 'सकते', 'सकती', 'चाहिए', 'बनाता', 'बनाते', 'बनाने', 'बनाया',
  'आप', 'हम', 'मेरा', 'मेरी', 'मेरे', 'इसका', 'इसकी', 'इसके', 'उसका', 'उसकी', 'उसके',
  'यह', 'वह', 'ये', 'इसमें', 'उसमें', 'जिसमें',
  'के', 'की', 'का', 'को', 'से', 'में', 'पर', 'पे', 'लिए', 'साथ',
  'और', 'या', 'लेकिन', 'मगर', 'क्योंकि', 'इसलिए', 'अगर', 'तो',
  'एक', 'कुछ', 'बहुत', 'कम', 'ज्यादा', 'पहले', 'बाद', 'कैसे', 'क्या',
]);

// Technical keywords and jargon to ignore from language ratio calculation
const TECHNICAL_TERMS = new Set([
  'react', 'javascript', 'typescript', 'python', 'node', 'express', 'mongodb', 'sql', 'nosql',
  'html', 'css', 'dom', 'virtual', 'api', 'apis', 'rest', 'json', 'http', 'https',
  'state', 'props', 'hook', 'hooks', 'usestate', 'useeffect', 'usememo', 'usecallback',
  'component', 'components', 'function', 'functions', 'class', 'classes', 'method', 'methods',
  'variable', 'variables', 'array', 'arrays', 'object', 'objects', 'string', 'boolean', 'number',
  'promise', 'async', 'await', 'callback', 'render', 'rendering', 'rerender', 're-render',
  'closure', 'scope', 'database', 'server', 'client', 'frontend', 'backend', 'fullstack',
  'router', 'route', 'routes', 'middleware', 'jwt', 'auth', 'token', 'schema', 'model',
  'package', 'npm', 'yarn', 'git', 'github', 'docker', 'redux', 'nextjs', 'vite',
  'ui', 'ux', 'performance', 'optimization', 'event', 'handler', 'listener', 'memory',
]);

/**
 * Detects whether an answer adheres to the expected assessment language.
 *
 * @param {string} text - Candidate's written or spoken answer
 * @param {string} [expectedLanguage='en'] - 'en' | 'hinglish'
 * @returns {Object} {
 *   detectedLanguage: 'en' | 'hinglish' | 'unknown',
 *   status: 'match' | 'mismatch' | 'uncertain',
 *   confidence: number,
 *   details: { englishMarkers: number, hindiMarkers: number, totalWords: number },
 *   warningMessage?: string
 * }
 */
function detectAnswerLanguage(text, expectedLanguage = 'en') {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      detectedLanguage: 'unknown',
      status: 'uncertain',
      confidence: 0,
      details: { englishMarkers: 0, hindiMarkers: 0, totalWords: 0 },
      warningMessage: null,
    };
  }

  // Tokenize words, stripping punctuation
  const cleanTokens = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'।]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (cleanTokens.length === 0) {
    return {
      detectedLanguage: 'unknown',
      status: 'uncertain',
      confidence: 0,
      details: { englishMarkers: 0, hindiMarkers: 0, totalWords: 0 },
      warningMessage: null,
    };
  }

  let englishMarkersCount = 0;
  let hindiMarkersCount = 0;
  let technicalTermsCount = 0;

  for (const token of cleanTokens) {
    if (TECHNICAL_TERMS.has(token)) {
      technicalTermsCount++;
      continue;
    }

    if (HINDI_DEVANAGARI_MARKERS.has(token) || HINGLISH_ROMAN_MARKERS.has(token)) {
      hindiMarkersCount++;
    } else if (ENGLISH_GRAMMAR_MARKERS.has(token)) {
      englishMarkersCount++;
    }
  }

  const details = {
    englishMarkers: englishMarkersCount,
    hindiMarkers: hindiMarkersCount,
    technicalTerms: technicalTermsCount,
    totalWords: cleanTokens.length,
  };

  const normExpected = String(expectedLanguage || 'english').toLowerCase().trim();
  const isHinglish = normExpected === 'hinglish';
  const isFlexible = normExpected === 'flexible';

  // If candidate is in Flexible mode:
  // English, Roman Hinglish, and Devanagari Hindi answers are all accepted with zero penalty.
  if (isFlexible) {
    return {
      detectedLanguage: hindiMarkersCount > 0 ? 'hinglish' : 'en',
      status: 'match',
      confidence: 1.0,
      details,
      warningMessage: null,
    };
  }

  // If candidate is in Hinglish mode:
  // In Hinglish mode, Hindi, Hinglish, and English technical terms are all accepted with zero penalty.
  if (isHinglish) {
    return {
      detectedLanguage: hindiMarkersCount > 0 ? 'hinglish' : 'en',
      status: 'match',
      confidence: 1.0,
      details,
      warningMessage: null,
    };
  }

  // If candidate is in English mode (or legacy 'en'):
  // Evaluate if there is a genuine language mismatch (predominantly Hindi/Hinglish).

  // Case 1: Pure technical vocabulary or very short snippet without enough grammatical glue
  if (hindiMarkersCount === 0 && englishMarkersCount === 0) {
    return {
      detectedLanguage: 'en',
      status: 'uncertain',
      confidence: 0.5,
      details,
      warningMessage: null,
    };
  }

  // Case 2: Pure English or predominantly English grammar
  if (hindiMarkersCount === 0 && englishMarkersCount > 0) {
    return {
      detectedLanguage: 'en',
      status: 'match',
      confidence: 1.0,
      details,
      warningMessage: null,
    };
  }

  // Case 3: Confirmed Hindi / Hinglish mismatch
  // Requires at least 2 distinct Hindi markers AND Hindi markers exceed English markers by at least 1.5x
  if (hindiMarkersCount >= 2 && hindiMarkersCount >= englishMarkersCount * 1.5) {
    const totalMarkers = hindiMarkersCount + englishMarkersCount;
    const confidence = totalMarkers > 0 ? Math.min(1.0, hindiMarkersCount / totalMarkers) : 0.8;

    return {
      detectedLanguage: 'hinglish',
      status: 'mismatch',
      confidence: Math.round(confidence * 100) / 100,
      details,
      warningMessage:
        'Selected assessment mode requires English, but this answer appears to be in Hindi/Hinglish. Please write or speak your answer in English to avoid a scoring deduction.',
    };
  }

  // Case 4: Predominantly English with an occasional borrowed word
  if (englishMarkersCount > hindiMarkersCount * 1.5) {
    return {
      detectedLanguage: 'en',
      status: 'match',
      confidence: 0.85,
      details,
      warningMessage: null,
    };
  }

  // Case 5: Ambiguous or balanced mix - do not penalize uncertain cases!
  return {
    detectedLanguage: 'unknown',
    status: 'uncertain',
    confidence: 0.5,
    details,
    warningMessage:
      'Language adherence could not be definitively determined. No scoring deduction will be applied.',
  };
}

module.exports = {
  detectAnswerLanguage,
  ENGLISH_GRAMMAR_MARKERS,
  HINGLISH_ROMAN_MARKERS,
  HINDI_DEVANAGARI_MARKERS,
  TECHNICAL_TERMS,
};
