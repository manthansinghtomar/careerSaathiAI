const mongoose = require('mongoose');

const dailyActiveTimeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    istDate: {
      type: String, // 'YYYY-MM-DD' in Asia/Kolkata
      required: true,
      index: true,
    },
    activeSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    qualifiesStreak: {
      type: Boolean,
      default: false,
      index: true,
    },
    streakSyncStatus: {
      type: String,
      enum: ['pending', 'qualified_pending_sync', 'synced'],
      default: 'pending',
      index: true,
    },
    syncedByEpoch: {
      type: Number,
      default: null,
    },
    qualifiedAt: {
      type: Date,
      default: null,
    },
    lastPingAt: {
      type: Date,
      default: Date.now,
    },
    recentRequests: [
      {
        requestId: { type: String, required: true },
        receivedAt: { type: Date, default: Date.now },
      },
    ],
    lastPageContext: {
      type: String,
      default: 'dashboard_learning',
    },
    sessionCount: {
      type: Number,
      default: 1,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 3600 * 1000), // 90-day retention
    },
  },
  { timestamps: true }
);

// Compound unique index ensuring only one record per student per IST calendar day
dailyActiveTimeSchema.index({ student: 1, istDate: 1 }, { unique: true });

// TTL Index for 90-day retention cleanup
dailyActiveTimeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('DailyActiveTime', dailyActiveTimeSchema);
