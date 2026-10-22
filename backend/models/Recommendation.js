const mongoose = require('mongoose');

const topicRecommendationSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
      enum: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    suggestedFocus: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const nextActionSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['study', 'practice', 'revision'],
      default: 'practice',
    },
    estimatedMinutes: {
      type: Number,
      default: 20,
    },
  },
  { _id: false }
);

const practiceAssessmentRecommendationSchema = new mongoose.Schema(
  {
    targetRole: {
      type: String,
      required: true,
      default: 'Full Stack Developer',
    },
    selectedTopics: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one topic must be selected for practice assessment recommendation',
      },
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'balanced'],
      default: 'easy',
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    launchConfig: {
      endpoint: { type: String, default: '/api/assessments/generate' },
      method: { type: String, default: 'POST' },
      body: {
        targetRole: { type: String, default: 'Full Stack Developer' },
        selectedTopics: { type: [String], default: [] },
        difficulty: { type: String, default: 'easy' },
        questionCount: { type: Number, default: 5 },
      },
    },
  },
  { _id: false }
);

const recommendationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // One active recommendation document per student
      index: true,
    },
    source: {
      type: String,
      enum: ['ai', 'rule_based_fallback'],
      required: true,
    },
    modelUsed: {
      type: String,
      default: null,
    },
    fallbackReason: {
      type: String,
      default: null,
    },
    profileSnapshot: {
      targetRole: { type: String, default: 'Full Stack Developer' },
      currentSkillLevel: { type: String, default: 'beginner' },
      preferredLanguage: { type: String, default: 'en' },
      focusSkills: { type: [String], default: [] },
    },
    performanceSnapshot: {
      overallPercentage: { type: Number, default: null },
      totalAssessmentsCompleted: { type: Number, default: 0 },
      weakTopics: { type: [String], default: [] },
      topicBreakdown: [
        {
          topic: String,
          accuracyPercentage: Number,
          status: String,
        },
      ],
    },
    recommendedTopics: [topicRecommendationSchema],
    nextActions: [nextActionSchema],
    practiceAssessments: [practiceAssessmentRecommendationSchema],
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 3600000), // 1 hour TTL
      index: true,
    },
  },
  { timestamps: true }
);

// Clean JSON representation (exclude internal Mongoose version key)
recommendationSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Recommendation', recommendationSchema);
