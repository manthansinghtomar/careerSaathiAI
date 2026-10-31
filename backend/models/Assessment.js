const mongoose = require('mongoose');

const aiEvaluationSchema = new mongoose.Schema(
  {
    score: { type: Number, required: true },
    percentage: { type: Number, required: true },
    rubricBreakdown: {
      technicalCorrectness: { type: Number, required: true },
      conceptualUnderstanding: { type: Number, required: true },
      completeness: { type: Number, required: true },
      reasoning: { type: Number, required: true },
      answerRelevance: { type: Number, required: true },
    },
    feedback: { type: String, required: true },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    suggestions: { type: [String], default: [] },
    rawScore: { type: Number, default: null },
    rawPercentage: { type: Number, default: null },
    languageMismatch: { type: Boolean, default: false },
    languagePenalty: { type: Number, default: 0 },
    detectedLanguage: { type: String, default: 'en' },
    languageWarning: { type: String, default: null },
    evaluatedLanguage: { type: String, enum: ['en', 'hinglish', 'english', 'flexible'], default: 'english' },
    modelUsed: { type: String, default: 'gemini-3.8-flash' },
    evaluatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const assessmentQuestionSnapshotSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    topic: {
      type: String,
      required: true,
    },
    subtopic: {
      type: String,
      default: 'General',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
    },
    type: {
      type: String,
      enum: ['mcq', 'text'],
      required: true,
    },
    content: {
      en: {
        question: { type: String, required: true },
        explanation: { type: String, default: '' },
      },
      hinglish: {
        question: { type: String, default: '' },
        explanation: { type: String, default: '' },
      },
    },
    options: [
      {
        id: { type: String, required: true },
        text: {
          en: { type: String, required: true },
          hinglish: { type: String, default: '' },
        },
      },
    ],
    // Hidden during in-progress queries
    correctAnswer: {
      type: String,
      required: true,
      select: false,
    },
    studentAnswer: {
      type: String,
      default: null,
      trim: true,
    },
    isCorrect: {
      type: Boolean,
      default: null, // null for text/pending, true/false for mcq
    },
    evaluationStatus: {
      type: String,
      enum: ['auto_evaluated', 'pending_evaluation', 'manual_evaluated', 'ai_evaluated'],
      default: 'pending_evaluation',
    },
    pointsEarned: {
      type: Number,
      default: 0,
    },
    maxPoints: {
      type: Number,
      default: 1,
    },
    aiEvaluation: {
      type: aiEvaluationSchema,
      default: null,
    },
    trainerEvaluation: {
      pointsEarned: { type: Number, default: null },
      remarks: { type: String, default: null },
      evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      evaluatedAt: { type: Date, default: null },
    },
  },
  { _id: false }
);

const assessmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required'],
      index: true,
    },
    targetRole: {
      type: String,
      required: true,
      default: 'Full Stack Developer',
    },
    selectedTopics: {
      type: [String],
      required: true,
      validate: {
        validator: (val) => Array.isArray(val) && val.length > 0,
        message: 'At least one topic must be selected',
      },
    },
    mode: {
      type: String,
      enum: ['mcq', 'text', 'mixed'],
      default: 'mixed',
      index: true,
    },
    languageMode: {
      type: String,
      enum: ['english', 'hinglish', 'flexible'],
      default: 'english',
      index: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'abandoned'],
      default: 'in_progress',
      index: true,
    },
    isEvaluating: {
      type: Boolean,
      default: false,
    },
    evaluationLockToken: {
      type: String,
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    questions: [assessmentQuestionSnapshotSchema],
    totalQuestions: {
      type: Number,
      required: true,
    },
    objectiveQuestionsCount: {
      type: Number,
      default: 0,
    },
    subjectiveQuestionsCount: {
      type: Number,
      default: 0,
    },
    scoring: {
      objectiveScore: { type: Number, default: 0 },
      objectiveMaxScore: { type: Number, default: 0 },
      objectivePercentage: { type: Number, default: 0 },
      subjectiveScore: { type: Number, default: 0 },
      subjectiveMaxScore: { type: Number, default: 0 },
      subjectivePercentage: { type: Number, default: 0 },
      overallScore: { type: Number, default: 0 },
      overallMaxScore: { type: Number, default: 0 },
      overallPercentage: { type: Number, default: 0 },
      isFullyEvaluated: { type: Boolean, default: false },
    },
    topicWiseResults: [
      {
        topic: { type: String, required: true },
        totalQuestions: { type: Number, default: 0 },
        objectiveCorrect: { type: Number, default: 0 },
        objectiveTotal: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        isWeakTopic: { type: Boolean, default: false },
      },
    ],
    weakTopics: {
      type: [String],
      default: [],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    trainerFeedback: {
      remarks: { type: String, default: null, trim: true },
      trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      givenAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

assessmentSchema.index({ student: 1, status: 1 });
assessmentSchema.index({ student: 1, status: 1, completedAt: -1 });

/**
 * Explicitly sanitizes assessment object for in-progress test taking.
 * Guarantees NO correctAnswer, reference answers, or explanations are leaked,
 * satisfying Mandatory Safeguard 1.
 */
assessmentSchema.methods.toSafeTakingJSON = function () {
  const obj = this.toObject();

  // Ensure backward compatibility: treat missing languageMode as 'english'
  obj.languageMode = obj.languageMode || 'english';

  // Strip top-level scoring and evaluation results if in-progress
  if (obj.status === 'in_progress') {
    delete obj.scoring;
    delete obj.topicWiseResults;
    delete obj.weakTopics;
    delete obj.completedAt;
  }

  // Explicitly sanitize every question snapshot
  if (Array.isArray(obj.questions)) {
    obj.questions = obj.questions.map((q) => {
      const sanitizedQ = { ...q };
      delete sanitizedQ.correctAnswer;
      delete sanitizedQ.isCorrect;
      delete sanitizedQ.pointsEarned;
      delete sanitizedQ.evaluationStatus;
      delete sanitizedQ.aiEvaluation;

      // Also scrub explanations during in-progress assessment taking
      if (obj.status === 'in_progress') {
        if (sanitizedQ.content?.en) {
          sanitizedQ.content.en = { question: sanitizedQ.content.en.question };
        }
        if (sanitizedQ.content?.hinglish) {
          sanitizedQ.content.hinglish = { question: sanitizedQ.content.hinglish.question };
        }
      }
      return sanitizedQ;
    });
  }

  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Assessment', assessmentSchema);
