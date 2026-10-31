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
      // ==================================================================
      // JAVASCRIPT (15 Questions: 5 Easy, 5 Medium, 5 Hard)
      // ==================================================================
      // Existing 1: Easy MCQ
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
      // Existing 2: Easy MCQ
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
      // New 3: Easy MCQ
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Primitives & Types',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'Which of the following is NOT a primitive data type in JavaScript?',
            explanation: 'In JavaScript, primitive types are string, number, bigint, boolean, undefined, symbol, and null. Object (including arrays and functions) is a non-primitive reference type.',
          },
          hinglish: {
            question: 'JavaScript me inme se konsa ek primitive data type NAHI hai?',
            explanation: 'JavaScript me Object ek non-primitive reference type hota hai, jabki Symbol, Boolean aur BigInt primitive types hain.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Symbol', hinglish: 'Symbol' } },
          { id: 'B', text: { en: 'Boolean', hinglish: 'Boolean' } },
          { id: 'C', text: { en: 'Object', hinglish: 'Object' } },
          { id: 'D', text: { en: 'BigInt', hinglish: 'BigInt' } },
        ],
        correctAnswer: 'C',
        tags: ['javascript', 'primitives', 'types'],
      },
      // New 4: Easy Text
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Variables & Hoisting',
        difficulty: 'easy',
        type: 'text',
        content: {
          en: {
            question: 'Explain the difference between `var`, `let`, and `const` in JavaScript regarding scope and hoisting.',
            explanation: '`var` is function-scoped and hoisted with an initial value of undefined. `let` and `const` are block-scoped and hoisted into the Temporal Dead Zone (TDZ) where accessing them before declaration throws a ReferenceError. `const` also forbids reassignment.',
          },
          hinglish: {
            question: 'JavaScript me `var`, `let`, aur `const` ke beech scope aur hoisting ke sandarbh me kya farak hai samjhayein.',
            explanation: '`var` function-scoped hota hai aur undefined ke sath hoist hota hai. `let` aur `const` block-scoped hote hain aur declaration se pehle TDZ me rehte hain. `const` ki value reassign nahi ho sakti.',
          },
        },
        options: [],
        correctAnswer: 'var is function-scoped and hoisted initialized to undefined; let and const are block-scoped and hoisted into Temporal Dead Zone (TDZ); const references cannot be reassigned.',
        tags: ['javascript', 'variables', 'hoisting', 'scope'],
      },
      // New 5: Easy Text
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Functions & Binding',
        difficulty: 'easy',
        type: 'text',
        content: {
          en: {
            question: 'What is the difference between a traditional function declaration and an arrow function in JavaScript regarding `this` binding?',
            explanation: 'Traditional functions bind `this` dynamically based on how the function is invoked (or via call/apply/bind). Arrow functions do not have their own `this`; they lexically inherit `this` from the enclosing execution context.',
          },
          hinglish: {
            question: 'JavaScript me traditional function aur arrow function ke beech `this` keyword binding ko lekar kya antar hota hai?',
            explanation: 'Traditional function me `this` runtime invocation context par depend karta hai. Arrow function ka apna `this` nahi hota, yeh enclosing lexical scope se `this` inherit karta hai.',
          },
        },
        options: [],
        correctAnswer: 'Traditional functions have dynamic this bound at invocation time; arrow functions have lexical this inherited from the outer scope and cannot be rebound using call/apply/bind.',
        tags: ['javascript', 'functions', 'this', 'arrow-functions'],
      },
      // Existing 6: Medium MCQ
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
          { id: 'C', text: { en: 'Both queues have identical priority and alternate 1-by-1', hinglish: 'Dono ki priority same hoti hai aur alternate run hoti hain' } },
          { id: 'D', text: { en: 'Priority depends on the browser viewport width', hinglish: 'Priority browser screen size par depend karti hai' } },
        ],
        correctAnswer: 'B',
        tags: ['javascript', 'event-loop', 'microtasks', 'asynchronous'],
      },
      // Existing 7: Medium MCQ
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Closures & Scope',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'What is a closure in JavaScript?',
            explanation: 'A closure is the combination of a function bundled together with references to its lexical environment, allowing the inner function to access variables from an outer function even after the outer function has returned.',
          },
          hinglish: {
            question: 'JavaScript me Closure kya hota hai?',
            explanation: 'Closure ek function aur uske lexical environment ka combination hota hai, jisse inner function outer function ke variables ko access kar pata hai outer function ke execute hone ke baad bhi.',
          },
        },
        options: [
          { id: 'A', text: { en: 'A function that immediately invokes itself', hinglish: 'Ek function jo turant invoke ho jata hai' } },
          { id: 'B', text: { en: 'A function combined with references to its surrounding lexical environment', hinglish: 'Function jo apne outer lexical environment ke variables retain karta hai' } },
          { id: 'C', text: { en: 'A method to close open database sockets', hinglish: 'Database connection close karne ka function' } },
          { id: 'D', text: { en: 'A syntax error caused by unclosed curly braces', hinglish: 'Unclosed curly brackets ka syntax error' } },
        ],
        correctAnswer: 'B',
        tags: ['javascript', 'closures', 'scope'],
      },
      // New 8: Medium MCQ
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Promises & Asynchrony',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'What is the output state of a Promise returned by `Promise.race([])` when an empty iterable is passed?',
            explanation: 'If an empty iterable is passed to `Promise.race()`, the returned promise remains pending forever because there are no promises to settle first.',
          },
          hinglish: {
            question: 'Agar `Promise.race([])` me empty array pass kiya jaye, toh returned Promise ka state kya hoga?',
            explanation: '`Promise.race([])` hamesha pending rehta hai kyunki settle hone ke liye koi bhi promise available nahi hoti.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Resolved immediately with undefined', hinglish: 'Turant undefined ke sath resolve hota hai' } },
          { id: 'B', text: { en: 'Rejected with a RangeError', hinglish: 'RangeError ke sath reject hota hai' } },
          { id: 'C', text: { en: 'Pending forever', hinglish: 'Hamesha pending rehta hai' } },
          { id: 'D', text: { en: 'Resolved with an empty array', hinglish: 'Empty array ke sath resolve hota hai' } },
        ],
        correctAnswer: 'C',
        tags: ['javascript', 'promises', 'async', 'edge-case'],
      },
      // New 9: Medium Text
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Async / Await Mechanics',
        difficulty: 'medium',
        type: 'text',
        content: {
          en: {
            question: 'How does `async/await` syntax relate to Promises and generator functions under the hood in modern JavaScript engines?',
            explanation: '`async/await` is syntactic sugar over Promises and generators. An `async` function always returns a Promise; `await` pauses execution yield-style until the awaited Promise settles, allowing asynchronous code to be written synchronously without blocking the event loop.',
          },
          hinglish: {
            question: 'Modern JavaScript me `async/await` internally Promises aur generator functions ke sath kaise kaam karta hai?',
            explanation: '`async/await` Promises aur generators par based syntactic sugar hai. Async function hamesha Promise return karta hai aur await execution pause karta hai bina main thread block kiye.',
          },
        },
        options: [],
        correctAnswer: 'async/await is built on top of Promises and coroutines/generators; async functions always wrap returns in Promises, and await pauses execution flow until settlement without blocking thread.',
        tags: ['javascript', 'async-await', 'generators', 'promises'],
      },
      // New 10: Medium Text
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Object Cloning & References',
        difficulty: 'medium',
        type: 'text',
        content: {
          en: {
            question: 'Explain the difference between shallow copy and deep copy in JavaScript. How can each be implemented in modern JavaScript?',
            explanation: 'A shallow copy copies top-level properties but copies references to nested objects (via spread `{...obj}` or `Object.assign()`). A deep copy duplicates all nested objects recursively so mutations do not affect the original (via `structuredClone()` or manual recursive copy).',
          },
          hinglish: {
            question: 'JavaScript me Shallow Copy aur Deep Copy me kya antar hai? Inhe modern JavaScript me kaise implement kiya ja sakta hai?',
            explanation: 'Shallow copy sirf top-level properties copy karta hai jabki nested objects ke references shared rehte hain (spread operator se). Deep copy sabhi nested levels ko alag se copy karta hai (structuredClone se).',
          },
        },
        options: [],
        correctAnswer: 'Shallow copy duplicates top-level fields sharing nested object references (spread, Object.assign); deep copy duplicates all nested objects independently (structuredClone, recursive cloning).',
        tags: ['javascript', 'objects', 'copying', 'memory'],
      },
      // New 11: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'V8 Engine & Optimization',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'What is the "Hidden Classes" (Shapes) optimization used by modern V8 and JavaScript engines?',
            explanation: 'V8 assigns internal Hidden Classes (Shapes) based on property creation order. Objects sharing the same shape enable fast Inline Caching (IC) for property access without dynamic dictionary lookups.',
          },
          hinglish: {
            question: 'V8 engine me "Hidden Classes" (Shapes) optimization ka kya purpose hota hai?',
            explanation: 'Hidden Classes objects ke property offsets track karte hain taaki inline caching use karke fast property lookup kiya ja sake bina dictionary search ke.',
          },
        },
        options: [
          { id: 'A', text: { en: 'A syntax to declare private class fields with hash prefix', hinglish: 'Hash prefix ke sath private class fields declare karne ka syntax' } },
          { id: 'B', text: { en: 'An internal optimization mapping property offsets for fast inline caching', hinglish: 'Fast inline caching ke liye property offsets map karne wali internal engine optimization' } },
          { id: 'C', text: { en: 'Generational garbage collection algorithm for young space', hinglish: 'Young space ke liye garbage collection algorithm' } },
          { id: 'D', text: { en: 'Compiling JavaScript to WebAssembly bytecode on the fly', hinglish: 'JavaScript ko runtime me WebAssembly bytecode me convert karna' } },
        ],
        correctAnswer: 'B',
        tags: ['javascript', 'v8', 'performance', 'hidden-classes'],
      },
      // New 12: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Proxies & Invariants',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'In JavaScript, what happens if a `Proxy` get trap attempts to return a value different from the target property when that target property is non-configurable and non-writable?',
            explanation: 'JavaScript enforces Proxy invariants: if a target object property is non-configurable and non-writable, the Proxy trap must return the exact same value as the target property, otherwise a TypeError is thrown.',
          },
          hinglish: {
            question: 'JavaScript Proxy me agar target property non-configurable aur non-writable ho, aur proxy get trap alag value return kare toh kya hota hai?',
            explanation: 'Proxy invariant violation ki wajah se engine TypeError throw karta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'The proxy returns the trap value without error', hinglish: 'Proxy bina kisi error ke trap ki value return karta hai' } },
          { id: 'B', text: { en: 'The proxy returns undefined silently', hinglish: 'Proxy silently undefined return karta hai' } },
          { id: 'C', text: { en: 'A TypeError is thrown to preserve proxy invariant', hinglish: 'Proxy invariant preserve karne ke liye TypeError throw hota hai' } },
          { id: 'D', text: { en: 'The target property is automatically made configurable', hinglish: 'Target property automatically configurable ban jati hai' } },
        ],
        correctAnswer: 'C',
        tags: ['javascript', 'proxy', 'invariants', 'metaprogramming'],
      },
      // New 13: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'WeakMap & Memory',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'What is the primary difference between `WeakMap` and standard `Map` regarding key garbage collection?',
            explanation: 'In a `WeakMap`, keys must be objects or non-registered symbols, and references to keys are held weakly. If no other references to the key object exist, it can be garbage-collected along with its entry, preventing memory leaks.',
          },
          hinglish: {
            question: '`WeakMap` aur normal `Map` me key garbage collection ko lekar kya primary difference hota hai?',
            explanation: '`WeakMap` me keys weak references hoti hain, jisse agar key ka koi aur reference na bache toh garbage collector usse memory se clean kar deta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'WeakMap values are collected but keys are permanently retained', hinglish: 'WeakMap values clean hoti hain par keys hamesha retain rehti hain' } },
          { id: 'B', text: { en: 'WeakMap holds weak references to keys, allowing keys to be garbage-collected', hinglish: 'WeakMap keys par weak reference rakhta hai jisse unka garbage collection ho sakta hai' } },
          { id: 'C', text: { en: 'WeakMap keys are retained indefinitely in memory', hinglish: 'WeakMap keys memory me hamesha store rehti hain' } },
          { id: 'D', text: { en: 'WeakMap permits string keys while Map requires objects', hinglish: 'WeakMap me string keys use hoti hain aur Map me objects' } },
        ],
        correctAnswer: 'B',
        tags: ['javascript', 'weakmap', 'garbage-collection', 'memory'],
      },
      // Existing 14: Hard Text
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Prototype Chain & Inheritance',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'Explain how prototypical inheritance works in JavaScript. What happens when a property is accessed on an object that does not exist directly on that object?',
            explanation: 'Every JavaScript object has an internal [[Prototype]] link. When accessing a property, the runtime checks the object itself, then traverses up the prototype chain until found or null is reached.',
          },
          hinglish: {
            question: 'JavaScript me Prototypical Inheritance kaise kaam karta hai? Jab koi aisi property access ki jaati hai jo direct object par nahi hoti tab kya hota hai?',
            explanation: 'Har object ka ek [[Prototype]] reference hota hai. Property dhoondte waqt engine prototype chain me upar traverse karta hai jab tak property mil na jaye ya null na aa jaye.',
          },
        },
        options: [],
        correctAnswer: 'Objects have internal [[Prototype]] link (__proto__); engine searches own properties first, then traverses up the chain until found or null is reached.',
        tags: ['javascript', 'prototypes', 'inheritance', 'oop'],
      },
      // Existing 15: Hard Text
      {
        targetRole: defaultRole,
        topic: 'JavaScript',
        subtopic: 'Memory Management & Leaks',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'What causes memory leaks in client-side JavaScript applications, and how can uncleaned event listeners contribute to them?',
            explanation: 'Memory leaks occur when allocated memory is no longer needed by the app but is still reachable from the root object. Event listeners attached to DOM elements that are removed keep references in memory if not removed.',
          },
          hinglish: {
            question: 'Client-side JavaScript apps me Memory Leaks kyu hote hain, aur uncleaned Event Listeners isme kaise contribute karte hain?',
            explanation: 'Memory leak tab hota hai jab unneeded memory garbage collector clean nahi kar pata kyunki uska reference root se connected rehta hai. Removed elements ke event listeners memory me retain rehte hain agar removeEventListener na kiya jaye.',
          },
        },
        options: [],
        correctAnswer: 'Memory leaks occur when unused objects remain reachable from roots; uncleaned listeners on removed DOM nodes retain outer scope closures and prevent garbage collection.',
        tags: ['javascript', 'memory', 'performance', 'garbage-collection'],
      },

      // ==================================================================
      // REACT (15 Questions: 5 Easy, 5 Medium, 5 Hard)
      // ==================================================================
      // Existing 16: Easy MCQ
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'JSX Architecture',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'Why must React components return a single root element (or Fragment)?',
            explanation: 'Under the hood, JSX compiles to `React.createElement()` or `jsx()` function calls. A JavaScript function can only return a single value, hence adjacent elements must be wrapped in a single root container or Fragment.',
          },
          hinglish: {
            question: 'React components ko ek single root element (ya Fragment) kyu return karna padta hai?',
            explanation: 'JSX internally `React.createElement` call me convert hota hai. JavaScript function ek time par sirf ek hi value return kar sakta hai, isliye elements ko single root me wrap karna hota hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'To satisfy CSS flexbox rules', hinglish: 'CSS flexbox rules satisfy karne ke liye' } },
          { id: 'B', text: { en: 'Because JSX transpiles to a single function call returning one descriptor object', hinglish: 'Kyunki JSX transpile hokar ek single function call me convert hota hai jo ek object return karta hai' } },
          { id: 'C', text: { en: 'It is a browser HTML5 strict requirement', hinglish: 'Browser HTML5 ka rule hota hai' } },
          { id: 'D', text: { en: 'React does not allow more than 10 DOM elements per page', hinglish: 'React per page 10 se zyada elements allow nahi karta' } },
        ],
        correctAnswer: 'B',
        tags: ['react', 'jsx', 'fundamentals'],
      },
      // Existing 17: Easy MCQ
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Props & Immutability',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'Can a child component directly mutate the props it receives from its parent in React?',
            explanation: 'Props are strictly read-only in React to ensure unidirectional data flow and predictable rendering. Mutating props directly violates React core principles and causes rendering bugs.',
          },
          hinglish: {
            question: 'Kya koi child component parent se aane wale props ko directly mutate kar sakta hai?',
            explanation: 'React me props strictly read-only hote hain taaki unidirectional data flow bana rahe. Props ko direct mutate karna mana hota hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Yes, props are fully mutable', hinglish: 'Haan, props mutable hote hain' } },
          { id: 'B', text: { en: 'No, props are strictly read-only in React', hinglish: 'Nahi, React me props strictly read-only hote hain' } },
          { id: 'C', text: { en: 'Yes, but only if passed as an object', hinglish: 'Haan, par sirf tab jab object pass kiya ho' } },
          { id: 'D', text: { en: 'Only inside the constructor', hinglish: 'Sirf constructor ke andar' } },
        ],
        correctAnswer: 'B',
        tags: ['react', 'props', 'immutability'],
      },
      // New 18: Easy MCQ
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'JSX Syntax',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'In React, what HTML attribute is replaced by `className` in JSX?',
            explanation: 'In JSX, `className` is used instead of `class` because `class` is a reserved keyword in JavaScript.',
          },
          hinglish: {
            question: 'React JSX me standard HTML attribute `class` ki jagah kya use hota hai?',
            explanation: 'JavaScript me `class` reserved keyword hone ke karan JSX me `className` use kiya jata hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'style', hinglish: 'style' } },
          { id: 'B', text: { en: 'class', hinglish: 'class' } },
          { id: 'C', text: { en: 'name', hinglish: 'name' } },
          { id: 'D', text: { en: 'id', hinglish: 'id' } },
        ],
        correctAnswer: 'B',
        tags: ['react', 'jsx', 'attributes'],
      },
      // New 19: Easy Text
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Controlled Components',
        difficulty: 'easy',
        type: 'text',
        content: {
          en: {
            question: 'Explain what a Controlled Component is in React forms and why it is commonly used.',
            explanation: 'A controlled component derives its form input value from React state via the `value` prop and updates state on every keystroke via the `onChange` event handler, giving React complete control over the form input state.',
          },
          hinglish: {
            question: 'React forms me Controlled Component kya hota hai aur iska use kyu kiya jata hai?',
            explanation: 'Controlled component me input ka value React state se control hota hai aur onChange handler ke zariye state update hota hai, jisse form data par React ka poora control rehta hai.',
          },
        },
        options: [],
        correctAnswer: 'A controlled component derives its input value directly from React state via the value prop and updates it via onChange handlers, ensuring single source of truth.',
        tags: ['react', 'forms', 'controlled-components'],
      },
      // New 20: Easy Text
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'useEffect Basics',
        difficulty: 'easy',
        type: 'text',
        content: {
          en: {
            question: 'What is the purpose of the dependency array in the `useEffect` hook, and what happens when it is passed as an empty array `[]`?',
            explanation: 'The dependency array instructs React when to re-run the effect by shallowly comparing previous and current values. Passing an empty array `[]` means the effect has no dependencies and executes only once after the component mounts.',
          },
          hinglish: {
            question: 'React `useEffect` hook me dependency array ka kya role hota hai, aur empty array `[]` pass karne par kya hota hai?',
            explanation: 'Dependency array effect ko tab re-run karta hai jab list me di gayi values change hoti hain. Empty array `[]` dene par effect sirf component ke initial mount par ek baar chalta hai.',
          },
        },
        options: [],
        correctAnswer: 'The dependency array controls effect re-execution by shallow comparison; an empty array [] causes the effect to run only once after initial mount.',
        tags: ['react', 'useeffect', 'hooks', 'lifecycle'],
      },
      // Existing 21: Medium MCQ
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Hooks Lifecycle & Cleanup',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'When does the cleanup function returned from a `useEffect` hook execute?',
            explanation: 'The cleanup function executes before the component unmounts AND before the effect re-runs on subsequent renders with changed dependencies to prevent memory leaks.',
          },
          hinglish: {
            question: '`useEffect` hook se return hone wala cleanup function kab execute hota hai?',
            explanation: 'Cleanup function component ke unmount hone se pehle aur dependencies change hone par agla effect chalne se pehle execute hota hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Only when the browser window closes', hinglish: 'Sirf tab jab browser band ho' } },
          { id: 'B', text: { en: 'Before the component unmounts and before re-running the effect on dependency change', hinglish: 'Component unmount hone par aur dependency change par naya effect chalne se pehle' } },
          { id: 'C', text: { en: 'Synchronously during initial DOM paint', hinglish: 'Initial DOM render ke sath hi' } },
          { id: 'D', text: { en: 'Only when an unhandled error is thrown', hinglish: 'Sirf tab jab error throw ho' } },
        ],
        correctAnswer: 'B',
        tags: ['react', 'useeffect', 'hooks', 'lifecycle'],
      },
      // Existing 22: Medium MCQ
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Performance Optimization Hooks',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'What is the primary difference between `useMemo` and `useCallback`?',
            explanation: '`useMemo` caches the calculated *result* of a function, while `useCallback` caches the *function definition itself* across renders.',
          },
          hinglish: {
            question: '`useMemo` aur `useCallback` ke beech main difference kya hai?',
            explanation: '`useMemo` kisi function ke calculated result ko memoize karta hai, jabki `useCallback` function reference ko memoize karta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: '`useMemo` caches a computed value; `useCallback` caches a function definition', hinglish: '`useMemo` computed value cache karta hai; `useCallback` function instance cache karta hai' } },
          { id: 'B', text: { en: '`useCallback` is for class components; `useMemo` is for functions', hinglish: '`useCallback` class ke liye hai aur `useMemo` functions ke liye' } },
          { id: 'C', text: { en: '`useMemo` triggers side effects; `useCallback` renders JSX', hinglish: '`useMemo` side effects chalata hai aur `useCallback` JSX render karta hai' } },
          { id: 'D', text: { en: 'There is no difference in React 18', hinglish: 'React 18 me dono same hain' } },
        ],
        correctAnswer: 'A',
        tags: ['react', 'hooks', 'usememo', 'usecallback'],
      },
      // New 23: Medium MCQ
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Context API',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'What happens to consuming components when the value provided by a `React.createContext` Provider changes?',
            explanation: 'When a Context Provider value changes, all components that consume that context via `useContext` re-render, bypassing intermediate `React.memo` or `shouldComponentUpdate` checks.',
          },
          hinglish: {
            question: 'Jab kisi `React.createContext` Provider ki value change hoti hai toh consumer components par kya asar padta hai?',
            explanation: 'Context ki value change hone par sabhi consumer components re-render hote hain, bhale hi unka parent component `React.memo` se wrapped ho.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Only components wrapped with React.memo re-render', hinglish: 'Sirf React.memo wale components re-render hote hain' } },
          { id: 'B', text: { en: 'All components consuming that context re-render regardless of React.memo', hinglish: 'Context consume karne wale sabhi components re-render hote hain' } },
          { id: 'C', text: { en: 'No components re-render until forceUpdate is invoked', hinglish: 'forceUpdate call hone tak koi component re-render nahi hota' } },
          { id: 'D', text: { en: 'Only direct children of the Provider re-render', hinglish: 'Sirf Provider ke direct children re-render hote hain' } },
        ],
        correctAnswer: 'B',
        tags: ['react', 'context-api', 'rendering'],
      },
      // New 24: Medium Text
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Memoization Overhead',
        difficulty: 'medium',
        type: 'text',
        content: {
          en: {
            question: 'Explain when and why `React.memo`, `useMemo`, and `useCallback` should be used. What are the trade-offs of overusing them?',
            explanation: 'They prevent unnecessary re-renders and re-computations when props or dependencies do not change. Overusing them incurs memory overhead for storing cached values and CPU overhead for shallow equality checks on every render, which can exceed the cost of simple re-renders.',
          },
          hinglish: {
            question: '`React.memo`, `useMemo`, aur `useCallback` kab use karne chahiye? Inhe har jagah bina soche samjhe use karne ke kya nuksan hain?',
            explanation: 'Yeh unnecessary re-renders aur heavy calculations avoid karne ke liye use hote hain. Overuse karne se memory usage badhta hai aur har render par dependency comparison ka extra CPU cost lagta hai.',
          },
        },
        options: [],
        correctAnswer: 'Use them to avoid expensive re-renders and heavy recalculations; trade-offs of overusing include memory consumption and dependency shallow-comparison overhead.',
        tags: ['react', 'performance', 'memoization', 'trade-offs'],
      },
      // New 25: Medium Text
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Custom Hooks',
        difficulty: 'medium',
        type: 'text',
        content: {
          en: {
            question: 'What are Custom Hooks in React, what naming convention must they follow, and do multiple components calling the same custom hook share state?',
            explanation: 'Custom Hooks are JavaScript functions whose names start with `use` that can call other React hooks to extract reusable stateful logic. Multiple components calling the same custom hook do NOT share state; each component invocation gets its own isolated state instance.',
          },
          hinglish: {
            question: 'React me Custom Hooks kya hote hain, inka naming convention kya hai, aur kya alag-alag components same custom hook call karke state share karte hain?',
            explanation: 'Custom Hooks `use` se shuru hone wale functions hote hain jo reusable state logic contain karte hain. Inhe call karne wale components state share nahi karte, har call ka apna independent state hota hai.',
          },
        },
        options: [],
        correctAnswer: 'Custom hooks start with "use" and encapsulate reusable stateful logic; each calling component maintains its own isolated state instance without sharing.',
        tags: ['react', 'custom-hooks', 'state-isolation'],
      },
      // New 26: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Concurrent Features',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'In React 18 Concurrent Mode, what does the `useTransition` hook do?',
            explanation: '`useTransition` marks state updates as non-urgent transitions, allowing urgent updates (like typing or clicks) to interrupt them to keep the UI responsive.',
          },
          hinglish: {
            question: 'React 18 Concurrent Mode me `useTransition` hook ka kya kaam hota hai?',
            explanation: '`useTransition` state updates ko non-urgent mark karta hai taaki urgent user inputs (jaise typing) pehle process ho sakein.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Applies CSS transitions during DOM mounting', hinglish: 'DOM mount hone par CSS transition lagata hai' } },
          { id: 'B', text: { en: 'Marks state updates as non-urgent transitions that can be interrupted by urgent inputs', hinglish: 'State updates ko non-urgent mark karta hai jo urgent input se interrupt ho sakti hain' } },
          { id: 'C', text: { en: 'Transitions components from server to client execution', hinglish: 'Components ko server se client par shift karta hai' } },
          { id: 'D', text: { en: 'Disables garbage collection during page navigation', hinglish: 'Page navigation ke time garbage collection disable karta hai' } },
        ],
        correctAnswer: 'B',
        tags: ['react', 'concurrent-mode', 'usetransition'],
      },
      // New 27: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Fiber Architecture',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'In React Fiber architecture, what are the two main phases of rendering and which one is interruptible?',
            explanation: 'The Render phase (calculating diffs and building the work-in-progress Fiber tree) is asynchronous and interruptible. The Commit phase (applying DOM mutations and calling lifecycles) is synchronous and non-interruptible.',
          },
          hinglish: {
            question: 'React Fiber architecture me do main phases konse hote hain aur inme se konsa phase interruptible hota hai?',
            explanation: 'Render phase asynchronous aur interruptible hota hai, jabki Commit phase synchronous aur non-interruptible hota hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Render phase (interruptible) and Commit phase (synchronous / non-interruptible)', hinglish: 'Render phase (interruptible) aur Commit phase (synchronous)' } },
          { id: 'B', text: { en: 'Mount phase (synchronous) and Update phase (interruptible)', hinglish: 'Mount phase (synchronous) aur Update phase (interruptible)' } },
          { id: 'C', text: { en: 'Layout phase (interruptible) and Paint phase (asynchronous)', hinglish: 'Layout phase aur Paint phase' } },
          { id: 'D', text: { en: 'Reconciliation phase (non-interruptible) and Diffing phase (interruptible)', hinglish: 'Reconciliation phase aur Diffing phase' } },
        ],
        correctAnswer: 'A',
        tags: ['react', 'fiber', 'architecture', 'concurrency'],
      },
      // New 28: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Suspense Mechanism',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'How does a React component communicate to a parent `<Suspense>` boundary that its data is still loading?',
            explanation: 'React Suspense works by catching Promises thrown by components during rendering. When the thrown Promise resolves, React re-renders the component tree.',
          },
          hinglish: {
            question: 'React component parent `<Suspense>` boundary ko kaise batata hai ki uska data abhi load ho raha hai?',
            explanation: 'Component render ke dauran ek Promise throw karta hai jisko parent Suspense boundary catch karti hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'By returning false from the render function', hinglish: 'Render function se false return karke' } },
          { id: 'B', text: { en: 'By throwing a Promise from inside the component or hook during render', hinglish: 'Render ke dauran component se ek Promise throw karke' } },
          { id: 'C', text: { en: 'By setting this.state.loading = true', hinglish: 'this.state.loading = true set karke' } },
          { id: 'D', text: { en: 'By dispatching a custom DOM event to window', hinglish: 'Custom DOM event dispatch karke' } },
        ],
        correctAnswer: 'B',
        tags: ['react', 'suspense', 'promises', 'architecture'],
      },
      // Existing 29: Hard Text
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Reconciliation & Virtual DOM',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'How does React\'s Diffing / Reconciliation algorithm optimize DOM updates, and why is the `key` prop critical when rendering dynamic lists?',
            explanation: 'React compares new and old Virtual DOM trees using heuristic $O(n)$ diffing: elements of different types generate new trees, and elements with stable keys match across renders. Without stable keys, reordering forces full remounts.',
          },
          hinglish: {
            question: 'React ka Diffing / Reconciliation algorithm DOM updates ko kaise optimize karta hai, aur dynamic lists me `key` prop kyu zaroori hai?',
            explanation: 'React Virtual DOM trees ko compare karne ke liye $O(n)$ heuristic diffing use karta hai. Stable keys ensure karti hain ki items reorder hone par pura list remount na ho.',
          },
        },
        options: [],
        correctAnswer: 'Heuristic O(n) diffing compares tree nodes by type; stable keys identify matching elements across renders to avoid unnecessary remounts and DOM thrashing.',
        tags: ['react', 'reconciliation', 'diffing', 'virtual-dom'],
      },
      // Existing 30: Hard Text
      {
        targetRole: defaultRole,
        topic: 'React',
        subtopic: 'Server Components Architecture',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'What is the architectural difference between React Server Components (RSC) and standard Client Components in modern React?',
            explanation: 'RSCs execute strictly on the server, have zero client bundle impact, and can access backend resources directly without client-side state or effects. Client Components execute on both server and client (with hydration) and support interactive hooks.',
          },
          hinglish: {
            question: 'Modern React me React Server Components (RSC) aur standard Client Components ke beech architectural difference kya hai?',
            explanation: 'RSC sirf server par run hote hain, client bundle size zero rehta hai aur direct DB access milta hai. Client components interactive hooks (useState) allow karte hain aur browser me hydrate hote hain.',
          },
        },
        options: [],
        correctAnswer: 'RSCs execute strictly on the server with zero client bundle impact; Client components ship JavaScript to the browser and support state, effects, and interactive events.',
        tags: ['react', 'server-components', 'rsc', 'nextjs'],
      },

      // ==================================================================
      // NODE.JS (15 Questions: 5 Easy, 5 Medium, 5 Hard)
      // ==================================================================
      // Existing 31: Easy MCQ
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Architecture Fundamentals',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'Is Node.js single-threaded or multi-threaded for JavaScript execution?',
            explanation: 'Node.js executes JavaScript code on a single thread (the main event loop). However, underlying I/O, crypto, and filesystem operations are offloaded to multi-threaded worker pools via libuv.',
          },
          hinglish: {
            question: 'Node.js JavaScript execution ke liye single-threaded hota hai ya multi-threaded?',
            explanation: 'JavaScript execution main thread par single-threaded hoti hai, par background I/O operations libuv thread pool ke zariye multi-threaded handle hote hain.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Multi-threaded for all JavaScript operations', hinglish: 'Saare JavaScript operations multi-threaded hote hain' } },
          { id: 'B', text: { en: 'Single-threaded event loop for JavaScript, with background thread pool via libuv', hinglish: 'JavaScript ke liye single-threaded event loop, aur background me libuv thread pool' } },
          { id: 'C', text: { en: 'Single-threaded with no background workers at all', hinglish: 'Puri tarah single-threaded bina kisi background workers ke' } },
          { id: 'D', text: { en: 'Depends on the number of installed npm packages', hinglish: 'Installed npm packages par depend karta hai' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'event-loop', 'libuv', 'architecture'],
      },
      // Existing 32: Easy MCQ
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Modules & CommonJS',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'In CommonJS module format, how do you expose a function or object from a file?',
            explanation: 'In CommonJS, you assign functions, objects, or values to `module.exports` or properties on `exports` to make them available to `require()`.',
          },
          hinglish: {
            question: 'CommonJS module format me kisi file se function ya object ko export karne ke liye kya use karte hain?',
            explanation: 'CommonJS me file se code export karne ke liye `module.exports` use hota hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'export default fn;', hinglish: 'export default fn;' } },
          { id: 'B', text: { en: 'module.exports = fn;', hinglish: 'module.exports = fn;' } },
          { id: 'C', text: { en: 'return fn;', hinglish: 'return fn;' } },
          { id: 'D', text: { en: 'window.fn = fn;', hinglish: 'window.fn = fn;' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'modules', 'commonjs'],
      },
      // New 33: Easy MCQ
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Core Modules',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'Which core Node.js module provides utilities for working with file and directory paths across different operating systems?',
            explanation: 'The built-in `path` module provides cross-platform utilities for handling and transforming file paths (e.g. `path.join()`, `path.resolve()`).',
          },
          hinglish: {
            question: 'Node.js me cross-platform file aur directory paths handle karne ke liye konsa core module use hota hai?',
            explanation: 'Node.js ka built-in `path` module paths join aur resolve karne ke utilities provide karta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'fs', hinglish: 'fs' } },
          { id: 'B', text: { en: 'path', hinglish: 'path' } },
          { id: 'C', text: { en: 'os', hinglish: 'os' } },
          { id: 'D', text: { en: 'url', hinglish: 'url' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'core-modules', 'path'],
      },
      // New 34: Easy Text
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'EventEmitter Pattern',
        difficulty: 'easy',
        type: 'text',
        content: {
          en: {
            question: 'Explain the purpose of the `EventEmitter` class in Node.js and how the `on()` and `emit()` methods work.',
            explanation: '`EventEmitter` enables the observer pattern in Node.js. `on(eventName, listener)` registers a callback function for a named event, and `emit(eventName, ...args)` triggers all registered listeners synchronously with provided arguments.',
          },
          hinglish: {
            question: 'Node.js me `EventEmitter` class ka kya purpose hota hai, aur `on()` aur `emit()` methods kaise kaam karte hain?',
            explanation: '`EventEmitter` event-driven architecture facilitate karta hai. `on()` event listener register karta hai aur `emit()` us event ko trigger karke listeners execute karta hai.',
          },
        },
        options: [],
        correctAnswer: 'EventEmitter implements the observer pattern; on() binds listener callbacks to named events, and emit() triggers registered listeners synchronously.',
        tags: ['nodejs', 'events', 'eventemitter'],
      },
      // New 35: Easy Text
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Dependency Management',
        difficulty: 'easy',
        type: 'text',
        content: {
          en: {
            question: 'What is the purpose of `package-lock.json` in a Node.js project, and how does it differ from `package.json`?',
            explanation: '`package.json` specifies broad version ranges (semver) of dependencies. `package-lock.json` records the exact resolved versions, dependency tree, and integrity hashes to guarantee reproducible, identical installs across different machines.',
          },
          hinglish: {
            question: 'Node.js project me `package-lock.json` ka kya role hota hai aur yeh `package.json` se kaise alag hai?',
            explanation: '`package.json` dependencies ke version ranges define karta hai jabki `package-lock.json` exact resolved versions aur integrity hashes lock karta hai taaki sabhi environments me identical build bane.',
          },
        },
        options: [],
        correctAnswer: 'package.json defines project dependencies and semver ranges; package-lock.json locks exact resolved versions and dependency trees for deterministic reproducible builds.',
        tags: ['nodejs', 'npm', 'dependencies', 'package-lock'],
      },
      // Existing 36: Medium MCQ
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Streams & Performance',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'Why are Streams preferred over `fs.readFile` when serving large files (e.g. 2GB video) in Node.js?',
            explanation: '`fs.readFile` buffers the entire 2GB file into V8 heap memory before processing, risking process memory exhaustion (`ERR_BUFFER_TOO_LARGE`). Streams process data chunk-by-chunk with constant, low memory footprint.',
          },
          hinglish: {
            question: 'Node.js me badi files (jaise 2GB video) read karne ke liye `fs.readFile` ki jagah Streams kyu prefer ki jaati hain?',
            explanation: '`fs.readFile` poori file ek sath memory me load karta hai jisse memory crash ho sakti hai. Streams chunk-by-chunk data process karti hain jisse low memory use hoti hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Streams compress the video using gzip automatically', hinglish: 'Streams video automatically gzip se compress karti hain' } },
          { id: 'B', text: { en: 'Streams process data chunk-by-chunk in small buffers, preventing memory exhaustion', hinglish: 'Streams data chhote chunks me process karti hain jisse memory crash nahi hoti' } },
          { id: 'C', text: { en: 'Streams bypass operating system permissions', hinglish: 'Streams OS permissions bypass karti hain' } },
          { id: 'D', text: { en: '`fs.readFile` is deprecated in Node.js 18+', hinglish: '`fs.readFile` Node.js 18 me remove ho chuka hai' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'streams', 'buffers', 'performance'],
      },
      // Existing 37: Medium MCQ
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Express Middleware Signature',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'In Express 5, what must an error-handling middleware function signature look like?',
            explanation: 'Express distinguishes error-handling middleware specifically by function arity: it must accept exactly 4 arguments: `(err, req, res, next)`.',
          },
          hinglish: {
            question: 'Express me error-handling middleware function ke arguments ka signature kaisa hona chahiye?',
            explanation: 'Express me error middleware identify karne ke liye function me exactly 4 parameters `(err, req, res, next)` hona zaroori hai.',
          },
        },
        options: [
          { id: 'A', text: { en: '(req, res, err)', hinglish: '(req, res, err)' } },
          { id: 'B', text: { en: '(err, req, res, next)', hinglish: '(err, req, res, next)' } },
          { id: 'C', text: { en: '(req, res, next)', hinglish: '(req, res, next)' } },
          { id: 'D', text: { en: '(err, next)', hinglish: '(err, next)' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'express', 'middleware', 'error-handling'],
      },
      // New 38: Medium MCQ
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Process & Microtasks',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'In the Node.js Event Loop, when does `process.nextTick()` execute its callbacks?',
            explanation: '`process.nextTick()` callbacks are processed immediately after the current operation completes and before the event loop advances to the next phase, running ahead of standard Promise microtasks.',
          },
          hinglish: {
            question: 'Node.js Event Loop me `process.nextTick()` ke callbacks kab execute hote hain?',
            explanation: '`process.nextTick()` callbacks current operation ke khatam hote hi aur next event loop phase shuru hone se pehle turant execute hote hain.',
          },
        },
        options: [
          { id: 'A', text: { en: 'In the next iteration of the Timer phase', hinglish: 'Timers phase ke agle iteration me' } },
          { id: 'B', text: { en: 'Immediately after the current operation finishes and before the Event Loop continues to the next phase', hinglish: 'Current operation ke khatam hote hi aur next phase se pehle' } },
          { id: 'C', text: { en: 'In the Check phase along with setImmediate', hinglish: 'Check phase me setImmediate ke sath' } },
          { id: 'D', text: { en: 'Only when the libuv thread pool is completely idle', hinglish: 'Sirf tab jab thread pool idle ho' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'event-loop', 'nexttick', 'microtasks'],
      },
      // New 39: Medium Text
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Streams & Backpressure',
        difficulty: 'medium',
        type: 'text',
        content: {
          en: {
            question: 'Explain what "Backpressure" is in Node.js Streams and how piping (`readable.pipe(writable)`) handles it.',
            explanation: 'Backpressure occurs when data is read from a source faster than the downstream destination can write it, threatening buffer overflow. `pipe()` handles this by pausing the readable stream when `writable.write()` returns `false`, and resuming it when the writable stream emits the `drain` event.',
          },
          hinglish: {
            question: 'Node.js Streams me "Backpressure" kya hota hai aur `pipe()` method isse kaise handle karta hai?',
            explanation: 'Backpressure tab banta hai jab reader writer se zyada fast data bhejta hai. `pipe()` isse handle karne ke liye read pause kar deta hai jab tak writable stream "drain" event emit na kare.',
          },
        },
        options: [],
        correctAnswer: 'Backpressure occurs when data is produced faster than it can be consumed; pipe() pauses readable stream on false write return and resumes on drain event.',
        tags: ['nodejs', 'streams', 'backpressure', 'pipe'],
      },
      // New 40: Medium Text
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Clustering & Concurrency',
        difficulty: 'medium',
        type: 'text',
        content: {
          en: {
            question: 'Compare Node.js `cluster` module versus `Worker Threads` (`worker_threads`). In what scenario would you choose each?',
            explanation: '`cluster` spawns separate OS processes sharing server ports to utilize multi-core CPUs for I/O-bound web traffic (memory is isolated). `worker_threads` runs multiple threads inside a single process with shared memory (ideal for CPU-intensive tasks like image processing or cryptography).',
          },
          hinglish: {
            question: 'Node.js `cluster` module aur `worker_threads` me kya antar hai, aur dono ko kab use karna chahiye?',
            explanation: '`cluster` alag-alag processes create karta hai taaki server requests multiple cores par scale ho sakein. `worker_threads` single process ke andar threads banata hai CPU-heavy tasks ke liye.',
          },
        },
        options: [],
        correctAnswer: 'cluster spawns separate OS processes with isolated memory for scaling network I/O; worker_threads runs threads with shared memory for CPU-intensive computing.',
        tags: ['nodejs', 'clustering', 'worker-threads', 'concurrency'],
      },
      // New 41: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Buffer Allocation & Security',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'What is the security difference between `Buffer.alloc(size)` and `Buffer.allocUnsafe(size)` in Node.js?',
            explanation: '`Buffer.alloc(size)` zero-fills allocated memory, ensuring no stale data remains. `Buffer.allocUnsafe(size)` is faster but leaves memory uninitialized, which can expose sensitive data from previous allocations over the network.',
          },
          hinglish: {
            question: 'Node.js me `Buffer.alloc()` aur `Buffer.allocUnsafe()` ke beech security difference kya hota hai?',
            explanation: '`Buffer.alloc()` memory ko zero-fill karta hai jabki `Buffer.allocUnsafe()` uninitialized memory deta hai jisme sensitive data leak hone ka risk rehta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Buffer.allocUnsafe causes a segmentation fault on Linux', hinglish: 'Buffer.allocUnsafe Linux par segmentation fault deta hai' } },
          { id: 'B', text: { en: 'Buffer.alloc zero-fills memory; Buffer.allocUnsafe allocates uninitialized memory that may leak sensitive data', hinglish: 'Buffer.alloc zero-fill karta hai jabki allocUnsafe uninitialized memory allocate karta hai jo data leak kar sakti hai' } },
          { id: 'C', text: { en: 'Buffer.alloc is limited to 1MB while allocUnsafe is unlimited', hinglish: 'Buffer.alloc 1MB tak limited hai aur allocUnsafe unlimited' } },
          { id: 'D', text: { en: 'Buffer.allocUnsafe cannot be transmitted over HTTP sockets', hinglish: 'Buffer.allocUnsafe HTTP par transmit nahi ho sakta' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'buffers', 'security', 'memory'],
      },
      // New 42: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Event Loop Check Phase',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'In the Node.js Event Loop, in which exact phase do `setImmediate()` callbacks execute?',
            explanation: '`setImmediate()` callbacks execute in the Check phase of the Event Loop, immediately after the Poll phase has completed I/O polling.',
          },
          hinglish: {
            question: 'Node.js Event Loop ke kis exact phase me `setImmediate()` ke callbacks execute hote hain?',
            explanation: '`setImmediate()` callbacks Poll phase ke turant baad Check phase me execute hote hain.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Poll phase', hinglish: 'Poll phase' } },
          { id: 'B', text: { en: 'Timers phase', hinglish: 'Timers phase' } },
          { id: 'C', text: { en: 'Check phase', hinglish: 'Check phase' } },
          { id: 'D', text: { en: 'Close callbacks phase', hinglish: 'Close callbacks phase' } },
        ],
        correctAnswer: 'C',
        tags: ['nodejs', 'event-loop', 'setimmediate', 'check-phase'],
      },
      // New 43: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'V8 Heap Spaces',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'Which V8 heap space in Node.js holds objects that survived multiple scavenging cycles in the Young Generation?',
            explanation: 'In V8 garbage collection, objects surviving multiple scavenge cycles in the Young Generation (Nursery/Intermediate) are promoted to the Old Pointer Space or Old Data Space.',
          },
          hinglish: {
            question: 'V8 heap me Young Generation ke scavenging cycles survive karne wale objects kis space me promote hote hain?',
            explanation: 'Survive karne wale objects Old Pointer / Old Data Space me promote kiye jaate hain.',
          },
        },
        options: [
          { id: 'A', text: { en: 'New Space (Nursery)', hinglish: 'New Space (Nursery)' } },
          { id: 'B', text: { en: 'Old Pointer / Old Value Space', hinglish: 'Old Pointer / Old Value Space' } },
          { id: 'C', text: { en: 'Code Space', hinglish: 'Code Space' } },
          { id: 'D', text: { en: 'Large Object Space', hinglish: 'Large Object Space' } },
        ],
        correctAnswer: 'B',
        tags: ['nodejs', 'v8', 'garbage-collection', 'heap'],
      },
      // Existing 44: Hard Text
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'libuv Thread Pool & Asynchronous I/O',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'Explain what libuv does in the Node.js architecture. Which operations are delegated to the libuv thread pool rather than the OS asynchronous mechanisms?',
            explanation: 'libuv provides the event loop and cross-platform asynchronous I/O. Network I/O uses OS non-blocking primitives (epoll, kqueue). Blocking operations (fs, dns.lookup, crypto, zlib) are offloaded to libuv thread pool (default 4 threads).',
          },
          hinglish: {
            question: 'Node.js architecture me libuv kya kaam karta hai? Konsi operations OS async mechanisms ke bajaye libuv thread pool me delegate hoti hain?',
            explanation: 'libuv event loop aur asynchronous I/O handle karta hai. Network I/O OS ke non-blocking primitives use karta hai, jabki File System, DNS lookup, aur Crypto operations 4 threads wale libuv pool me execute hote hain.',
          },
        },
        options: [],
        correctAnswer: 'libuv abstracts cross-platform I/O; network I/O uses OS epoll/kqueue; file system, dns.lookup, crypto, and zlib use the libuv thread pool (UV_THREADPOOL_SIZE).',
        tags: ['nodejs', 'libuv', 'thread-pool', 'architecture'],
      },
      // Existing 45: Hard Text
      {
        targetRole: defaultRole,
        topic: 'Node.js',
        subtopic: 'Concurrency & Race Conditions',
        difficulty: 'hard',
        type: 'text',
        content: {
          en: {
            question: 'How can asynchronous JavaScript in a Node.js server introduce race conditions even though execution is single-threaded?',
            explanation: 'While synchronous execution is atomic, interleaving across `await` points allows other requests to run and mutate shared state (e.g. database read-then-write) between the initial read and final commit.',
          },
          hinglish: {
            question: 'Node.js server single-threaded hone ke bawajood asynchronous JavaScript me race conditions kaise paida ho sakti hain?',
            explanation: 'Synchronous execution atomic hota hai par do `await` statements ke beech me doosre requests ka code run ho sakta hai, jisse shared state ya DB read-then-write me race condition aa sakti hai.',
          },
        },
        options: [],
        correctAnswer: 'Single-threaded event loop only guarantees atomic synchronous steps; interleaving across await points allows concurrent requests to mutate shared state before completion.',
        tags: ['nodejs', 'concurrency', 'race-conditions', 'asynchronous'],
      },

      // ==================================================================
      // MONGODB (15 Questions: 5 Easy, 5 Medium, 5 Hard)
      // ==================================================================
      // Existing 46: Easy MCQ
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Document Identifiers',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'What is the default unique primary key field automatically generated for every document in MongoDB?',
            explanation: 'In MongoDB, every document requires an `_id` field acting as the primary key. If not provided upon insert, MongoDB automatically generates a 12-byte BSON ObjectId.',
          },
          hinglish: {
            question: 'MongoDB me har document ke liye automatically generate hone wali default primary key field konsi hoti hai?',
            explanation: 'MongoDB me har document me `_id` primary key hoti hai jo automatically 12-byte ObjectId create karta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'id', hinglish: 'id' } },
          { id: 'B', text: { en: '_id', hinglish: '_id' } },
          { id: 'C', text: { en: 'uuid', hinglish: 'uuid' } },
          { id: 'D', text: { en: 'primaryKey', hinglish: 'primaryKey' } },
        ],
        correctAnswer: 'B',
        tags: ['mongodb', 'basics', 'objectid'],
      },
      // Existing 47: Easy MCQ
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Update Operators',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'Which MongoDB update operator is used to modify the value of a field without replacing the entire document?',
            explanation: '`$set` replaces the value of a specified field with the specified value, preserving all other fields in the document.',
          },
          hinglish: {
            question: 'MongoDB me pura document replace kiye bina specific field ko update karne ke liye konsa operator use hota hai?',
            explanation: '`$set` operator specific fields ki value update karta hai bina baki document ko hataye.',
          },
        },
        options: [
          { id: 'A', text: { en: '$update', hinglish: '$update' } },
          { id: 'B', text: { en: '$set', hinglish: '$set' } },
          { id: 'C', text: { en: '$put', hinglish: '$put' } },
          { id: 'D', text: { en: '$replace', hinglish: '$replace' } },
        ],
        correctAnswer: 'B',
        tags: ['mongodb', 'crud', 'update', 'operators'],
      },
      // New 48: Easy MCQ
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Query Basics',
        difficulty: 'easy',
        type: 'mcq',
        content: {
          en: {
            question: 'Which MongoDB command is used to retrieve all documents from a collection named `users` in MongoDB Shell / Compass?',
            explanation: '`db.users.find()` with empty query parameters returns a cursor pointing to all matching documents in the collection.',
          },
          hinglish: {
            question: 'MongoDB Shell me `users` collection ke sabhi documents ko dekhne ke liye konsi command use hoti hai?',
            explanation: '`db.users.find()` sabhi documents retrieve karne ke liye use hoti hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'db.users.select()', hinglish: 'db.users.select()' } },
          { id: 'B', text: { en: 'db.users.find()', hinglish: 'db.users.find()' } },
          { id: 'C', text: { en: 'db.users.getAll()', hinglish: 'db.users.getAll()' } },
          { id: 'D', text: { en: 'db.users.query()', hinglish: 'db.users.query()' } },
        ],
        correctAnswer: 'B',
        tags: ['mongodb', 'crud', 'find'],
      },
      // New 49: Easy Text
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Indexing Fundamentals',
        difficulty: 'easy',
        type: 'text',
        content: {
          en: {
            question: 'Why are indexes used in MongoDB, and what is the difference between a Collection Scan (COLLSCAN) and an Index Scan (IXSCAN)?',
            explanation: 'Indexes store ordered subsets of collection data in a B-Tree structure to accelerate queries. A Collection Scan (COLLSCAN) checks every document sequentially, which is slow for large datasets. An Index Scan (IXSCAN) traverses the B-Tree index to locate matching document pointers directly.',
          },
          hinglish: {
            question: 'MongoDB me indexes kyu use hote hain aur Collection Scan (COLLSCAN) aur Index Scan (IXSCAN) me kya farak hota hai?',
            explanation: 'Indexes queries ko fast karne ke liye B-Tree me field data sort karke rakhte hain. COLLSCAN har document ko sequentially check karta hai jabki IXSCAN seedhe index se matching documents locate karta hai.',
          },
        },
        options: [],
        correctAnswer: 'Indexes store ordered B-tree data to prevent full table scans; COLLSCAN inspects every document in storage whereas IXSCAN traverses index entries to fetch matching documents efficiently.',
        tags: ['mongodb', 'indexes', 'collscan', 'ixscan'],
      },
      // New 50: Easy Text
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Mongoose ODM',
        difficulty: 'easy',
        type: 'text',
        content: {
          en: {
            question: 'What is the role of Mongoose schemas and models when interacting with a MongoDB database?',
            explanation: 'Mongoose schemas define the shape of documents, data types, validation rules, default values, and middleware hooks at the application layer. Models compile the schema into a constructor and programmatic API to query, insert, and update documents in MongoDB collections.',
          },
          hinglish: {
            question: 'MongoDB ke sath kaam karte waqt Mongoose Schemas aur Models ka kya role hota hai?',
            explanation: 'Mongoose Schema document structure, validation aur data types define karta hai. Model us schema ko compile karke database collection par CRUD operations perform karne ka interface deta hai.',
          },
        },
        options: [],
        correctAnswer: 'Mongoose schemas enforce structure, types, and validation at application layer; models compile schemas into constructors and CRUD query interfaces for collections.',
        tags: ['mongodb', 'mongoose', 'schemas', 'odm'],
      },
      // Existing 51: Medium MCQ
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Index Types & Performance',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'What is a "Covered Query" in MongoDB?',
            explanation: 'A covered query is a query where all queried fields are part of an index AND all fields returned in results are in the same index. MongoDB matches the query and returns results directly from the index without scanning documents.',
          },
          hinglish: {
            question: 'MongoDB me "Covered Query" ka kya matlab hota hai?',
            explanation: 'Covered query wo hoti hai jisme filter aur return hone wali saari fields index me shamil hoti hain, jisse database ko actual documents access karne ki zaroorat nahi padti.',
          },
        },
        options: [
          { id: 'A', text: { en: 'A query that scans every document in the collection', hinglish: 'Ek query jo poori collection scan karti hai' } },
          { id: 'B', text: { en: 'A query where all searched and returned fields are satisfied entirely by index keys', hinglish: 'Aisi query jisme searched aur returned fields poori tarah index se hi fulfill ho jaati hain' } },
          { id: 'C', text: { en: 'A query that encrypts result sets with TLS', hinglish: 'Aisi query jo data encrypt karti hai' } },
          { id: 'D', text: { en: 'A query covered by a multi-document transaction lock', hinglish: 'Transaction lock ke andar chalne wali query' } },
        ],
        correctAnswer: 'B',
        tags: ['mongodb', 'indexes', 'covered-query', 'performance'],
      },
      // Existing 52: Medium MCQ
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
      // New 53: Medium MCQ
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Compound Index Prefix Rule',
        difficulty: 'medium',
        type: 'mcq',
        content: {
          en: {
            question: 'If a compound index is defined as `{ status: 1, createdAt: -1 }` on orders, which of the following queries CANNOT efficiently use the index prefix?',
            explanation: 'MongoDB compound indexes can support queries that specify prefix fields. A query filtering only on `createdAt` without `status` does not match the index prefix and cannot utilize the index efficiently.',
          },
          hinglish: {
            question: 'Agar `{ status: 1, createdAt: -1 }` compound index ho, toh inme se konsi query index prefix use NAHI kar sakti?',
            explanation: 'Compound index me query tabhi index use kar sakti hai jab wo index ke starting prefix fields (jaise `status`) include kare. Sirf `createdAt` query index prefix rule follow nahi karti.',
          },
        },
        options: [
          { id: 'A', text: { en: 'db.orders.find({ status: "active" })', hinglish: 'db.orders.find({ status: "active" })' } },
          { id: 'B', text: { en: 'db.orders.find({ status: "active", createdAt: { $gte: date } })', hinglish: 'db.orders.find({ status: "active", createdAt: { $gte: date } })' } },
          { id: 'C', text: { en: 'db.orders.find({ createdAt: { $gte: date } })', hinglish: 'db.orders.find({ createdAt: { $gte: date } })' } },
          { id: 'D', text: { en: 'db.orders.find({ status: "pending" }).sort({ createdAt: -1 })', hinglish: 'db.orders.find({ status: "pending" }).sort({ createdAt: -1 })' } },
        ],
        correctAnswer: 'C',
        tags: ['mongodb', 'indexes', 'compound-index', 'prefix-rule'],
      },
      // New 54: Medium Text
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Aggregation Pipeline Flow',
        difficulty: 'medium',
        type: 'text',
        content: {
          en: {
            question: 'Explain the purpose and optimal sequence of the `$match`, `$group`, and `$project` stages in a MongoDB aggregation pipeline.',
            explanation: '`$match` filters documents early to utilize indexes and reduce data volume; `$group` aggregates remaining documents by an `_id` key using accumulator expressions (`$sum`, `$avg`); `$project` reshapes final output documents by including, excluding, or transforming fields.',
          },
          hinglish: {
            question: 'MongoDB aggregation pipeline me `$match`, `$group`, aur `$project` stages ka kya purpose hota hai aur inka optimal sequence kya hona chahiye?',
            explanation: '`$match` shuruat me data filter karke index use karta hai aur volume kam karta hai. `$group` specific field ke according grouping aur calculation karta hai, aur `$project` final document fields format karta hai.',
          },
        },
        options: [],
        correctAnswer: '$match filters early to leverage indexes and reduce pipeline volume; $group aggregates by grouping key with accumulators; $project reshapes and transforms output fields.',
        tags: ['mongodb', 'aggregation', 'pipeline', 'optimization'],
      },
      // New 55: Medium Text
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Replica Sets & Failover',
        difficulty: 'medium',
        type: 'text',
        content: {
          en: {
            question: 'Explain how Replica Sets provide high availability in MongoDB and what occurs when the Primary node becomes unavailable.',
            explanation: 'A Replica Set is a group of mongod instances maintaining identical data through oplog replication (one Primary and multiple Secondaries). When the Primary node fails or loses quorum, an automated election is held among eligible Secondaries to elect a new Primary.',
          },
          hinglish: {
            question: 'MongoDB me Replica Sets high availability kaise provide karte hain aur jab Primary node band ho jaye tab kya hota hai?',
            explanation: 'Replica Set me ek Primary aur multiple Secondary nodes hote hain jo oplog ke through data sync rakhte hain. Primary down hone par Secondaries aapas me election karke ek naya Primary elect karte hain.',
          },
        },
        options: [],
        correctAnswer: 'Replica sets maintain redundant copies via oplog replication with one Primary accepting writes; on Primary failure, remaining Secondaries elect a new Primary automatically.',
        tags: ['mongodb', 'replica-sets', 'high-availability', 'failover'],
      },
      // New 56: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Sharding & Chunks',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'What is a "Jumbo Chunk" in a MongoDB sharded cluster?',
            explanation: 'A jumbo chunk is a chunk that exceeds the configured maximum chunk size (default 64MB) and cannot be split by the balancer because all documents in the chunk share the exact same shard key value.',
          },
          hinglish: {
            question: 'MongoDB sharded cluster me "Jumbo Chunk" kya hota hai?',
            explanation: 'Jumbo chunk wo chunk hota hai jo maximum chunk size cross kar chuka hota hai par split nahi ho sakta kyunki uske sabhi documents ka shard key same hota hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'A chunk exceeding maximum replica set node count', hinglish: 'Aisa chunk jo replica set limit cross kare' } },
          { id: 'B', text: { en: 'A chunk exceeding maximum size that cannot be split because documents share the same shard key', hinglish: 'Maximum size cross karne wala chunk jo same shard key ki wajah se split nahi ho sakta' } },
          { id: 'C', text: { en: 'An index spanning all shards concurrently', hinglish: 'Sabhi shards par span karne wala global index' } },
          { id: 'D', text: { en: 'A chunk stored in RAM instead of disk cache', hinglish: 'Disk ki jagah RAM me store hone wala chunk' } },
        ],
        correctAnswer: 'B',
        tags: ['mongodb', 'sharding', 'chunks', 'scalability'],
      },
      // New 57: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Storage Engine Concurrency',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'Which concurrency control mechanism is used by the MongoDB WiredTiger storage engine for document-level write operations?',
            explanation: 'WiredTiger uses optimistic concurrency control with Multi-Version Concurrency Control (MVCC) to provide document-level concurrency without read-write locking conflicts.',
          },
          hinglish: {
            question: 'MongoDB WiredTiger storage engine document-level write operations ke liye konsa concurrency control mechanism use karta hai?',
            explanation: 'WiredTiger optimistic concurrency aur MVCC use karta hai jisse document-level locking aur high concurrent throughput milta hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'Table-level locking', hinglish: 'Table-level locking' } },
          { id: 'B', text: { en: 'Optimistic concurrency control with Multi-Version Concurrency Control (MVCC)', hinglish: 'Optimistic concurrency control aur MVCC' } },
          { id: 'C', text: { en: 'Pessimistic collection locking', hinglish: 'Pessimistic collection locking' } },
          { id: 'D', text: { en: 'Single-threaded event loop serialization', hinglish: 'Single-threaded event loop serialization' } },
        ],
        correctAnswer: 'B',
        tags: ['mongodb', 'wiredtiger', 'concurrency', 'mvcc'],
      },
      // New 58: Hard MCQ
      {
        targetRole: defaultRole,
        topic: 'MongoDB',
        subtopic: 'Read Concern & Consistency',
        difficulty: 'hard',
        type: 'mcq',
        content: {
          en: {
            question: 'Which MongoDB `readConcern` level guarantees reading data that has been acknowledged by a majority of replica set members and cannot be rolled back?',
            explanation: '`readConcern: "majority"` ensures that the query returns data committed to a majority of replica set nodes, guaranteeing the read data is durable and cannot be rolled back in a failover.',
          },
          hinglish: {
            question: 'Konsa MongoDB `readConcern` level ensure karta hai ki padha gaya data majority members se acknowledge ho chuka hai aur rollback nahi ho sakta?',
            explanation: '`readConcern: "majority"` guarantee karta hai ki data replica set majority par commit ho chuka hai aur rollback immune hai.',
          },
        },
        options: [
          { id: 'A', text: { en: 'local', hinglish: 'local' } },
          { id: 'B', text: { en: 'available', hinglish: 'available' } },
          { id: 'C', text: { en: 'majority', hinglish: 'majority' } },
          { id: 'D', text: { en: 'linearizable', hinglish: 'linearizable' } },
        ],
        correctAnswer: 'C',
        tags: ['mongodb', 'readconcern', 'consistency', 'replication'],
      },
      // Existing 59: Hard Text
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
      // Existing 60: Hard Text
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
