const mongoose = require('mongoose');
const Question = require('../models/Question');

// @desc    Create a new question
// @route   POST /api/questions
// @access  Protected (Trainer, Admin)
const createQuestion = async (req, res, next) => {
  try {
    const {
      targetRole,
      topic,
      subtopic,
      difficulty,
      type,
      content,
      options,
      correctAnswer,
      tags,
    } = req.body || {};

    // Basic type and content validation
    if (!topic || !['JavaScript', 'React', 'Node.js', 'MongoDB'].includes(topic)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid or missing topic. Allowed topics: JavaScript, React, Node.js, MongoDB',
      });
    }

    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid or missing difficulty. Allowed: easy, medium, hard',
      });
    }

    if (!type || !['mcq', 'text'].includes(type)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid or missing type. Allowed: mcq, text',
      });
    }

    if (!content?.en?.question || typeof content.en.question !== 'string' || !content.en.question.trim()) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'English question content is required',
      });
    }

    if (!correctAnswer || typeof correctAnswer !== 'string' || !correctAnswer.trim()) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'correctAnswer or reference answer rubric is required',
      });
    }

    // MCQ specific validation
    if (type === 'mcq') {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: 'MCQ questions must provide at least 2 options',
        });
      }

      const optionIds = options.map((opt) => opt.id);
      const uniqueIds = new Set(optionIds);
      if (uniqueIds.size !== optionIds.length) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: 'All option IDs must be unique',
        });
      }

      if (!optionIds.includes(correctAnswer.trim())) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: `correctAnswer must match one of the option IDs (${optionIds.join(', ')})`,
        });
      }

      const hasInvalidText = options.some(
        (opt) => !opt.text?.en || typeof opt.text.en !== 'string' || !opt.text.en.trim()
      );
      if (hasInvalidText) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: 'All options must have non-empty English text',
        });
      }
    }

    const question = new Question({
      targetRole: targetRole?.trim() || 'Full Stack Developer',
      topic,
      subtopic: subtopic?.trim() || 'General',
      difficulty,
      type,
      content: {
        en: {
          question: content.en.question.trim(),
          explanation: content.en.explanation ? content.en.explanation.trim() : '',
        },
        hinglish: {
          question: content.hinglish?.question ? content.hinglish.question.trim() : '',
          explanation: content.hinglish?.explanation ? content.hinglish.explanation.trim() : '',
        },
      },
      options: type === 'mcq' ? options : [],
      correctAnswer: correctAnswer.trim(),
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
      createdBy: req.user._id,
    });

    await question.save();

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get questions with filtering and pagination
// @route   GET /api/questions
// @access  Protected (Trainer, Admin)
const getQuestions = async (req, res, next) => {
  try {
    const { topic, difficulty, type, isActive, search, page = 1, limit = 20 } = req.query;

    const query = {};

    if (topic) query.topic = topic;
    if (difficulty) query.difficulty = difficulty;
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { 'content.en.question': searchRegex },
        { 'content.hinglish.question': searchRegex },
        { subtopic: searchRegex },
        { tags: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Default: exclude correctAnswer for security
    const [questions, totalCount] = await Promise.all([
      Question.find(query)
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Question.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: questions.length,
      total: totalCount,
      page: pageNum,
      pages: Math.ceil(totalCount / limitNum) || 1,
      data: questions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single question by ID
// @route   GET /api/questions/:id
// @access  Protected (Trainer, Admin)
const getQuestionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid question ID format',
      });
    }

    // Admins and question creator can view with correctAnswer selected
    const query = Question.findById(id).populate('createdBy', 'name email role');
    const question = await query.select('+correctAnswer');

    if (!question) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Question not found',
      });
    }

    question._includeAnswerInJSON = true;

    res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a question
// @route   PUT /api/questions/:id
// @access  Protected (Trainer [own only], Admin)
const updateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid question ID format',
      });
    }

    const question = await Question.findById(id).select('+correctAnswer');
    if (!question) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Question not found',
      });
    }

    // Trainers can only update questions they personally created
    if (req.user.role === 'trainer' && question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: Trainers can only edit questions they created',
      });
    }

    const {
      topic,
      subtopic,
      difficulty,
      type,
      content,
      options,
      correctAnswer,
      tags,
      isActive,
    } = req.body || {};

    if (topic && ['JavaScript', 'React', 'Node.js', 'MongoDB'].includes(topic)) {
      question.topic = topic;
    }
    if (subtopic) question.subtopic = subtopic.trim();
    if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
      question.difficulty = difficulty;
    }
    if (type && ['mcq', 'text'].includes(type)) {
      question.type = type;
    }

    if (content?.en?.question) question.content.en.question = content.en.question.trim();
    if (content?.en?.explanation !== undefined) question.content.en.explanation = content.en.explanation.trim();
    if (content?.hinglish?.question !== undefined) question.content.hinglish.question = content.hinglish.question.trim();
    if (content?.hinglish?.explanation !== undefined) question.content.hinglish.explanation = content.hinglish.explanation.trim();

    if (options && Array.isArray(options)) {
      question.options = options;
    }

    if (correctAnswer) {
      question.correctAnswer = correctAnswer.trim();
    }

    if (tags && Array.isArray(tags)) {
      question.tags = tags.map((t) => String(t).trim()).filter(Boolean);
    }

    if (isActive !== undefined) {
      question.isActive = Boolean(isActive);
    }

    await question.save();

    res.status(200).json({
      success: true,
      message: 'Question updated successfully',
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle or set question active status
// @route   PATCH /api/questions/:id/status
// @access  Protected (Trainer [own only], Admin)
const toggleQuestionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid question ID format',
      });
    }

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Question not found',
      });
    }

    if (req.user.role === 'trainer' && question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: Trainers can only alter status of questions they created',
      });
    }

    if (req.body && req.body.isActive !== undefined) {
      question.isActive = Boolean(req.body.isActive);
    } else {
      question.isActive = !question.isActive;
    }

    await question.save();

    res.status(200).json({
      success: true,
      message: `Question status updated to ${question.isActive ? 'active' : 'inactive'}`,
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  toggleQuestionStatus,
};
