const mongoose = require('mongoose');
const Notification = require('../models/Notification');

/**
 * Creates a notification idempotently.
 * Catches duplicate key error (code 11000) and returns existing or persisted notification.
 */
async function createNotification({
  recipient,
  type,
  title,
  message,
  data = {},
  idempotencyKey = null,
}) {
  if (!recipient || !type || !title || !message) {
    throw new Error('Missing required notification fields: recipient, type, title, message');
  }

  try {
    const notification = await Notification.create({
      recipient,
      type,
      title: title.trim(),
      message: message.trim(),
      data,
      idempotencyKey,
    });
    return notification;
  } catch (err) {
    if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
      // Idempotent duplicate: already persisted
      if (idempotencyKey) {
        return await Notification.findOne({ idempotencyKey });
      }
    }
    throw err;
  }
}

/**
 * Non-blocking safe notification dispatcher.
 * Never throws or disrupts parent transactions/controllers.
 */
function safeDispatchNotification(payload) {
  createNotification(payload).catch((err) => {
    // Non-blocking log
    if (err.code !== 11000) {
      console.warn(`[NOTIFICATION_DISPATCH_WARNING]: Failed to dispatch notification: ${err.message}`);
    }
  });
}

/**
 * Retrieves paginated notifications for a recipient with unread filtering.
 */
async function getUserNotifications(userId, options = {}) {
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const query = { recipient: userId };
  if (options.status === 'unread') {
    query.isRead = false;
  } else if (options.status === 'read') {
    query.isRead = true;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      unreadCount,
    },
  };
}

/**
 * Returns count of unread notifications for a user.
 */
async function getUnreadCount(userId) {
  const count = await Notification.countDocuments({ recipient: userId, isRead: false });
  return { count };
}

/**
 * Marks a single notification as read, enforcing recipient boundary.
 */
async function markNotificationAsRead(userId, notificationId) {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    const error = new Error('Invalid notification ID format');
    error.statusCode = 400;
    throw error;
  }

  const notification = await Notification.findById(notificationId);
  if (!notification) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  if (notification.recipient.toString() !== userId.toString()) {
    const error = new Error('Access forbidden: You cannot modify another user\'s notification');
    error.statusCode = 403;
    throw error;
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return notification;
}

/**
 * Marks all unread notifications for a recipient as read.
 */
async function markAllNotificationsAsRead(userId) {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return {
    modifiedCount: result.modifiedCount || 0,
  };
}

module.exports = {
  createNotification,
  safeDispatchNotification,
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
