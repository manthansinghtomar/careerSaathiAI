const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'assessment_completed',
        'assessment_evaluated',
        'trainer_feedback',
        'streak_milestone',
        'streak_reminder',
        'system',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    data: {
      assessmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assessment',
        default: null,
      },
      score: {
        type: Number,
        default: null,
      },
      streakCount: {
        type: Number,
        default: null,
      },
      milestone: {
        type: Number,
        default: null,
      },
      extra: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30-day retention
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);
