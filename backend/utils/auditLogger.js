const AuditLog = require('../models/AuditLog');

const AUDIT_ACTION_ALLOWLIST = {
  ROLE_UPDATED: [
    'targetEmail',
    'previousRole',
    'newRole',
    'unassignedStudentsCount',
  ],
  USER_DEACTIVATED: [
    'targetEmail',
    'previousStatus',
    'newStatus',
    'unassignedStudentsCount',
  ],
  USER_ACTIVATED: [
    'targetEmail',
    'previousStatus',
    'newStatus',
  ],
  STUDENT_ASSIGNED: [
    'studentId',
    'previousTrainerId',
    'targetTrainerId',
  ],
  STUDENT_UNASSIGNED: [
    'studentId',
    'previousTrainerId',
    'targetTrainerId',
  ],
  BULK_ASSIGNED: [
    'targetTrainerId',
    'requestedCount',
    'databaseModified',
    'databaseMatched',
    'precheckUnchanged',
    'precheckSkipped',
  ],
  BULK_UNASSIGNED: [
    'targetTrainerId',
    'requestedCount',
    'databaseModified',
    'databaseMatched',
    'precheckUnchanged',
    'precheckSkipped',
  ],
  ASSESSMENT_INSPECTED: [
    'assessmentId',
    'studentId',
    'questionId',
    'status',
    'isFullyEvaluated',
  ],
};

// Bounded match on exact sensitive tokens, word boundaries, or snake_case delimiters
// Does NOT match legitimate identifiers like questionId, studentId, keyId, etc.
const SENSITIVE_KEY_REGEX = /(?:^|_)(?:password|passwd|token|jwt|secret|auth|bearer|studentAnswer|correctAnswer)(?:$|_)/i;

/**
 * Recursively inspects nested objects and arrays, discarding any sensitive key.
 * Preserves numbers, strings, booleans, dates, ObjectIds, and clean objects/arrays.
 *
 * @param {*} value
 * @returns {*} Sanitized value
 */
function recursivelySanitize(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Handle Date and ObjectId instances without mangling
  if (value instanceof Date || (value._bsontype && value._bsontype === 'ObjectId')) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(recursivelySanitize);
  }

  const sanitized = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      continue; // Discard sensitive property
    }
    sanitized[k] = recursivelySanitize(v);
  }
  return sanitized;
}

/**
 * Filters raw audit details using the action-specific allowlist and deep recursive sanitization.
 *
 * @param {string} action
 * @param {Object} rawDetails
 * @returns {Object} Clean details
 */
function filterAuditDetails(action, rawDetails = {}) {
  const allowedKeys = AUDIT_ACTION_ALLOWLIST[action] || [];
  const filtered = {};

  if (!rawDetails || typeof rawDetails !== 'object') {
    return filtered;
  }

  for (const key of allowedKeys) {
    if (rawDetails[key] !== undefined) {
      filtered[key] = recursivelySanitize(rawDetails[key]);
    }
  }

  return filtered;
}

/**
 * Non-blocking helper function for logging administrative audit events.
 * Failures to write audit logs are logged to stdout with [AUDIT_WRITE_ERROR]
 * and do not crash or abort the parent administrative operation.
 *
 * @param {Object} params
 * @param {Object} params.req - Express request object
 * @param {string} params.action - One of the AUDIT_ACTION_ALLOWLIST actions
 * @param {string} params.targetType - 'User' | 'Assessment'
 * @param {string|mongoose.Types.ObjectId} [params.targetId] - Target entity ID
 * @param {Object} [params.details] - Action-specific metadata
 */
async function logAdminAction({ req, action, targetType, targetId, details = {} }) {
  try {
    const cleanDetails = filterAuditDetails(action, details);

    const actorId = req && req.user ? req.user._id : null;
    const actorEmail = req && req.user ? req.user.email : 'unknown';

    if (!actorId) {
      console.warn(`[AUDIT_LOG_WARNING]: Attempted audit log without authenticated actor for action ${action}`);
      return;
    }

    const ipAddress = req ? (req.ip || req.connection?.remoteAddress || null) : null;

    await AuditLog.create({
      actor: actorId,
      actorEmail,
      action,
      targetType,
      targetId: targetId || null,
      details: cleanDetails,
      ipAddress,
    });
  } catch (err) {
    // Non-blocking: log to stdout so administrative operations proceed safely
    console.error(`[AUDIT_WRITE_ERROR]: Failed to write audit log for ${action}:`, err.message);
  }
}

module.exports = {
  logAdminAction,
  filterAuditDetails,
  AUDIT_ACTION_ALLOWLIST,
  SENSITIVE_KEY_REGEX,
  recursivelySanitize,
};
