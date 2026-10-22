const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'ROLE_UPDATED',
        'USER_DEACTIVATED',
        'USER_ACTIVATED',
        'STUDENT_ASSIGNED',
        'STUDENT_UNASSIGNED',
        'BULK_ASSIGNED',
        'BULK_UNASSIGNED',
        'ASSESSMENT_INSPECTED',
      ],
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      enum: ['User', 'Assessment'],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
