const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { calculateLoginStreak } = require('../utils/streakCalculator');

const generateToken = (id, role, customExpiry) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Server configuration error: JWT_SECRET is not configured');
  }
  return jwt.sign(
    { id, role },
    secret,
    { expiresIn: customExpiry !== undefined ? customExpiry : (process.env.JWT_EXPIRES_IN || '7d') }
  );
};

// @desc    Register a new student
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      targetRole,
      targetTimeline,
      currentSkillLevel,
      focusSkills,
      preferredLanguage,
    } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Please provide a valid non-empty name',
      });
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Please provide a valid email address',
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Please provide a valid email address',
      });
    }

    if (!password || typeof password !== 'string' || password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Password must be at least 6 non-whitespace characters long',
      });
    }

    if (focusSkills !== undefined) {
      if (
        !Array.isArray(focusSkills) ||
        focusSkills.length === 0 ||
        !focusSkills.every((s) => typeof s === 'string' && s.trim().length > 0)
      ) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: 'focusSkills must be an array of non-empty strings',
        });
      }
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'User already exists with this email',
      });
    }

    // Role is strictly forced to 'student' for public self-registration
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'student',
      preferredLanguage: preferredLanguage === 'hinglish' ? 'hinglish' : 'en',
      careerProfile: {
        targetRole: typeof targetRole === 'string' && targetRole.trim() ? targetRole.trim() : 'Full Stack Developer',
        targetTimeline: typeof targetTimeline === 'string' && targetTimeline.trim() ? targetTimeline.trim() : '3 months',
        currentSkillLevel: ['beginner', 'intermediate', 'advanced'].includes(currentSkillLevel)
          ? currentSkillLevel
          : 'beginner',
        focusSkills: Array.isArray(focusSkills) && focusSkills.length > 0
          ? focusSkills.map((s) => s.trim())
          : ['JavaScript', 'React', 'Node.js', 'MongoDB'],
      },
      gamification: {
        xp: 0,
        level: 1,
        streakCount: 1,
        lastActiveDate: new Date(),
      },
    });

    await user.save();

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      token,
      user,
    });
  } catch (error) {
    // Handle concurrent duplicate email race condition
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'User already exists with this email',
      });
    }
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Please provide both email and password',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Explicitly select password since schema has select: false
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Production streak calculation strictly uses server's current date
    const streakResult = calculateLoginStreak(
      user.gamification.lastActiveDate,
      user.gamification.streakCount
    );

    user.gamification.streakCount = streakResult.streakCount;
    user.gamification.lastActiveDate = streakResult.updatedActiveDate;
    await user.save();

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Protected
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update student career profile and preferences
// @route   PUT /api/auth/profile
// @access  Protected
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'User not found',
      });
    }

    const {
      name,
      preferredLanguage,
      targetRole,
      targetTimeline,
      currentSkillLevel,
      focusSkills,
    } = req.body;

    if (name) user.name = name.trim();
    if (preferredLanguage && ['en', 'hinglish'].includes(preferredLanguage)) {
      user.preferredLanguage = preferredLanguage;
    }

    if (!user.careerProfile) {
      user.careerProfile = {};
    }

    if (targetRole !== undefined) {
      user.careerProfile.targetRole = typeof targetRole === 'string' ? targetRole.trim() : '';
    }
    if (targetTimeline) user.careerProfile.targetTimeline = targetTimeline;
    if (currentSkillLevel && ['beginner', 'intermediate', 'advanced'].includes(currentSkillLevel)) {
      user.careerProfile.currentSkillLevel = currentSkillLevel;
    }
    if (Array.isArray(focusSkills)) {
      user.careerProfile.focusSkills = focusSkills;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  generateToken,
};
