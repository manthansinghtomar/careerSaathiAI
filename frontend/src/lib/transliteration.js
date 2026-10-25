/**
 * Devanagari to Roman Hinglish Transliteration Utility for CareerSaathi AI
 *
 * Converts Devanagari speech recognition transcripts into natural Roman-script Hinglish
 * while strictly preserving English technical terms, acronyms, and programming keywords.
 * Zero external dependencies.
 */

// Priority technical dictionary: Maps Devanagari transcriptions of technical terms
// back to their standard industry-accepted English representations.
const TECH_DICTIONARY = [
  // Frameworks, Libraries & Languages
  [/रिएक्ट(?:\s*जेएस)?/gi, 'React'],
  [/जावा\s*स्क्रिप्ट|जावास्क्रिप्ट/gi, 'JavaScript'],
  [/टाइप\s*स्क्रिप्ट|टाइपस्क्रिप्ट/gi, 'TypeScript'],
  [/पायथन/gi, 'Python'],
  [/नोड\s*जेएस/gi, 'Node.js'],
  [/नोड/gi, 'Node'],
  [/एक्सप्रेस(?:\s*जेएस)?/gi, 'Express'],
  [/मोंगो\s*डीबी|मोंगोडीबी/gi, 'MongoDB'],
  [/मोंगो/gi, 'Mongo'],
  [/रेडक्स/gi, 'Redux'],
  [/नेक्स्ट(?:\s*जेएस)?/gi, 'Next.js'],
  [/एचटीटीपीएस/gi, 'HTTPS'],
  [/एचटीटीपी/gi, 'HTTP'],
  [/एचटीएमएल/gi, 'HTML'],
  [/सीएसएस/gi, 'CSS'],
  [/जेएसएक्स/gi, 'JSX'],
  [/जेएसओएन|जेसन/gi, 'JSON'],
  [/एपीआईज़|एपीआईज|एपीआई/gi, 'API'],
  [/यूआई/gi, 'UI'],
  [/यूएक्स/gi, 'UX'],
  [/एसक्यूएल/gi, 'SQL'],
  [/नोएसक्यूएल/gi, 'NoSQL'],
  [/गिटहब/gi, 'GitHub'],
  [/गिट/gi, 'Git'],
  [/डॉकर/gi, 'Docker'],

  // Core Web & Programming Concepts
  [/वर्चुअल\s*डोम/gi, 'Virtual DOM'],
  [/डोम/gi, 'DOM'],
  [/कॉम्पोनेंट्स|कंपोनेंट्स/gi, 'components'],
  [/कॉम्पोनेंट|कंपोनेंट/gi, 'component'],
  [/फंक्शंस|फंक्शन/gi, 'function'],
  [/प्रॉप्स/gi, 'props'],
  [/प्रॉप/gi, 'prop'],
  [/स्टेट/gi, 'state'],
  [/हुक्स|हुक/gi, 'hooks'],
  [/डेटाबेस|डाटाबेस/gi, 'database'],
  [/डेटा|डाटा/gi, 'data'],
  [/लाइब्रेरी/gi, 'library'],
  [/फ्रेमवर्क/gi, 'framework'],
  [/सर्वर/gi, 'server'],
  [/क्लाइंट/gi, 'client'],
  [/बैकएंड/gi, 'backend'],
  [/फ्रंटएंड/gi, 'frontend'],
  [/कोडिंग|कोड/gi, 'code'],
  [/ऑब्जेक्ट्स|ऑब्जेक्ट/gi, 'object'],
  [/एरेज़|एरेज|एरे/gi, 'array'],
  [/स्ट्रिंग्स|स्ट्रिंग/gi, 'string'],
  [/बूलियन/gi, 'boolean'],
  [/प्रॉमिसेज|प्रॉमिस/gi, 'Promise'],
  [/असिंक/gi, 'async'],
  [/अवेट/gi, 'await'],
  [/री\s*रेंडरिंग|रीरेंडरिंग|रेंडरिंग/gi, 'rendering'],
  [/री\s*रेंडर|रीरेंडर|रेंडर/gi, 'render'],
  [/कॉलबैक/gi, 'callback'],
  [/वेरिएबल्स|वेरिएबल/gi, 'variable'],
  [/रिक्वेस्ट/gi, 'request'],
  [/रिस्पॉन्स/gi, 'response'],
  [/राउटर|राउटिंग/gi, 'router'],
  [/रूट/gi, 'route'],
  [/ब्राउज़र|ब्राउजर/gi, 'browser'],
  [/पेज/gi, 'page'],
  [/लूप/gi, 'loop'],
  [/एरर्स|एरर/gi, 'error'],
  [/टेस्टिंग|टेस्ट/gi, 'test'],
  [/यूज़|यूज/gi, 'use'],
  [/यूज़र|यूजर/gi, 'user'],
  [/इंटरफेस/gi, 'interface'],
  [/एप्लिकेशन/gi, 'application'],
  [/प्रोजेक्ट/gi, 'project'],
  [/इंडेक्स/gi, 'index'],
  [/पैकेज/gi, 'package'],
  [/मॉड्यूल/gi, 'module'],
  [/मेमोरी/gi, 'memory'],
  [/परफॉर्मेंस/gi, 'performance'],
  [/ऑप्टिमाइज़ेशन|ऑप्टिमाइजेशन/gi, 'optimization'],
  [/इवेंट्स|इवेंट/gi, 'event'],
  [/हैंडलर/gi, 'handler'],
  [/क्लोज़र|क्लोजर/gi, 'closure'],
  [/स्कोप/gi, 'scope'],
  [/मेथड/gi, 'method'],
];

// Common Conversational Hindi Words (Roman Transliteration Map)
const HINDI_WORD_MAP = {
  एक: 'ek',
  दो: 'do',
  तीन: 'teen',
  चार: 'chaar',
  पांच: 'paanch',
  है: 'hai',
  हैं: 'hain',
  था: 'tha',
  थी: 'thi',
  थे: 'the',
  होगी: 'hogi',
  होगा: 'hoga',
  होंगे: 'honge',
  जो: 'jo',
  के: 'ke',
  की: 'ki',
  का: 'ka',
  को: 'ko',
  से: 'se',
  में: 'mein',
  पर: 'par',
  पे: 'pe',
  लिए: 'liye',
  साथ: 'saath',
  और: 'aur',
  या: 'ya',
  लेकिन: 'lekin',
  मगर: 'magar',
  क्योंकि: 'kyunki',
  इसलिए: 'isliye',
  अगर: 'agar',
  तो: 'to',
  यह: 'yeh',
  वह: 'woh',
  ये: 'ye',
  वे: 've',
  इस: 'is',
  उस: 'us',
  इन: 'in',
  उन: 'un',
  आप: 'aap',
  हम: 'hum',
  तुम: 'tum',
  मेरा: 'mera',
  मेरी: 'meri',
  मेरे: 'mere',
  उसका: 'uska',
  उसकी: 'uski',
  उसके: 'uske',
  उनका: 'unka',
  उनकी: 'unki',
  उनके: 'unke',
  होता: 'hota',
  होते: 'hote',
  होती: 'hoti',
  होने: 'hone',
  होना: 'hona',
  करता: 'karta',
  करते: 'karte',
  करती: 'karti',
  करना: 'karna',
  करने: 'karne',
  किया: 'kiya',
  दिए: 'diye',
  दिया: 'diya',
  लिए: 'liye',
  सकता: 'sakta',
  सकते: 'sakte',
  सकती: 'sakti',
  सकें: 'sakein',
  बनाना: 'banana',
  बनाने: 'banane',
  बनाता: 'banata',
  बनाते: 'banate',
  बनाती: 'banati',
  बनाया: 'banaya',
  चाहिए: 'chahiye',
  रहा: 'raha',
  रहे: 'rahe',
  रही: 'rahi',
  गया: 'gaya',
  गए: 'gaye',
  गई: 'gayi',
  जाता: 'jaata',
  जाते: 'jaate',
  जाती: 'jaati',
  उपयोग: 'use',
  इस्तेमाल: 'use',
  मदद: 'help',
  काम: 'kaam',
  बहुत: 'bahut',
  अच्छा: 'achha',
  कम: 'kam',
  ज्यादा: 'jyada',
  अंदर: 'andar',
  बाहर: 'bahar',
  पहले: 'pehle',
  बाद: 'baad',
  जब: 'jab',
  तब: 'tab',
  कहाँ: 'kahan',
  यहाँ: 'yahan',
  वहाँ: 'wahan',
  कैसे: 'kaise',
  क्या: 'kya',
  क्यों: 'kyon',
  कुछ: 'kuch',
  सब: 'sab',
  सभी: 'sabhi',
};

// Character-by-character phonetic maps for general Devanagari text
const VOWELS = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
};

const MATRAS = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ॉ': 'o', 'ॅ': 'e',
};

const CONSONANTS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f',
};

const MODIFIERS = {
  'ं': 'n', 'ँ': 'n', 'ः': 'h',
};

/**
 * Phonetically transliterates a single Devanagari word into Roman script.
 * Applies conversational Hindi schwa-deletion at word endings and middle positions.
 */
function transliterateDevanagariWord(word) {
  if (!word) return '';

  // Check known conversational dictionary first
  const cleanWord = word.replace(/[.,!?;:]/g, '');
  if (HINDI_WORD_MAP[cleanWord]) {
    const punct = word.slice(cleanWord.length);
    return HINDI_WORD_MAP[cleanWord] + punct;
  }

  const chars = Array.from(word);
  let result = '';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    // Independent Vowel
    if (VOWELS[ch]) {
      result += VOWELS[ch];
      continue;
    }

    // Matra (vowel sign attached to previous consonant)
    if (MATRAS[ch]) {
      result += MATRAS[ch];
      continue;
    }

    // Modifiers (Anusvara, Chandrabindu, Visarga)
    if (MODIFIERS[ch]) {
      result += MODIFIERS[ch];
      continue;
    }

    // Halant (virama) - suppresses inherent 'a', already handled by looking ahead
    if (ch === '्') {
      continue;
    }

    // Consonant
    if (CONSONANTS[ch]) {
      const rom = CONSONANTS[ch];
      result += rom;

      // Inherent 'a' handling:
      // If next char is a matra, halant, or end of word in modern Hindi, omit 'a'
      if (!next) {
        // End of word: schwa is deleted (e.g., 'एक' -> 'ek', not 'eka')
        // Unless single letter word
        if (chars.length === 1) {
          result += 'a';
        }
      } else if (MATRAS[next] || next === '्' || MODIFIERS[next]) {
        // Vowel sign follows, no inherent 'a'
      } else if (CONSONANTS[next] || VOWELS[next]) {
        // Subsequent consonant: add inherent 'a' if not part of common compound suffix
        result += 'a';
      }
      continue;
    }

    // Any punctuation, number, or Latin character untouched
    result += ch;
  }

  // Smooth common double vowels or phonetic artifacts
  return result
    .replace(/aa+/g, 'aa')
    .replace(/ee+/g, 'ee')
    .replace(/oo+/g, 'oo');
}

/**
 * Transliterates Devanagari Hindi text to Roman Hinglish.
 * If the input contains no Devanagari characters, returns the input untouched.
 *
 * @param {string} text - Raw input text
 * @returns {string} - Romanized Hinglish text with technical terms preserved
 */
export function transliterateDevanagariToRoman(text) {
  if (!text || typeof text !== 'string') return '';

  // Check if string contains any Devanagari characters (\u0900 - \u097F)
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (!hasDevanagari) {
    // Pure English or Latin text: return 100% as-is
    return text;
  }

  let processed = text;

  // Step 1: Replace common technical terms from dictionary
  for (const [pattern, replacement] of TECH_DICTIONARY) {
    processed = processed.replace(pattern, replacement);
  }

  // Step 2: Transliterate remaining Devanagari words
  const tokens = processed.split(/(\s+)/);
  const transliteratedTokens = tokens.map((token) => {
    if (/[\u0900-\u097F]/.test(token)) {
      return transliterateDevanagariWord(token);
    }
    return token;
  });

  return transliteratedTokens.join('').replace(/।/g, '.');
}
