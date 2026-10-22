const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    targetRole: {
      type: String,
      required: [true, 'Target role is required'],
      default: 'Full Stack Developer',
      trim: true,
      index: true,
    },
    topic: {
      type: String,
      required: [true, 'Topic is required'],
      enum: {
        values: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        message: '{VALUE} is not a supported topic',
      },
      index: true,
    },
    subtopic: {
      type: String,
      trim: true,
      default: 'General',
    },
    difficulty: {
      type: String,
      required: [true, 'Difficulty is required'],
      enum: {
        values: ['easy', 'medium', 'hard'],
        message: '{VALUE} is not a supported difficulty',
      },
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Question type is required'],
      enum: {
        values: ['mcq', 'text'],
        message: '{VALUE} is not a valid question type',
      },
      index: true,
    },
    content: {
      en: {
        question: {
          type: String,
          required: [true, 'English question text is required'],
          trim: true,
        },
        explanation: {
          type: String,
          trim: true,
          default: '',
        },
      },
      hinglish: {
        question: {
          type: String,
          trim: true,
          default: '',
        },
        explanation: {
          type: String,
          trim: true,
          default: '',
        },
      },
    },
    options: [
      {
        id: {
          type: String,
          required: true,
          trim: true,
        },
        text: {
          en: {
            type: String,
            required: [true, 'Option English text is required'],
            trim: true,
          },
          hinglish: {
            type: String,
            trim: true,
            default: '',
          },
        },
      },
    ],
    // Correct answer for MCQ: option id ('A', 'B', etc.)
    // For text questions: reference rubric / sample answer for future evaluation
    correctAnswer: {
      type: String,
      required: [true, 'Correct answer or reference rubric is required'],
      trim: true,
      select: false, // Hidden by default from queries
    },
    tags: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required'],
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for efficient assessment question sampling
questionSchema.index({ targetRole: 1, topic: 1, difficulty: 1, isActive: 1 });

// Schema validation before saving
questionSchema.pre('validate', function () {
  if (this.type === 'mcq') {
    if (!Array.isArray(this.options) || this.options.length < 2) {
      this.invalidate('options', 'MCQ questions must provide at least 2 options');
    } else {
      const optionIds = this.options.map((opt) => opt.id);
      const uniqueIds = new Set(optionIds);
      if (uniqueIds.size !== optionIds.length) {
        this.invalidate('options', 'Option IDs must be unique');
      }
      if (this.correctAnswer && !optionIds.includes(this.correctAnswer)) {
        this.invalidate('correctAnswer', `MCQ correctAnswer must match one of the option IDs (${optionIds.join(', ')})`);
      }
    }
  }
});

// Clean JSON output - strictly strip correctAnswer unless explicitly flagged
questionSchema.methods.toJSON = function () {
  const obj = this.toObject();
  if (!this._includeAnswerInJSON) {
    delete obj.correctAnswer;
  }
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Question', questionSchema);
