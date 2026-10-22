const mongoose = require('mongoose');
const User = require('../models/User');

// @desc    Get all students (Trainer sees only assigned; Admin sees all)
// @route   GET /api/users/students
// @access  Protected (Trainer, Admin)
const getStudents = async (req, res, next) => {
  try {
    const query = { role: 'student', isActive: true };

    if (req.user.role === 'trainer') {
      // Trainer strictly scoped to students explicitly assigned to them
      query.assignedTrainer = req.user._id;
    }
    // Admin sees all active students without assignedTrainer constraint

    const students = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a user's role (Admin only)
// @route   PATCH /api/users/:id/role
// @access  Protected (Admin only)
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body || {};

    // Fail-safe check: ADMIN_EMAIL must exist in environment
    const primaryAdminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    if (!primaryAdminEmail) {
      return res.status(500).json({
        success: false,
        status: 500,
        message:
          'Configuration Error: ADMIN_EMAIL is not configured. Role modifications are temporarily locked.',
      });
    }

    // Validate ID format to prevent unhandled CastError
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid user ID format',
      });
    }

    const allowedRoles = ['student', 'trainer', 'admin'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: `Invalid role specified. Permitted roles are: ${allowedRoles.join(', ')}`,
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'User not found',
      });
    }

    // Primary Admin Protection: Cannot demote the primary admin account
    if (
      targetUser.email.toLowerCase() === primaryAdminEmail &&
      role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        status: 403,
        message:
          'Access forbidden: The primary Administrator account cannot be demoted or re-assigned.',
      });
    }

    // Prevent Admin self-demotion lockout
    if (req.user._id.toString() === targetUser._id.toString() && role !== 'admin') {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: Administrators cannot demote their own account.',
      });
    }

    targetUser.role = role;
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: `User role updated to '${role}' successfully`,
      data: targetUser,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudents,
  updateUserRole,
};
