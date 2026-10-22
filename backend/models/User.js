const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Excluded from queries by default
    },
    role: {
      type: String,
      enum: ['student', 'trainer', 'admin'],
      default: 'student',
      index: true,
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'hinglish'],
      default: 'en',
    },
    careerProfile: {
      targetRole: {
        type: String,
        default: 'Full Stack Developer',
      },
      targetTimeline: {
        type: String,
        default: '3 months',
      },
      currentSkillLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner',
      },
      focusSkills: {
        type: [String],
        default: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
      },
    },
    gamification: {
      xp: { type: Number, default: 0 },
      level: { type: Number, default: 1 },
      streakCount: { type: Number, default: 1 },
      lastActiveDate: { type: Date, default: Date.now },
    },
    assignedTrainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Mongoose 9 modern async pre-save hook (no callback next parameter)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  if (!this.password || typeof this.password !== 'string' || this.password.trim().length < 6) {
    throw new Error('Password must be at least 6 non-whitespace characters long');
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) {
    throw new Error('Password hash not selected in query');
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

// Exclude sensitive fields from JSON serialization
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
