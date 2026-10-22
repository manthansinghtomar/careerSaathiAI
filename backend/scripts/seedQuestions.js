require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Question = require('../models/Question');
const User = require('../models/User');

const seedQuestions = async () => {
  try {
    await connectDB();

    // Look for an admin user to attribute question creation to
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    let creator = await User.findOne({ role: 'admin' });

    if (!creator) {
      console.log('No Admin user found. Looking for any system user...');
      creator = await User.findOne();
    }

    if (!creator) {
      console.error('Error: Please run seedAdmin.js or create at least one user before seeding questions.');
      await mongoose.disconnect();
      process.exit(1);
    }

    const defaultRole = 'Full Stack Developer';

    const sampleQuestions = [
      // ------------------------------------------------------------------
      // JAVASCRIPT (6 Questions: 2 Easy, 2 Medium, 2 Hard)
      // ------------------------------------------------------------------
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Variables & Scope',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'What will be the output of `typeof NaN` in JavaScript?',
            explanation: 'In JavaScript, `NaN` (Not-a-Number) is technically a numeric data type value, so `typeof NaN` evaluates to "number".',
          },
          hinglish: {
            question: 'JavaScript me `typeof NaN` ka output kya hoga?',
            explanation: 'JavaScript me `NaN` technically numeric type ka part hota hai, isliye iska typeof "number" return karta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'NaN', hinglish: 'NaN' } },
          { id: 'B', text: { en: 'number', hinglish: 'number' } },
          { id: 'C', text: { en: 'undefined', hinglish: 'undefined' } },
          { id: 'D', text: { en: 'object', hinglish: 'object' } },
        ],
        correctAnswer: 'B',
        tags: ['javascript', 'types', 'basics'],
      },
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Equality Operators',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'What is the primary difference between `==` and `===` in JavaScript?',
            explanation: '`==` performs type coercion before comparison, whereas `===` (strict equality) checks both value and type without coercion.',
          },
          hinglish: {
            question: 'JavaScript me `==` aur `===` ke beech main difference kya hai?',
            explanation: '`==` comparison se pehle type coercion karta hai jabki `===` value aur type dono check karta hai bina type badle.',
          },
        },
        options: [
          { id: 'A', text: { en: '`==` compares memory references only', hinglish: '`==` sirf memory reference check karta hai' } },
          { id: 'B', text: { en: '`===` allows type coercion, `==` does not', hinglish: '`===` type coercion karta hai aur `==` nahi' } },
          { id: 'C', text: { en: '`===` checks both value and type without type coercion', hinglish: '`===` bina type badle value aur type dono check karta hai' } },
          { id: 'D', text: { en: 'There is no difference in modern V8 engines', hinglish: 'Modern V8 engines me koi farak nahi hai' } },
        ],
        correctAnswer: 'C',
        tags: ['javascript', 'operators', 'equality'],
      },
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Event Loop & Concurrency',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'In the JavaScript Event Loop, which queue takes higher priority: the Microtask Queue or the Macrotask (Callback) Queue?',
            explanation: 'Microtasks (Promise callbacks, process.nextTick, queueMicrotask) are executed immediately after the current synchronous script runs and before any Macrotask (setTimeout, setInterval).',
          },
          hinglish: {
            question: 'JavaScript Event Loop me Microtask Queue aur Macrotask Queue me se kiski priority zyada hoti hai?',
            explanation: 'Microtask Queue (jaise Promise .then) ki priority hamesha Macrotasks (jaise setTimeout) se pehle hoti hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Macrotask Queue has higher priority', hinglish: 'Macrotask Queue ki priority zyada hoti hai' } },
          { id: 'B', text: { en: 'Microtask Queue has higher priority', hinglish: 'Microtask Queue ki priority zyada hoti hai' } },
          { id: 'C', text: { en: 'Both execute strictly in FIFO order regardless of type', hinglish: 'Dono bina kisi priority ke strict FIFO order me chalte hain' } },
          { id: 'D', text: { en: 'It depends on whether browser is run on multi-threading', hinglish: 'Yeh browser ke multi-threading mode pe depend karta hai' } },
        ],
        correctAnswer: 'B',
        tags: ['javascript', 'event-loop', 'async', 'promises'],
      },
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Closures & Lexical Scope',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'What is a closure in JavaScript?',
            explanation: 'A closure is a combination of a function bundled together with references to its lexical environment, allowing it to remember variables from outer scopes.',
          },
          hinglish: {
            question: 'JavaScript me Closure kya hota hai?',
            explanation: 'Closure ek aisa function hota hai jo apne outer scope ke variables ko access aur retain kar sakta hai, chahe outer function execute ho chuka ho.',
          },
        },
        options: [
          { id: 'A', text: { en: 'A syntax construct that closes open file streams automatically', hinglish: 'Ek construct jo open file stream ko close karta hai' } },
          { id: 'B', text: { en: 'A function that retains access to its lexical scope even when executed outside that scope', hinglish: 'Ek function jo apne outer lexical scope ke variables ko retain rakhta hai' } },
          { id: 'C', text: { en: 'A method to terminate infinite while loops', hinglish: 'Infinite loops ko terminate karne ka method' } },
          { id: 'D', text: { en: 'A way to make all global variables immutable', hinglish: 'Global variables ko immutable banane ka tareeqa' } },
        ],
        correctAnswer: 'B',
        tags: ['javascript', 'closures', 'scope'],
      },
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Prototypes & Inheritance',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'Explain how prototypical inheritance works in JavaScript. What happens when a property is accessed on an object that does not exist directly on that object?',
            explanation: 'JavaScript checks the object itself; if absent, it traverses up the [[Prototype]] chain (obj.__proto__) recursively until it finds the property or reaches `Object.prototype` (and finally `null`).',
          },
          hinglish: {
            question: 'JavaScript me Prototypical Inheritance kaise kaam karta hai? Agar kisi object par koi property na mile toh engine kya karta hai?',
            explanation: 'JS engine pehle us object par property dhundhta hai; agar nahi milti toh prototype chain (`__proto__`) ko traverse karta hai jab tak `Object.prototype` (null) tak na pahunch jaye.',
          },
        },
        options: [],
        correctAnswer: 'JavaScript inspects the object; if property is not found, it traverses the prototype chain ([[Prototype]]) recursively until found or reaching null.',
        tags: ['javascript', 'prototypes', 'inheritance', 'core-concepts'],
      },
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Memory Management',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'What causes memory leaks in client-side JavaScript applications, and how can uncleaned event listeners contribute to them?',
            explanation: 'Memory leaks occur when references to unused objects are retained in memory. Event listeners attached to DOM elements hold references in closures, preventing garbage collection if not removed with removeEventListener.',
          },
          hinglish: {
            question: 'Client-side JavaScript me Memory Leaks kyu hote hain, aur uncleaned event listeners isme kaise role play karte hain?',
            explanation: 'Memory leaks tab hote hain jab unused objects ka reference heap me bacha reh jata hai. Agar event listener ko cleanup na kiya jaye, toh DOM node aur closure variables garbage collect nahi ho pate.',
          },
        },
        options: [],
        correctAnswer: 'Retained references to unused objects prevent garbage collection; uncleared event listeners retain references to DOM elements and closure state.',
        tags: ['javascript', 'memory', 'performance', 'garbage-collection'],
      },

      // ------------------------------------------------------------------
      // REACT (6 Questions: 2 Easy, 2 Medium, 2 Hard)
      // ------------------------------------------------------------------
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'JSX & Component Basics',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'Why must React components return a single root element (or Fragment)?',
            explanation: 'Under the hood, JSX transforms into `React.createElement()` calls, which must return a single JavaScript object per function call.',
          },
          hinglish: {
            question: 'React component ko ek single root element (ya Fragment) kyu return karna padta hai?',
            explanation: 'Kyunki JSX internally `React.createElement` me compile hota hai, jo function call se ek single object hi return kar sakta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Because browsers cannot parse multiple div tags', hinglish: 'Kyunki browser multiple divs parse nahi kar sakta' } },
          { id: 'B', text: { en: 'Because JSX transpiles to a single function call returning one object', hinglish: 'Kyunki JSX ek single function call me transform hota hai jo ek object return karta hai' } },
          { id: 'C', text: { en: 'To enforce CSS grid layout', hinglish: 'CSS grid layout enforce karne ke liye' } },
          { id: 'D', text: { en: 'It is optional and no longer needed in any version', hinglish: 'Yeh optional hai aur kisi version me zaroori nahi hai' } },
        ],
        correctAnswer: 'B',
        tags: ['react', 'jsx', 'basics'],
      },
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'State & Props',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'Can a child component directly mutate the props it receives from its parent in React?',
            explanation: 'In React, props are strictly read-only (immutable) to maintain unidirectional data flow. Modifying props directly is prohibited.',
          },
          hinglish: {
            question: 'Kya React me child component apne parent se mili props ko directly mutate kar sakta hai?',
            explanation: 'React me props strictly read-only hoti hain unidirectional data flow maintain karne ke liye. Child unhe directly change nahi kar sakta.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Yes, props are fully mutable', hinglish: 'Haan, props mutable hoti hain' } },
          { id: 'B', text: { en: 'No, props are read-only and immutable', hinglish: 'Nahi, props strictly read-only hoti hain' } },
          { id: 'C', text: { en: 'Only if the parent is an arrow function', hinglish: 'Sirf tab agar parent arrow function ho' } },
          { id: 'D', text: { en: 'Only inside the constructor', hinglish: 'Sirf constructor ke andar' } },
        ],
        correctAnswer: 'B',
        tags: ['react', 'props', 'immutability'],
      },
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Hooks & useEffect',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'When does the cleanup function returned from a `useEffect` hook execute?',
            explanation: 'The cleanup function runs right before the component unmounts, and also before the effect re-runs when dependency values change.',
          },
          hinglish: {
            question: '`useEffect` hook se return hone wala cleanup function kab execute hota hai?',
            explanation: 'Cleanup function component unmount hone se pehle aur agle effect run hone se pehle (jab dependencies badalti hain) execute hota hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Only when the server reboots', hinglish: 'Sirf tab jab server reboot ho' } },
          { id: 'B', text: { en: 'Before the component unmounts and before effect re-runs', hinglish: 'Component unmount hone se pehle aur agle effect run se pehle' } },
          { id: 'C', text: { en: 'Immediately before the initial render completes', hinglish: 'Initial render complete hone se theek pehle' } },
          { id: 'D', text: { en: 'Never, unless explicitly triggered by window.unload', hinglish: 'Kabhi nahi, jab tak manually trigger na karein' } },
        ],
        correctAnswer: 'B',
        tags: ['react', 'hooks', 'useEffect', 'lifecycle'],
      },
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Memoization & Performance',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'What is the primary difference between `useMemo` and `useCallback`?',
            explanation: '`useMemo` caches the calculated result of a function, while `useCallback` caches the function definition itself between renders.',
          },
          hinglish: {
            question: '`useMemo` aur `useCallback` me mukhya antar kya hai?',
            explanation: '`useMemo` kisi function ki calculated return value ko memoize karta hai, jabki `useCallback` function instance ko memoize karta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: '`useMemo` caches values; `useCallback` caches function definitions', hinglish: '`useMemo` computed value ko cache karta hai; `useCallback` function instance ko' } },
          { id: 'B', text: { en: '`useCallback` works on class components only', hinglish: '`useCallback` sirf class components me chalta hai' } },
          { id: 'C', text: { en: '`useMemo` causes an asynchronous re-render cycle', hinglish: '`useMemo` asynchronous re-render trigger karta hai' } },
          { id: 'D', text: { en: 'They are completely identical aliases for the same hook', hinglish: 'Dono ek hi hook ke identical naam hain' } },
        ],
        correctAnswer: 'A',
        tags: ['react', 'performance', 'hooks', 'useMemo', 'useCallback'],
      },
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Reconciliation & Virtual DOM',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'How does React\'s Diffing / Reconciliation algorithm optimize DOM updates, and why is the `key` prop critical when rendering dynamic lists?',
            explanation: 'React compares new and previous Virtual DOM trees with an O(n) heuristic. Keys provide stable identities to list elements across renders so React can move, update, or remove items rather than destroying and recreating the entire DOM branch.',
          },
          hinglish: {
            question: 'React ka Diffing algorithm DOM updates ko kaise optimize karta hai, aur dynamic lists render karte waqt `key` prop kyu zaroori hai?',
            explanation: 'React Virtual DOM diffing O(n) time complexity me karta hai. `key` prop element ko unique identity deti hai taaki React samajh sake konsa item add, remove ya reorder hua hai bina puri list ko re-render kiye.',
          },
        },
        options: [],
        correctAnswer: 'Reconciliation uses heuristics (same type, keys) to diff Virtual DOM in O(n); keys give elements stable identity to detect reorders, additions, and deletions efficiently.',
        tags: ['react', 'virtual-dom', 'reconciliation', 'keys'],
      },
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Server Components & Architecture',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'What is the architectural difference between React Server Components (RSC) and standard Client Components in modern React?',
            explanation: 'RSC execute only on the server, have zero client bundle impact, and can access backend resources directly. Client Components execute in both server (SSR) and client, maintaining state, effects, and browser event listeners.',
          },
          hinglish: {
            question: 'Modern React me React Server Components (RSC) aur Client Components me kya architectural farak hai?',
            explanation: 'Server Components sirf server par execute hote hain aur client bundle me code nahi bhejte. Client Components browser me interactivity (useState, useEffect, onClick) provide karte hain.',
          },
        },
        options: [],
        correctAnswer: 'RSC render exclusively on the server with zero client bundle overhead and direct database access; Client Components ship JS to the browser for interactivity and state.',
        tags: ['react', 'rsc', 'nextjs', 'architecture'],
      },

      // ------------------------------------------------------------------
      // NODE.JS (6 Questions: 2 Easy, 2 Medium, 2 Hard)
      // ------------------------------------------------------------------
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Architecture & Threading',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'Is Node.js single-threaded or multi-threaded for JavaScript execution?',
            explanation: 'Node.js executes user JavaScript code on a single thread via the V8 engine, but utilizes libuv with a thread pool under the hood for asynchronous I/O operations.',
          },
          hinglish: {
            question: 'JavaScript execution ke liye Node.js single-threaded hai ya multi-threaded?',
            explanation: 'Node.js user code ko single thread me execute karta hai, par background I/O tasks ke liye libuv thread pool ka use karta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Multi-threaded for JavaScript execution', hinglish: 'JavaScript execution ke liye multi-threaded' } },
          { id: 'B', text: { en: 'Single-threaded event loop for JavaScript execution', hinglish: 'JavaScript execution ke liye single-threaded event loop' } },
          { id: 'C', text: { en: 'Depends on the operating system bit-architecture (32 vs 64)', hinglish: 'Operating system bit-architecture pe depend karta hai' } },
          { id: 'D', text: { en: 'Node.js does not use threads at all', hinglish: 'Node.js threads ka bilkul use nahi karta' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'event-loop', 'architecture'],
      },
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Modules & CommonJS',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'In CommonJS module format, how do you expose a function or object from a file?',
            explanation: 'In CommonJS, `module.exports` or `exports` is assigned the value or object you wish to make available when required.',
          },
          hinglish: {
            question: 'CommonJS module format me kisi file se function ya object ko kaise export kiya jata hai?',
            explanation: 'CommonJS me `module.exports` ya `exports` ka use karke value ko export kiya jata hai taaki doosri file use `require()` kar sake.',
          },
        },
        options: [
          { id: 'A', text: { en: '`export default myFunc;`', hinglish: '`export default myFunc;`' } },
          { id: 'B', text: { en: '`module.exports = myFunc;`', hinglish: '`module.exports = myFunc;`' } },
          { id: 'C', text: { en: '`return myFunc;`', hinglish: '`return myFunc;`' } },
          { id: 'D', text: { en: '`package.expose(myFunc);`', hinglish: '`package.expose(myFunc);`' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'commonjs', 'modules'],
      },
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Streams & Buffers',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'Why are Streams preferred over `fs.readFile` when serving large files (e.g. 2GB video) in Node.js?',
            explanation: '`fs.readFile` buffers the entire file into V8 memory at once, potentially causing memory exhaustion (heap out of memory), while Streams process data chunk-by-chunk.',
          },
          hinglish: {
            question: 'Node.js me large files (jaise 2GB video) read karne ke liye `fs.readFile` ke badle Streams kyu prefer kiye jaate hain?',
            explanation: '`fs.readFile` puri file ko memory me load kar deta hai jisse RAM crash ho sakti hai, jabki Streams chunk-by-chunk data process karte hain.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Streams encrypt data automatically with AES-256', hinglish: 'Streams data ko automatically encrypt kar dete hain' } },
          { id: 'B', text: { en: 'Streams read chunks sequentially without buffering entire file in memory', hinglish: 'Streams chunks me read karte hain bina puri file RAM me load kiye' } },
          { id: 'C', text: { en: 'Streams run synchronously and block thread for safety', hinglish: 'Streams synchronously chalte hain safety ke liye' } },
          { id: 'D', text: { en: 'fs.readFile cannot read files larger than 10MB by design', hinglish: 'fs.readFile 10MB se badi files read hi nahi kar sakta' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'streams', 'buffers', 'performance'],
      },
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Middleware & Express',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'In Express 5, what must an error-handling middleware function signature look like?',
            explanation: 'Express identifies error-handling middleware specifically by four arguments: `(err, req, res, next)`. Missing any argument causes Express to treat it as standard middleware.',
          },
          hinglish: {
            question: 'Express 5 me Error-handling middleware function ka signature kaisa hona chahiye?',
            explanation: 'Express error handler ko pehchanne ke liye exact 4 arguments dekhta hai: `(err, req, res, next)`.',
          },
        },
        options: [
          { id: 'A', text: { en: '`(req, res, next)`', hinglish: '`(req, res, next)`' } },
          { id: 'B', text: { en: '`(err, req, res, next)`', hinglish: '`(err, req, res, next)`' } },
          { id: 'C', text: { en: '`(err, res)`', hinglish: '`(err, res)`' } },
          { id: 'D', text: { en: '`(error, next)`', hinglish: '`(error, next)`' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'express', 'middleware', 'error-handling'],
      },
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'libuv & Thread Pool',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'Explain what libuv does in the Node.js architecture. Which operations are delegated to the libuv thread pool rather than the OS asynchronous mechanisms?',
            explanation: 'libuv abstracts asynchronous I/O across platforms. While network I/O utilizes non-blocking OS primitives (epoll/kqueue), file system I/O, DNS lookup (dns.lookup), and crypto/zlib operations are offloaded to the libuv thread pool (UV_THREADPOOL_SIZE).',
          },
          hinglish: {
            question: 'Node.js architecture me libuv ka kya role hai? Konsi operations libuv ke thread pool ko di jaati hain?',
            explanation: 'libuv cross-platform async I/O handle karta hai. Network sockets OS non-blocking primitives use karte hain, jabki File system operations, DNS lookups, aur crypto tasks libuv ke worker thread pool me run hote hain.',
          },
        },
        options: [],
        correctAnswer: 'libuv provides the event loop and thread pool; file system operations, dns.lookup, and CPU-intensive crypto/compression are offloaded to worker threads, while network I/O uses OS non-blocking notifications.',
        tags: ['nodejs', 'libuv', 'architecture', 'threads'],
      },
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Security & Race Conditions',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'How can asynchronous JavaScript in a Node.js server introduce race conditions even though execution is single-threaded?',
            explanation: 'Because asynchronous operations yield control back to the event loop at each `await` or callback boundary, multiple interleaved requests can read and mutate shared state (e.g. database records or in-memory variables) concurrently between execution ticks.',
          },
          hinglish: {
            question: 'Single-threaded hone ke bawajood Node.js server me async code race conditions kyu introduce kar sakta hai?',
            explanation: 'Kyunki har `await` ya callback boundary par event loop control doosre requests ko de deta hai, jisse multiple requests shared state ko interleave hokar read aur update kar sakte hain.',
          },
        },
        options: [],
        correctAnswer: 'At each await/callback boundary, the event loop can switch context to another request, leading to interleaved execution on shared state between check and write operations.',
        tags: ['nodejs', 'concurrency', 'race-conditions', 'security'],
      },

      // ------------------------------------------------------------------
      // MONGODB (6 Questions: 2 Easy, 2 Medium, 2 Hard)
      // ------------------------------------------------------------------
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Documents & Collections',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'What is the default unique primary key field automatically generated for every document in MongoDB?',
            explanation: 'MongoDB automatically generates a 12-byte BSON `_id` field (ObjectId) for every document if one is not explicitly specified.',
          },
          hinglish: {
            question: 'MongoDB me har document ke liye automatically banne wali default primary key field konsi hoti hai?',
            explanation: 'MongoDB har document me default roop se `_id` field (ObjectId) create karta hai jo uniquely document ko identify karta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: '`id`', hinglish: '`id`' } },
          { id: 'B', text: { en: '`_id`', hinglish: '`_id`' } },
          { id: 'C', text: { en: '`uuid`', hinglish: '`uuid`' } },
          { id: 'D', text: { en: '`primary_key`', hinglish: '`primary_key`' } },
        ],
        correctAnswer: 'B',
        tags: ['mongodb', 'bson', 'basics'],
      },
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'CRUD & Query Operators',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'Which MongoDB update operator is used to modify the value of a field without replacing the entire document?',
            explanation: 'The `$set` operator replaces the value of a field with the specified value, leaving other document fields intact.',
          },
          hinglish: {
            question: 'MongoDB me bina pura document replace kiye kisi specific field ki value update karne ke liye konsa operator use hota hai?',
            explanation: '`$set` operator ka use kisi specific field ko modify karne ke liye hota hai bina baaki fields ko touch kiye.',
          },
        },
        options: [
          { id: 'A', text: { en: '`$update`', hinglish: '`$update`' } },
          { id: 'B', text: { en: '`$set`', hinglish: '`$set`' } },
          { id: 'C', text: { en: '`$modify`', hinglish: '`$modify`' } },
          { id: 'D', text: { en: '`$put`', hinglish: '`$put`' } },
        ],
        correctAnswer: 'B',
        tags: ['mongodb', 'crud', 'operators'],
      },
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Indexes & Query Optimization',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'What is a "Covered Query" in MongoDB?',
            explanation: 'A covered query is a query that can be satisfied entirely using index keys without having to examine any documents in the collection (COLLSCAN/FETCH).',
          },
          hinglish: {
            question: 'MongoDB me "Covered Query" ka kya matlab hota hai?',
            explanation: 'Covered query wo hoti hai jisme query ke filter aur projected fields dono index me maujood hote hain, isliye database ko actual document fetch karne ki zaroorat nahi padti.',
          },
        },
        options: [
          { id: 'A', text: { en: 'A query that uses SSL encryption over the wire', hinglish: 'Aisi query jo SSL encryption use kare' } },
          { id: 'B', text: { en: 'A query fulfilled entirely from an index without inspecting collection documents', hinglish: 'Aisi query jo pura result index se hi de de bina document padhe' } },
          { id: 'C', text: { en: 'A query protected by database backup snapshots', hinglish: 'Aisi query jo backup snapshot se protected ho' } },
          { id: 'D', text: { en: 'A query executed inside a multi-document transaction', hinglish: 'Aisi query jo transaction ke andar chale' } },
        ],
        correctAnswer: 'B',
        tags: ['mongodb', 'indexes', 'performance'],
      },
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Aggregation Pipeline',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'In a MongoDB aggregation pipeline, which stage is equivalent to SQL\'s `JOIN` operation across collections?',
            explanation: 'The `$lookup` stage performs a left outer join to an unsharded collection in the same database to filter in documents from the "joined" collection.',
          },
          hinglish: {
            question: 'MongoDB aggregation pipeline me do collections ke beech SQL `JOIN` jaisa kaam karne ke liye konsa stage use hota hai?',
            explanation: '`$lookup` stage do collections ke beech left outer join perform karta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: '`$join`', hinglish: '`$join`' } },
          { id: 'B', text: { en: '`$lookup`', hinglish: '`$lookup`' } },
          { id: 'C', text: { en: '`$merge`', hinglish: '`$merge`' } },
          { id: 'D', text: { en: '`$project`', hinglish: '`$project`' } },
        ],
        correctAnswer: 'B',
        tags: ['mongodb', 'aggregation', 'lookup', 'joins'],
      },
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Data Modeling & Denormalization',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'Compare embedding documents versus referencing documents in MongoDB. In what scenarios is embedding preferred over referencing?',
            explanation: 'Embedding stores related data in a single document, providing atomic updates and fast single-query reads without joins. It is preferred for 1-to-1 or bounded 1-to-N relationships where data is frequently read together and does not exceed the 16MB document size limit.',
          },
          hinglish: {
            question: 'MongoDB me Embedding aur Referencing ke beech tulna karein. Embedding kab prefer ki jaati hai?',
            explanation: 'Embedding me related data ek hi document ke andar store hota hai, jisse fast read aur atomic updates milte hain. Yeh tab best hota hai jab data hamesha sath me access hota ho aur 16MB limit cross na kare.',
          },
        },
        options: [],
        correctAnswer: 'Embedding offers atomic updates and fast single-read queries without joins for 1-to-few bounded relationships; referencing is preferred for large/unbounded collections or frequently independent updates.',
        tags: ['mongodb', 'data-modeling', 'performance', 'architecture'],
      },
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Transactions & Concurrency',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'How do single-document atomicity and multi-document ACID transactions differ in MongoDB, and what is the write concern configuration?',
            explanation: 'In MongoDB, write operations on a single document are always atomic by default. Multi-document transactions provide full ACID guarantees across documents and collections using sessions. Write concern (e.g. w: majority) defines the level of acknowledgment requested from replica set members before confirming write success.',
          },
          hinglish: {
            question: 'MongoDB me single-document atomicity aur multi-document ACID transactions me kya farak hai, aur write concern kya hota hai?',
            explanation: 'Single document par koi bhi update always atomic hota hai. Multi-document transactions replica sets me multi-document consistency ensure karte hain. Write concern yeh specify karta hai ki kitne replica members write acknowledge karenge response bhejne se pehle.',
          },
        },
        options: [],
        correctAnswer: 'Single document writes are always atomic; multi-document transactions use sessions across replica sets for ACID consistency. Write concern configures acknowledgment quorum.',
        tags: ['mongodb', 'transactions', 'atomicity', 'concurrency'],
      },
    ];

    console.log(`Starting idempotent seed of ${sampleQuestions.length} core technical questions...`);

    let createdCount = 0;
    let existingCount = 0;

    for (const qData of sampleQuestions) {
      const existing = await Question.findOne({
        'content.en.question': qData.content.en.question,
      });

      if (existing) {
        existingCount++;
      } else {
        const question = new Question({
          ...qData,
          createdBy: creator._id,
          isActive: true,
        });
        await question.save();
        createdCount++;
      }
    }

    console.log(`\n=== Question Seeding Summary ===`);
    console.log(`Created: ${createdCount} new questions`);
    console.log(`Skipped (already exists): ${existingCount} questions`);
    console.log(`Total questions in database: ${await Question.countDocuments()}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed questions:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

seedQuestions();
