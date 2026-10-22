const streakService = require('../services/streakService');

/**
 * @desc    Record active learning heartbeat
 * @route   POST /api/streak/heartbeat
 * @access  Protected (Student only)
 */
async function recordHeartbeat(req, res, next) {
  try {
    const studentId = req.user._id;
    const { pageContext, requestId, referenceDate } = req.body || {};

    const refDate = referenceDate ? new Date(referenceDate) : null;

    const result = await streakService.processHeartbeat({
      studentId,
      pageContext,
      requestId,
      referenceDate: refDate && !isNaN(refDate.getTime()) ? refDate : null,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get current streak summary and today's active progress
 * @route   GET /api/streak/summary
 * @access  Protected (Student only)
 */
async function getStreak(req, res, next) {
  try {
    const studentId = req.user._id;
    const { referenceDate } = req.query || {};

    const refDate = referenceDate ? new Date(referenceDate) : null;

    const summary = await streakService.getStreakSummary(
      studentId,
      refDate && !isNaN(refDate.getTime()) ? refDate : null
    );

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  recordHeartbeat,
  getStreak,
};
