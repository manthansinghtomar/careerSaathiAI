const notificationService = require('../services/notificationService');

/**
 * @desc    Get paginated notifications for authenticated user
 * @route   GET /api/notifications
 * @access  Protected (All authenticated roles)
 */
async function getNotifications(req, res, next) {
  try {
    const userId = req.user._id;
    const { status, page, limit } = req.query;

    const result = await notificationService.getUserNotifications(userId, {
      status,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get count of unread notifications for authenticated user
 * @route   GET /api/notifications/unread-count
 * @access  Protected (All authenticated roles)
 */
async function getUnreadNotificationCount(req, res, next) {
  try {
    const userId = req.user._id;
    const result = await notificationService.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Protected (Recipient only)
 */
async function markNotificationRead(req, res, next) {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await notificationService.markNotificationAsRead(userId, id);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Mark all unread notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Protected (All authenticated roles)
 */
async function markAllRead(req, res, next) {
  try {
    const userId = req.user._id;
    const result = await notificationService.markAllNotificationsAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllRead,
};
