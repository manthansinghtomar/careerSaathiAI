const crypto = require('crypto');
const DailyActiveTime = require('../models/DailyActiveTime');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { safeDispatchNotification } = require('./notificationService');
const {
  getIstDayIndex,
  getIstDayKey,
  getIstDayIndexFromKey,
} = require('../utils/istDateHelper');

const MIN_PING_INTERVAL_SEC = 10;
const MAX_IDLE_TIMEOUT_SEC = 120;
const MAX_DELTA_CREDIT_SEC = 60;
const QUALIFYING_THRESHOLD_SEC = 900;
const ELIGIBLE_CONTEXTS = [
  'assessment',
  'recommendations',
  'progress',
  'practice',
  'dashboard_learning',
];
const STALE_LOCK_MS = 10000; // 10s lease expiration
const CLAIM_TIMEOUT_MS = 15000; // 15s outbox claim timeout
const MILESTONES = [3, 7, 14, 30, 50, 100];

/**
 * Validates and records active learning heartbeats.
 * Enforces zero-credit baseline, anti-spam rate limiting, idle timeouts,
 * cross-midnight rollover, and sliding-window request deduplication.
 */
async function processHeartbeat({
  studentId,
  pageContext,
  requestId = null,
  referenceDate = null,
}) {
  const isTest = referenceDate instanceof Date && !isNaN(referenceDate.getTime());

  if (!pageContext || !ELIGIBLE_CONTEXTS.includes(pageContext)) {
    const serverNow = isTest ? referenceDate : new Date();
    return {
      activeSeconds: 0,
      targetSeconds: QUALIFYING_THRESHOLD_SEC,
      qualifiesStreak: false,
      newlyQualified: false,
      message: 'Ineligible page context. Heartbeat not credited.',
      istDate: getIstDayKey(serverNow),
    };
  }

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Fresh server time on every iteration in production
    const serverNow = isTest ? referenceDate : new Date();
    const istDate = getIstDayKey(serverNow);

    let daily = await DailyActiveTime.findOne({ student: studentId, istDate });

    if (!daily) {
      // First heartbeat of the calendar day: establish ZERO-CREDIT baseline
      try {
        daily = await DailyActiveTime.create({
          student: studentId,
          istDate,
          activeSeconds: 0,
          qualifiesStreak: false,
          streakSyncStatus: 'pending',
          lastPingAt: serverNow,
          recentRequests: requestId ? [{ requestId, receivedAt: serverNow }] : [],
          lastPageContext: pageContext,
          sessionCount: 1,
        });
        return {
          activeSeconds: 0,
          targetSeconds: QUALIFYING_THRESHOLD_SEC,
          qualifiesStreak: false,
          newlyQualified: false,
          istDate,
        };
      } catch (err) {
        if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
          daily = await DailyActiveTime.findOne({ student: studentId, istDate });
        } else {
          throw err;
        }
      }
    }

    // Sliding-window request ID deduplication
    if (requestId && Array.isArray(daily.recentRequests)) {
      const isDuplicate = daily.recentRequests.some((r) => r.requestId === requestId);
      if (isDuplicate) {
        return {
          activeSeconds: daily.activeSeconds,
          targetSeconds: QUALIFYING_THRESHOLD_SEC,
          qualifiesStreak: daily.qualifiesStreak,
          newlyQualified: false,
          istDate,
        };
      }
    }

    const capturedLastPingAt = daily.lastPingAt;
    const lastPingDayKey = getIstDayKey(capturedLastPingAt);

    let delta = 0;
    let isNewSession = false;

    if (lastPingDayKey !== istDate) {
      // Midnight boundary crossed: Day D+1 starts fresh zero-credit baseline
      delta = 0;
      isNewSession = true;
    } else {
      const elapsedSec = Math.floor(
        (serverNow.getTime() - new Date(capturedLastPingAt).getTime()) / 1000
      );

      if (elapsedSec < 0) {
        delta = 0; // Clock skew anomaly: 0 credit, re-baseline
      } else if (elapsedSec < MIN_PING_INTERVAL_SEC) {
        delta = 0; // Rapid ping rate-limit
      } else if (elapsedSec > MAX_IDLE_TIMEOUT_SEC) {
        delta = 0; // Idle gap: 0 credit for idle time; new session
        isNewSession = true;
      } else {
        delta = Math.min(elapsedSec, MAX_DELTA_CREDIT_SEC); // Continuous active time
      }
    }

    const casQuery = {
      _id: daily._id,
      lastPingAt: capturedLastPingAt,
    };

    const updateDoc = {
      $inc: { activeSeconds: delta },
      $set: {
        lastPingAt: serverNow,
        lastPageContext: pageContext,
      },
    };

    if (requestId) {
      updateDoc.$push = {
        recentRequests: {
          $each: [{ requestId, receivedAt: serverNow }],
          $slice: -20,
        },
      };
    }

    if (isNewSession) {
      updateDoc.$inc.sessionCount = 1;
    }

    const projectedSeconds = daily.activeSeconds + delta;
    if (projectedSeconds >= QUALIFYING_THRESHOLD_SEC && !daily.qualifiesStreak) {
      updateDoc.$set.qualifiesStreak = true;
      updateDoc.$set.qualifiedAt = serverNow;
      updateDoc.$set.streakSyncStatus = 'qualified_pending_sync';
    }

    const updatedDaily = await DailyActiveTime.findOneAndUpdate(casQuery, updateDoc, {
      returnDocument: 'after',
    });

    if (updatedDaily) {
      let newlyQualified = false;
      if (updatedDaily.streakSyncStatus === 'qualified_pending_sync') {
        newlyQualified = await reconcileStudentStreak(studentId, serverNow);
      }

      return {
        activeSeconds: updatedDaily.activeSeconds,
        targetSeconds: QUALIFYING_THRESHOLD_SEC,
        qualifiesStreak: updatedDaily.qualifiesStreak,
        newlyQualified,
        istDate,
      };
    }
    // If CAS failed, loops to retry with fresh server time
  }

  // Fallback lookup after 3 failed CAS attempts: fresh server time
  const fallbackNow = isTest ? referenceDate : new Date();
  const fallbackIstDate = getIstDayKey(fallbackNow);
  const fallbackDaily = await DailyActiveTime.findOne({
    student: studentId,
    istDate: fallbackIstDate,
  });

  return {
    activeSeconds: fallbackDaily?.activeSeconds || 0,
    targetSeconds: QUALIFYING_THRESHOLD_SEC,
    qualifiesStreak: fallbackDaily?.qualifiesStreak || false,
    newlyQualified: false,
    istDate: fallbackIstDate,
  };
}

/**
 * Acquires a fenced reconciliation lease on the authoritative User document.
 */
async function acquireReconciliationLease(studentId) {
  const token = crypto.randomUUID();
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_LOCK_MS);

  const lockedUser = await User.findOneAndUpdate(
    {
      _id: studentId,
      $or: [
        { 'gamification.reconciliationLock.token': null },
        { 'gamification.reconciliationLock.lockedAt': { $lt: staleThreshold } },
        { 'gamification.reconciliationLock': { $exists: false } },
      ],
    },
    {
      $inc: { 'gamification.reconciliationLock.epoch': 1 },
      $set: {
        'gamification.reconciliationLock.token': token,
        'gamification.reconciliationLock.lockedAt': now,
      },
    },
    { returnDocument: 'after' }
  );

  if (!lockedUser) return null;
  return {
    token,
    epoch: lockedUser.gamification?.reconciliationLock?.epoch || 1,
  };
}

/**
 * Releases the reconciliation lease on User if token and epoch match.
 */
async function releaseReconciliationLease(studentId, lease) {
  if (!lease || !lease.token) return;
  await User.findOneAndUpdate(
    {
      _id: studentId,
      'gamification.reconciliationLock.token': lease.token,
      'gamification.reconciliationLock.epoch': lease.epoch,
    },
    {
      $set: {
        'gamification.reconciliationLock.token': null,
        'gamification.reconciliationLock.lockedAt': null,
      },
    }
  );
}

/**
 * Reconciles student streak while strictly preserving streak continuity beyond 90 days.
 * Authoritative streak state lives on User, never recalculated purely by counting DailyActiveTime documents.
 */
async function reconcileStudentStreak(studentId, syncDate = new Date()) {
  let lease = null;
  const MAX_ACQUIRE_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ACQUIRE_ATTEMPTS; attempt++) {
    lease = await acquireReconciliationLease(studentId);
    if (lease) break;
    await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
  }

  if (!lease) return false;

  try {
    const student = await User.findById(studentId).select('gamification');
    if (!student) return false;

    const gamification = student.gamification || {};
    let storedStreak = Number(gamification.streakCount) || 0;
    let storedLongest = Number(gamification.longestStreak) || storedStreak;
    let lastKey = gamification.lastQualifyingDayKey || null;

    // 1. Drain any pending milestone outbox items
    await drainMilestoneOutbox(studentId);

    // 2. Fetch all qualifying days sorted ascending in strictly CHRONOLOGICAL order
    const qualifyingRecords = await DailyActiveTime.find({
      student: studentId,
      qualifiesStreak: true,
    }).sort({ istDate: 1 });

    if (qualifyingRecords.length === 0) return false;

    const recordsToMarkSynced = [];
    const newMilestoneIntents = [];

    // Chronological reconciliation preserving active streak continuity
    for (const record of qualifyingRecords) {
      recordsToMarkSynced.push(record._id);

      if (lastKey === null) {
        // First qualifying day recorded for this user
        storedStreak = 1;
        lastKey = record.istDate;
      } else {
        const recIndex = getIstDayIndexFromKey(record.istDate);
        const lastIndex = getIstDayIndexFromKey(lastKey);
        const dayDiff = recIndex - lastIndex;

        if (dayDiff === 0) {
          // Same calendar day: duplicate or multi-session qualification, no change
        } else if (dayDiff === 1) {
          // Consecutive calendar day: increments existing authoritative streak!
          // (Even if days older than 90 days were purged by TTL, storedStreak continues)
          storedStreak += 1;
          lastKey = record.istDate;
        } else if (dayDiff > 1) {
          // Gap > 1 day: Streak broken and resets to 1
          storedStreak = 1;
          lastKey = record.istDate;
        } else {
          // dayDiff < 0: Late-arriving historical day prior to lastKey
          const allDayIndices = new Set(
            qualifyingRecords.map((r) => getIstDayIndexFromKey(r.istDate))
          );

          // If un-synced late day connects through an unbroken chain up to lastKey, it legitimately extends active streak
          if (record.streakSyncStatus !== 'synced') {
            let curr = recIndex;
            while (allDayIndices.has(curr + 1)) {
              curr += 1;
            }
            if (curr === lastIndex) {
              storedStreak += 1;
            }
          }

          // Evaluate full historical contiguous segment for longestStreak
          let segLen = 1;
          let left = recIndex - 1;
          while (allDayIndices.has(left)) {
            segLen++;
            left--;
          }
          let right = recIndex + 1;
          while (allDayIndices.has(right)) {
            segLen++;
            right++;
          }
          storedLongest = Math.max(storedLongest, segLen);
        }
      }

      storedLongest = Math.max(storedLongest, storedStreak);

      if (MILESTONES.includes(storedStreak)) {
        // Enqueue milestone intent if not already existing
        newMilestoneIntents.push({
          milestone: storedStreak,
          dayKey: record.istDate,
          intentId: crypto.randomUUID(),
          status: 'pending',
          claimToken: null,
          claimedAt: null,
        });
      }
    }

    // 3. Fenced atomic commit to User including durable milestone outbox
    const userUpdateDoc = {
      $set: {
        'gamification.streakCount': storedStreak,
        'gamification.longestStreak': storedLongest,
        'gamification.lastQualifyingDayKey': lastKey,
        'gamification.lastActiveDate': syncDate,
        'gamification.reconciliationLock.token': null,
        'gamification.reconciliationLock.lockedAt': null,
      },
    };

    if (newMilestoneIntents.length > 0) {
      userUpdateDoc.$push = {
        'gamification.pendingMilestones': { $each: newMilestoneIntents },
      };
    }

    const userCommit = await User.findOneAndUpdate(
      {
        _id: studentId,
        'gamification.reconciliationLock.token': lease.token,
        'gamification.reconciliationLock.epoch': lease.epoch,
      },
      userUpdateDoc,
      { returnDocument: 'after' }
    );

    if (!userCommit) {
      // Lease was superseded by another worker: DISCARD and ABORT!
      // Stale worker is strictly prevented from touching DailyActiveTime or draining outbox.
      return false;
    }

    // 4. ONLY AFTER User commit succeeds: mark DailyActiveTime records synced
    if (recordsToMarkSynced.length > 0) {
      await DailyActiveTime.updateMany(
        { _id: { $in: recordsToMarkSynced }, streakSyncStatus: { $ne: 'synced' } },
        { $set: { streakSyncStatus: 'synced', syncedByEpoch: lease.epoch } }
      );
    }

    // 5. Drain committed milestone outbox post-commit
    await drainMilestoneOutbox(studentId);

    return true;
  } finally {
    await releaseReconciliationLease(studentId, lease);
  }
}

/**
 * Claim-and-Acknowledge Outbox Protocol for Milestone Notifications.
 * Ensures acknowledgment removes only the exact element matching both intentId AND claimToken.
 */
async function drainMilestoneOutbox(studentId) {
  const claimToken = crypto.randomUUID();
  const claimCutoff = new Date(Date.now() - CLAIM_TIMEOUT_MS);

  const claimedUser = await User.findOneAndUpdate(
    {
      _id: studentId,
      'gamification.pendingMilestones': {
        $elemMatch: {
          $or: [
            { status: 'pending' },
            { status: 'in_flight', claimedAt: { $lt: claimCutoff } },
          ],
        },
      },
    },
    {
      $set: {
        'gamification.pendingMilestones.$[elem].status': 'in_flight',
        'gamification.pendingMilestones.$[elem].claimToken': claimToken,
        'gamification.pendingMilestones.$[elem].claimedAt': new Date(),
      },
    },
    {
      arrayFilters: [
        {
          $or: [
            { 'elem.status': 'pending' },
            { 'elem.status': 'in_flight', 'elem.claimedAt': { $lt: claimCutoff } },
          ],
        },
      ],
      returnDocument: 'after',
    }
  );

  if (!claimedUser || !Array.isArray(claimedUser.gamification?.pendingMilestones)) return;

  const itemsToProcess = claimedUser.gamification.pendingMilestones.filter(
    (m) => m.claimToken === claimToken
  );

  for (const item of itemsToProcess) {
    let notificationPersisted = false;
    try {
      await Notification.create({
        recipient: studentId,
        type: 'streak_milestone',
        title: `${item.milestone}-Day Streak Achieved! 🔥`,
        message: `Incredible! You completed 15+ minutes of active learning for ${item.milestone} consecutive days.`,
        data: { streakCount: item.milestone, milestone: item.milestone },
        idempotencyKey: `streak_milestone:${studentId}:${item.milestone}:${item.dayKey}`,
      });
      notificationPersisted = true;
    } catch (err) {
      if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
        notificationPersisted = true; // Duplicate already exists: verified persisted!
      } else {
        console.warn(`[MILESTONE_OUTBOX_WARNING]: Failed to dispatch milestone notification: ${err.message}`);
      }
    }

    // Acknowledge and remove ONLY IF notification persistence is confirmed!
    // Fenced on both intentId and claimToken on the exact element
    if (notificationPersisted) {
      await User.updateOne(
        {
          _id: studentId,
          'gamification.pendingMilestones': {
            $elemMatch: {
              intentId: item.intentId,
              claimToken: claimToken,
            },
          },
        },
        {
          $pull: {
            'gamification.pendingMilestones': {
              intentId: item.intentId,
              claimToken: claimToken,
            },
          },
        }
      );
    }
  }
}

/**
 * Returns streak summary with dynamic missed-day evaluation and reminder triggers.
 */
async function getStreakSummary(studentId, referenceDate = null) {
  const isTest = referenceDate instanceof Date && !isNaN(referenceDate.getTime());
  const serverNow = isTest ? referenceDate : new Date();
  const istDate = getIstDayKey(serverNow);
  const todayIndex = getIstDayIndex(serverNow);

  // Self-Healing: Reconcile any qualified days pending sync
  const pendingCount = await DailyActiveTime.countDocuments({
    student: studentId,
    qualifiesStreak: true,
    streakSyncStatus: { $ne: 'synced' },
  });

  if (pendingCount > 0) {
    await reconcileStudentStreak(studentId, serverNow);
  }

  // Drain outbox if any orphaned milestones exist
  await drainMilestoneOutbox(studentId);

  const daily = await DailyActiveTime.findOne({ student: studentId, istDate });
  const student = await User.findById(studentId).select('gamification');
  const gamification = student?.gamification || {};
  const storedStreak = Number(gamification.streakCount) || 0;
  const longestStreak = Number(gamification.longestStreak) || storedStreak;
  const lastKey = gamification.lastQualifyingDayKey || null;
  const lastIndex = lastKey ? getIstDayIndexFromKey(lastKey) : null;

  // Dynamic Missed-Day Calculation
  let effectiveStreak;
  let streakStatus;

  if (lastIndex === null) {
    effectiveStreak = 0;
    streakStatus = 'inactive';
  } else {
    const dayDiff = todayIndex - lastIndex;
    if (dayDiff === 0) {
      effectiveStreak = storedStreak;
      streakStatus = 'active'; // Already qualified today
    } else if (dayDiff === 1) {
      effectiveStreak = storedStreak;
      streakStatus = 'at_risk'; // Active yesterday, needs 15m today
    } else {
      effectiveStreak = 0; // Missed 1 or more calendar days: broken
      streakStatus = 'broken';
    }
  }

  const qualifiesToday = lastKey === istDate;
  const nextMilestone = MILESTONES.find((m) => m > effectiveStreak) || 100;
  const daysToNextMilestone = Math.max(0, nextMilestone - effectiveStreak);

  // Trigger streak reminder if active yesterday but not yet qualified today
  if (streakStatus === 'at_risk' && !qualifiesToday) {
    safeDispatchNotification({
      recipient: studentId,
      type: 'streak_reminder',
      title: 'Keep Your Streak Alive! 🔥',
      message: `You have a ${effectiveStreak}-day learning streak. Complete 15 minutes of learning today to keep it going!`,
      data: { currentStreak: effectiveStreak },
      idempotencyKey: `streak_reminder:${studentId}:${istDate}`,
    });
  }

  return {
    currentStreak: effectiveStreak,
    longestStreak,
    qualifiesToday,
    todayActiveSeconds: daily?.activeSeconds || 0,
    targetSeconds: QUALIFYING_THRESHOLD_SEC,
    lastQualifyingDayKey: lastKey,
    istDayKey: istDate,
    nextMilestone,
    daysToNextMilestone,
    streakStatus,
  };
}

module.exports = {
  MIN_PING_INTERVAL_SEC,
  MAX_IDLE_TIMEOUT_SEC,
  MAX_DELTA_CREDIT_SEC,
  QUALIFYING_THRESHOLD_SEC,
  ELIGIBLE_CONTEXTS,
  processHeartbeat,
  reconcileStudentStreak,
  drainMilestoneOutbox,
  getStreakSummary,
  // Exported for deterministic unit testing
  acquireReconciliationLease,
  releaseReconciliationLease,
};
