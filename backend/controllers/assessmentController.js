const crypto = require('crypto');
const mongoose = require('mongoose');
const Assessment = require('../models/Assessment');
const Question = require('../models/Question');
const User = require('../models/User');
const { evaluateTextAnswer } = require('../services/llm/evaluationService');
const { safeDispatchNotification } = require('../services/notificationService');

// @desc    Generate a new assessment for authenticated student
// @route   POST /api/assessments/generate
// @access  Protected (Student only)
const generateAssessment = async (req, res, next) => {
  try {
    let studentId = req.user._id;

    // Trainers and admins can generate/configure assessments for assigned students
    if (req.user.role === 'trainer' || req.user.role === 'admin') {
      if (req.body?.studentId) {
        if (!mongoose.Types.ObjectId.isValid(req.body.studentId)) {
          return res.status(400).json({
            success: false,
            status: 400,
            message: 'Invalid student ID format',
          });
        }
        const studentUser = await User.findOne({ _id: req.body.studentId, role: 'student', isActive: true });
        if (!studentUser) {
          return res.status(404).json({
            success: false,
            status: 404,
            message: 'Target student not found',
          });
        }
        if (req.user.role === 'trainer') {
          if (!studentUser.assignedTrainer || studentUser.assignedTrainer.toString() !== req.user._id.toString()) {
            return res.status(403).json({
              success: false,
              status: 403,
              message: 'Access forbidden: Student is not assigned to you',
            });
          }
        }
        studentId = studentUser._id;
      }
    }

    // Check if the student already has an active in-progress assessment
    const existingInProgress = await Assessment.findOne({
      student: studentId,
      status: 'in_progress',
    });

    if (existingInProgress) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'You already have an assessment in progress. Please complete or submit it before starting a new one.',
        assessmentId: existingInProgress._id,
      });
    }

    const {
      targetRole = 'Full Stack Developer',
      selectedTopics,
      questionCount = 10,
      difficulty = 'balanced',
      mode = 'mixed',
      languageMode = 'english',
    } = req.body || {};

    const validDifficulties = ['balanced', 'easy', 'medium', 'hard'];
    const chosenDifficulty = (difficulty || 'balanced').toLowerCase().trim();
    if (!validDifficulties.includes(chosenDifficulty)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: `Invalid difficulty calibration: '${difficulty}'. Permitted values are: ${validDifficulties.join(', ')}`,
      });
    }

    const validModes = ['mcq', 'text', 'mixed'];
    if (mode && !validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: `Invalid assessment mode: '${mode}'. Permitted modes are: ${validModes.join(', ')}`,
      });
    }
    const chosenMode = mode || 'mixed';

    const validLanguageModes = ['english', 'hinglish', 'flexible'];
    const chosenLanguageMode = (languageMode || 'english').toLowerCase().trim();
    if (!validLanguageModes.includes(chosenLanguageMode)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: `Invalid language mode: '${languageMode}'. Permitted language modes are: ${validLanguageModes.join(', ')}`,
      });
    }

    const validTopics = ['JavaScript', 'React', 'Node.js', 'MongoDB'];
    if (!Array.isArray(selectedTopics) || selectedTopics.length === 0) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'selectedTopics must be a non-empty array of topics (JavaScript, React, Node.js, MongoDB)',
      });
    }

    const invalidTopics = selectedTopics.filter((t) => !validTopics.includes(t));
    if (invalidTopics.length > 0) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: `Invalid topic(s): ${invalidTopics.join(', ')}. Permitted: ${validTopics.join(', ')}`,
      });
    }

    const requestedCount = Math.min(25, Math.max(3, parseInt(questionCount, 10) || 10));

    // Fetch candidate active questions filtered by mode (mcq / text / mixed)
    const questionFilter = {
      targetRole: targetRole.trim(),
      topic: { $in: selectedTopics },
      isActive: true,
    };
    if (chosenMode === 'mcq') {
      questionFilter.type = 'mcq';
    } else if (chosenMode === 'text') {
      questionFilter.type = 'text';
    }

    const candidateQuestions = await Question.find(questionFilter).select('+correctAnswer');
    const modeLabel = chosenMode === 'mcq' ? 'MCQ ' : chosenMode === 'text' ? 'text/descriptive ' : '';

    if (candidateQuestions.length < requestedCount) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: `Not enough active ${modeLabel}questions available for selected topics. Available: ${candidateQuestions.length}, Requested: ${requestedCount}`,
        availableCount: candidateQuestions.length,
        requestedCount,
      });
    }

    // Sampling based on difficulty calibration
    let selectedQuestions = [];
    const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);

    if (chosenDifficulty === 'balanced') {
      const easyPool = candidateQuestions.filter((q) => q.difficulty === 'easy');
      const mediumPool = candidateQuestions.filter((q) => q.difficulty === 'medium');
      const hardPool = candidateQuestions.filter((q) => q.difficulty === 'hard');

      // Exact integer rounding for 40% Easy, 40% Medium, 20% Hard
      const targetEasy = Math.round(requestedCount * 0.40);
      const targetMedium = Math.round(requestedCount * 0.40);
      const targetHard = requestedCount - targetEasy - targetMedium;

      // Strict tier sufficiency verification: no silent substitution or mislabeling
      if (easyPool.length < targetEasy || mediumPool.length < targetMedium || hardPool.length < targetHard) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: `Unable to satisfy balanced difficulty distribution (40% Easy, 40% Medium, 20% Hard). Required: ${targetEasy} Easy, ${targetMedium} Medium, ${targetHard} Hard. Available in selected topic(s): ${easyPool.length} Easy, ${mediumPool.length} Medium, ${hardPool.length} Hard. Please select additional topics or lower the question count.`,
          requiredDistribution: { easy: targetEasy, medium: targetMedium, hard: targetHard },
          availableDistribution: { easy: easyPool.length, medium: mediumPool.length, hard: hardPool.length },
        });
      }

      const shuffledEasy = shuffle(easyPool);
      const shuffledMedium = shuffle(mediumPool);
      const shuffledHard = shuffle(hardPool);

      selectedQuestions.push(...shuffledEasy.slice(0, targetEasy));
      selectedQuestions.push(...shuffledMedium.slice(0, targetMedium));
      selectedQuestions.push(...shuffledHard.slice(0, targetHard));
    } else {
      // Strict filtering by requested difficulty - NEVER substitute from other tiers
      const filteredPool = candidateQuestions.filter((q) => q.difficulty === chosenDifficulty);
      if (filteredPool.length < requestedCount) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: `Not enough active ${modeLabel}${chosenDifficulty} questions available for selected topics. Available: ${filteredPool.length}, Requested: ${requestedCount}`,
          availableCount: filteredPool.length,
          requestedCount,
        });
      }
      selectedQuestions = shuffle(filteredPool).slice(0, requestedCount);
    }

    // Final shuffle so questions are interspersed across topics
    selectedQuestions.sort(() => Math.random() - 0.5);

    // Build immutable question snapshots
    let objectiveCount = 0;
    let subjectiveCount = 0;

    const questionSnapshots = selectedQuestions.map((q) => {
      if (q.type === 'mcq') objectiveCount++;
      if (q.type === 'text') subjectiveCount++;

      return {
        questionId: q._id,
        topic: q.topic,
        subtopic: q.subtopic || 'General',
        difficulty: q.difficulty,
        type: q.type,
        content: {
          en: {
            question: q.content.en.question,
            explanation: q.content.en.explanation || '',
          },
          hinglish: {
            question: q.content.hinglish?.question || '',
            explanation: q.content.hinglish?.explanation || '',
          },
        },
        options: q.type === 'mcq' ? q.options : [],
        correctAnswer: q.correctAnswer, // Securely snapshotted
        studentAnswer: null,
        isCorrect: null,
        evaluationStatus: 'pending_evaluation',
        pointsEarned: 0,
        maxPoints: 1,
      };
    });

    const assessment = new Assessment({
      student: studentId,
      targetRole: targetRole.trim(),
      selectedTopics,
      mode: chosenMode,
      languageMode: chosenLanguageMode,
      status: 'in_progress',
      questions: questionSnapshots,
      totalQuestions: questionSnapshots.length,
      objectiveQuestionsCount: objectiveCount,
      subjectiveQuestionsCount: subjectiveCount,
      scoring: {
        objectiveScore: 0,
        objectiveMaxScore: objectiveCount,
        objectivePercentage: 0,
        overallScore: 0,
        overallMaxScore: questionSnapshots.length,
        isFullyEvaluated: false,
      },
      topicWiseResults: [],
      weakTopics: [],
      startedAt: new Date(),
    });

    await assessment.save();

    // Mandatory Safeguard 1: Guarantee NO answer keys or explanations are leaked
    res.status(201).json({
      success: true,
      message: 'Assessment generated successfully',
      data: assessment.toSafeTakingJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get assessment by ID
// @route   GET /api/assessments/:id
// @access  Protected (Student [own], Trainer [assigned student only], Admin)
const getAssessmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid assessment ID format',
      });
    }

    const assessment = await Assessment.findById(id).select('+questions.correctAnswer');
    if (!assessment) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Assessment not found',
      });
    }

    // Populate student details to verify trainer assignment
    const studentUser = await User.findById(assessment.student).select('name email role assignedTrainer');
    if (!studentUser) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Associated student record not found',
      });
    }

    // Mandatory Safeguard 2: Role-based boundary enforcement
    if (req.user.role === 'student') {
      if (assessment.student.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          status: 403,
          message: 'Access forbidden: You can only access your own assessments',
        });
      }
    } else if (req.user.role === 'trainer') {
      // Unassigned students remain strictly inaccessible to trainers
      if (
        !studentUser.assignedTrainer ||
        studentUser.assignedTrainer.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          status: 403,
          message: 'Access forbidden: Trainer can only view assessments for assigned students',
        });
      }
    }
    // Admin access is universally authorized

    // Mandatory Safeguard 1: In-progress assessments must sanitize nested question snapshots
    if (assessment.status === 'in_progress') {
      return res.status(200).json({
        success: true,
        data: assessment.toSafeTakingJSON(),
      });
    }

    // For completed assessments, return full details
    res.status(200).json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit answers for an in-progress assessment
// @route   POST /api/assessments/:id/submit
// @access  Protected (Student [own only])
const submitAssessment = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid assessment ID format',
      });
    }

    // Verify ownership and existence before attempting atomic lock
    const existing = await Assessment.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Assessment not found',
      });
    }

    if (existing.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Access forbidden: You cannot submit an assessment belonging to another student',
      });
    }

    if (existing.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Assessment has already been submitted or completed',
      });
    }

    // Mandatory Safeguard 3: Atomic status transition to reject duplicate/concurrent submissions
    const lockedAssessment = await Assessment.findOneAndUpdate(
      { _id: id, student: req.user._id, status: 'in_progress' },
      { $set: { status: 'completed', completedAt: new Date() } },
      { returnDocument: 'after' }
    ).select('+questions.correctAnswer');

    if (!lockedAssessment) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Assessment has already been submitted or is being processed',
      });
    }

    // Normalize student submitted answers from body
    // Accepts array of { questionId, answer } or object dictionary { [questionId]: answer }
    const { answers } = req.body || {};
    const answerMap = new Map();

    if (Array.isArray(answers)) {
      answers.forEach((ans) => {
        if (ans && ans.questionId !== undefined) {
          answerMap.set(String(ans.questionId), String(ans.answer || '').trim());
        }
      });
    } else if (answers && typeof answers === 'object') {
      Object.entries(answers).forEach(([k, v]) => {
        answerMap.set(String(k), String(v || '').trim());
      });
    }

    // Evaluate answers
    let objectiveCorrectCount = 0;
    const topicStats = {};

    lockedAssessment.questions.forEach((q) => {
      const qId = q.questionId.toString();
      const submittedAns = answerMap.has(qId) ? answerMap.get(qId) : (q.studentAnswer || '');
      q.studentAnswer = submittedAns;

      // Initialize topic bucket
      if (!topicStats[q.topic]) {
        topicStats[q.topic] = {
          totalQuestions: 0,
          objectiveTotal: 0,
          objectiveCorrect: 0,
        };
      }
      topicStats[q.topic].totalQuestions += 1;

      if (q.type === 'mcq') {
        topicStats[q.topic].objectiveTotal += 1;
        const isMatch =
          submittedAns.toUpperCase() === String(q.correctAnswer || '').toUpperCase().trim();

        if (isMatch) {
          q.isCorrect = true;
          q.pointsEarned = 1;
          q.evaluationStatus = 'auto_evaluated';
          objectiveCorrectCount += 1;
          topicStats[q.topic].objectiveCorrect += 1;
        } else {
          q.isCorrect = false;
          q.pointsEarned = 0;
          q.evaluationStatus = 'auto_evaluated';
        }
      } else if (q.type === 'text') {
        // Text questions remain pending manual / future AI evaluation (Module 4 boundary)
        q.isCorrect = null;
        q.pointsEarned = 0;
        q.evaluationStatus = 'pending_evaluation';
      }
    });

    // Compute scoring totals
    const objectiveMax = lockedAssessment.objectiveQuestionsCount;
    const objectivePct = objectiveMax > 0 ? Math.round((objectiveCorrectCount / objectiveMax) * 100) : 0;
    const isFullyEvaluated = lockedAssessment.subjectiveQuestionsCount === 0;

    lockedAssessment.scoring = {
      objectiveScore: objectiveCorrectCount,
      objectiveMaxScore: objectiveMax,
      objectivePercentage: objectivePct,
      overallScore: objectiveCorrectCount,
      overallMaxScore: lockedAssessment.totalQuestions,
      isFullyEvaluated,
    };

    // Calculate topic-wise results and detect weak topics (< 60% objective accuracy)
    const topicWiseResults = [];
    const weakTopics = [];

    Object.entries(topicStats).forEach(([topicName, stats]) => {
      const topicPct =
        stats.objectiveTotal > 0
          ? Math.round((stats.objectiveCorrect / stats.objectiveTotal) * 100)
          : 0;

      const isWeak = stats.objectiveTotal > 0 && topicPct < 60;
      if (isWeak) {
        weakTopics.push(topicName);
      }

      topicWiseResults.push({
        topic: topicName,
        totalQuestions: stats.totalQuestions,
        objectiveCorrect: stats.objectiveCorrect,
        objectiveTotal: stats.objectiveTotal,
        percentage: topicPct,
        isWeakTopic: isWeak,
      });
    });

    lockedAssessment.topicWiseResults = topicWiseResults;
    lockedAssessment.weakTopics = weakTopics;

    await lockedAssessment.save();

    safeDispatchNotification({
      recipient: lockedAssessment.student,
      type: 'assessment_completed',
      title: 'Assessment Submitted',
      message: `Your assessment for ${lockedAssessment.targetRole} has been submitted successfully.`,
      data: {
        assessmentId: lockedAssessment._id,
        score: lockedAssessment.scoring?.overallPercentage || null,
      },
      idempotencyKey: `assessment_completed:${lockedAssessment._id}`,
    });

    res.status(200).json({
      success: true,
      message: 'Assessment submitted and evaluated successfully',
      data: lockedAssessment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get assessment results with explanations and weak topic diagnostic
// @route   GET /api/assessments/:id/results
// @access  Protected (Student [own], Trainer [assigned student only], Admin)
const getAssessmentResults = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid assessment ID format',
      });
    }

    const assessment = await Assessment.findById(id).select('+questions.correctAnswer');
    if (!assessment) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Assessment not found',
      });
    }

    // Populate student to check trainer boundary
    const studentUser = await User.findById(assessment.student).select('name email role assignedTrainer');
    if (!studentUser) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Associated student record not found',
      });
    }

    // Role-based boundary checks
    if (req.user.role === 'student') {
      if (assessment.student.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          status: 403,
          message: 'Access forbidden: You can only view results of your own assessments',
        });
      }
    } else if (req.user.role === 'trainer') {
      if (
        !studentUser.assignedTrainer ||
        studentUser.assignedTrainer.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          status: 403,
          message: 'Access forbidden: Trainer can only view results for assigned students',
        });
      }
    }

    if (assessment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Results are available only after assessment has been completed and submitted',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        assessmentId: assessment._id,
        targetRole: assessment.targetRole,
        selectedTopics: assessment.selectedTopics,
        mode: assessment.mode || 'mixed',
        languageMode: assessment.languageMode || 'english',
        completedAt: assessment.completedAt,
        scoring: assessment.scoring,
        topicWiseResults: assessment.topicWiseResults,
        weakTopics: assessment.weakTopics,
        questions: assessment.questions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all assessments for the authenticated student
// @route   GET /api/assessments/my
// @access  Protected (Student only)
const getMyAssessments = async (req, res, next) => {
  try {
    const assessments = await Assessment.find({ student: req.user._id })
      .sort({ createdAt: -1 });

    const safeAssessments = assessments.map((a) => {
      if (a.status === 'in_progress') {
        return a.toSafeTakingJSON();
      }
      return a;
    });

    res.status(200).json({
      success: true,
      count: safeAssessments.length,
      data: safeAssessments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Evaluate pending subjective text answers using AI
// @route   POST /api/assessments/:id/evaluate
// @access  Protected (Student [own], Trainer [assigned], Admin)
const evaluateAssessment = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: 'Invalid assessment ID format',
    });
  }

  try {
    const existing = await Assessment.findById(id).select('+questions.correctAnswer');
    if (!existing) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Assessment not found',
      });
    }

    if (existing.status !== 'completed') {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Only completed assessments can be evaluated',
      });
    }

    // Role-based boundary enforcement
    const studentUser = await User.findById(existing.student).select('name email role preferredLanguage assignedTrainer');
    if (!studentUser) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Associated student record not found',
      });
    }

    if (req.user.role === 'student') {
      if (existing.student.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          status: 403,
          message: 'Access forbidden: You can only evaluate your own assessments',
        });
      }
    } else if (req.user.role === 'trainer') {
      if (
        !studentUser.assignedTrainer ||
        studentUser.assignedTrainer.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          status: 403,
          message: 'Access forbidden: Trainer can only evaluate assigned students',
        });
      }
    }

    // Check if there are any unevaluated text questions
    const pendingQuestions = existing.questions.filter(
      (q) => q.type === 'text' && q.evaluationStatus === 'pending_evaluation'
    );

    if (pendingQuestions.length === 0) {
      safeDispatchNotification({
        recipient: existing.student,
        type: 'assessment_evaluated',
        title: 'Assessment Evaluation Ready',
        message: `Evaluation completed for your ${existing.targetRole} assessment. Final score: ${existing.scoring?.overallPercentage || 0}%.`,
        data: {
          assessmentId: existing._id,
          score: existing.scoring?.overallPercentage || null,
        },
        idempotencyKey: `assessment_evaluated:${existing._id}:${existing.scoring?.isFullyEvaluated ? 'final' : 'partial'}`,
      });

      return res.status(200).json({
        success: true,
        message: 'Assessment has no pending questions requiring evaluation',
        evaluatedCount: 0,
        failedCount: 0,
        isFullyEvaluated: existing.scoring.isFullyEvaluated,
        data: existing,
      });
    }

    // Concurrency Lock: Atomically set isEvaluating = true with unique ownership token
    const lockToken = crypto.randomUUID();
    const lockedAssessment = await Assessment.findOneAndUpdate(
      { _id: id, status: 'completed', isEvaluating: false },
      { $set: { isEvaluating: true, evaluationLockToken: lockToken, lockedAt: new Date() } },
      { returnDocument: 'after' }
    ).select('+questions.correctAnswer');

    if (!lockedAssessment) {
      const checkState = await Assessment.findById(id);
      if (checkState?.isEvaluating) {
        return res.status(409).json({
          success: false,
          status: 409,
          message: 'Evaluation is already in progress for this assessment. Please wait.',
        });
      }
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Assessment cannot be evaluated in its current state',
      });
    }

    let evaluatedCount = 0;
    let failedCount = 0;
    const evaluationErrors = [];
    let mockResponsesList = Array.isArray(req.body?.mockResponses) ? [...req.body.mockResponses] : null;

    try {
      // Evaluate each pending text question with partial-progress preservation
      for (const q of lockedAssessment.questions) {
        if (q.type !== 'text' || q.evaluationStatus === 'ai_evaluated') {
          continue; // Skip MCQ or already evaluated text answers
        }

        try {
          let transport = req.body?.transportOverride || req._transportOverride;
          if (!transport && mockResponsesList && mockResponsesList.length > 0) {
            const nextMock = mockResponsesList.shift();
            transport = async () => {
              if (nextMock && nextMock.error) {
                throw new Error(nextMock.error);
              }
              return typeof nextMock === 'string' ? nextMock : JSON.stringify(nextMock);
            };
          } else if (!transport && req.body?.mockResponse) {
            transport = async () =>
              typeof req.body.mockResponse === 'string'
                ? req.body.mockResponse
                : JSON.stringify(req.body.mockResponse);
          }

          const activeLanguageMode = lockedAssessment.languageMode || 'english';

          const evalResult = await evaluateTextAnswer({
            questionText: q.content?.en?.question || '',
            rubricReference: q.correctAnswer || '',
            studentAnswer: q.studentAnswer || '',
            languageMode: activeLanguageMode,
            preferredLanguage: activeLanguageMode,
            topic: q.topic || 'General',
            maxPoints: q.maxPoints || 1,
            transportOverride: transport,
            providerOverride: req.body?.providerOverride,
          });

          q.aiEvaluation = {
            score: evalResult.score,
            rawScore: evalResult.rawScore,
            percentage: evalResult.percentage,
            rawPercentage: evalResult.rawPercentage,
            languageMismatch: evalResult.languageMismatch,
            languagePenalty: evalResult.languagePenalty,
            detectedLanguage: evalResult.detectedLanguage,
            languageWarning: evalResult.languageWarning,
            rubricBreakdown: evalResult.rubricBreakdown,
            feedback: evalResult.feedback,
            strengths: evalResult.strengths,
            weaknesses: evalResult.weaknesses,
            suggestions: evalResult.suggestions,
            evaluatedLanguage: evalResult.evaluatedLanguage,
            modelUsed: evalResult.modelUsed,
            evaluatedAt: evalResult.evaluatedAt,
          };

          q.pointsEarned = evalResult.pointsEarned;
          q.isCorrect = evalResult.isCorrect;
          q.evaluationStatus = 'ai_evaluated';
          evaluatedCount++;
        } catch (err) {
          failedCount++;
          evaluationErrors.push({
            questionId: q.questionId,
            topic: q.topic,
            error: err.message,
          });
          // Preserve failed question as pending_evaluation for retry
        }
      }

      // Recalculate scoring aggregates using exact approved formulas
      let subjectivePoints = 0;
      let subjectiveEvalMax = 0;
      let subjectiveTotalMax = 0;

      lockedAssessment.questions.forEach((q) => {
        if (q.type === 'text') {
          subjectiveTotalMax += q.maxPoints || 1;
          if (q.evaluationStatus === 'ai_evaluated') {
            subjectivePoints += q.pointsEarned || 0;
            subjectiveEvalMax += q.maxPoints || 1;
          }
        }
      });

      subjectivePoints = Math.round(subjectivePoints * 100) / 100;
      const subjectivePercentage =
        subjectiveEvalMax > 0
          ? Math.round((subjectivePoints / subjectiveEvalMax) * 100)
          : 0;

      const objectiveScore = lockedAssessment.scoring.objectiveScore || 0;
      const objectiveMaxScore = lockedAssessment.scoring.objectiveMaxScore || 0;

      const overallScore = Math.round((objectiveScore + subjectivePoints) * 100) / 100;
      const overallEvaluatedMax = objectiveMaxScore + subjectiveEvalMax;
      const overallMaxScore = objectiveMaxScore + subjectiveTotalMax;
      const overallPercentage =
        overallEvaluatedMax > 0
          ? Math.round((overallScore / overallEvaluatedMax) * 100)
          : 0;

      // Robust isFullyEvaluated allowlist check across all terminal statuses
      const VALID_EVALUATED_STATUSES = ['auto_evaluated', 'ai_evaluated', 'manual_evaluated'];
      const isFullyEvaluated =
        lockedAssessment.questions.length > 0 &&
        lockedAssessment.questions.every(
          (q) => VALID_EVALUATED_STATUSES.includes(q.evaluationStatus) && q.pointsEarned !== null
        );

      // Recalculate topic-wise diagnostics
      const topicStats = {};
      lockedAssessment.questions.forEach((q) => {
        if (!topicStats[q.topic]) {
          topicStats[q.topic] = {
            totalQuestions: 0,
            objectiveCorrect: 0,
            objectiveTotal: 0,
            subjectivePoints: 0,
            subjectiveEvalMax: 0,
          };
        }
        topicStats[q.topic].totalQuestions += 1;
        if (q.type === 'mcq') {
          topicStats[q.topic].objectiveTotal += q.maxPoints || 1;
          if (q.isCorrect) {
            topicStats[q.topic].objectiveCorrect += q.pointsEarned || 1;
          }
        } else if (q.type === 'text' && q.evaluationStatus === 'ai_evaluated') {
          topicStats[q.topic].subjectiveEvalMax += q.maxPoints || 1;
          topicStats[q.topic].subjectivePoints += q.pointsEarned || 0;
        }
      });

      const topicWiseResults = [];
      const weakTopics = [];

      Object.entries(topicStats).forEach(([topicName, stats]) => {
        const evalEarned = stats.objectiveCorrect + stats.subjectivePoints;
        const evalMax = stats.objectiveTotal + stats.subjectiveEvalMax;
        const topicPct = evalMax > 0 ? Math.round((evalEarned / evalMax) * 100) : 0;
        const isWeak = evalMax > 0 && topicPct < 60;

        if (isWeak) {
          weakTopics.push(topicName);
        }

        topicWiseResults.push({
          topic: topicName,
          totalQuestions: stats.totalQuestions,
          objectiveCorrect: stats.objectiveCorrect,
          objectiveTotal: stats.objectiveTotal,
          percentage: topicPct,
          isWeakTopic: isWeak,
        });
      });

      // Commit changes to database
      lockedAssessment.scoring.subjectiveScore = subjectivePoints;
      lockedAssessment.scoring.subjectiveMaxScore = subjectiveTotalMax;
      lockedAssessment.scoring.subjectivePercentage = subjectivePercentage;
      lockedAssessment.scoring.overallScore = overallScore;
      lockedAssessment.scoring.overallMaxScore = overallMaxScore;
      lockedAssessment.scoring.overallPercentage = overallPercentage;
      lockedAssessment.scoring.isFullyEvaluated = isFullyEvaluated;

      lockedAssessment.topicWiseResults = topicWiseResults;
      lockedAssessment.weakTopics = weakTopics;

      await lockedAssessment.save();

      // Release lock atomically matching this exact request's lockToken
      await Assessment.findOneAndUpdate(
        { _id: id, evaluationLockToken: lockToken },
        { $set: { isEvaluating: false, evaluationLockToken: null, lockedAt: null } }
      );

      // Clean local in-memory representation for response
      lockedAssessment.isEvaluating = false;
      lockedAssessment.evaluationLockToken = null;
      lockedAssessment.lockedAt = null;

      safeDispatchNotification({
        recipient: lockedAssessment.student,
        type: 'assessment_evaluated',
        title: 'Assessment Evaluation Ready',
        message: `Evaluation completed for your ${lockedAssessment.targetRole} assessment. Final score: ${lockedAssessment.scoring?.overallPercentage || 0}%.`,
        data: {
          assessmentId: lockedAssessment._id,
          score: lockedAssessment.scoring?.overallPercentage || null,
        },
        idempotencyKey: `assessment_evaluated:${lockedAssessment._id}:${lockedAssessment.scoring?.isFullyEvaluated ? 'final' : 'partial'}`,
      });

      // Case 1: Complete failure (all attempted evaluations failed)
      if (evaluatedCount === 0 && failedCount > 0) {
        const primaryError = evaluationErrors[0]?.error || 'Upstream AI evaluation service unavailable';
        return res.status(502).json({
          success: false,
          status: 502,
          message: `AI evaluation failed: ${primaryError}. Your submitted answers have been preserved. Please retry shortly.`,
          evaluatedCount: 0,
          failedCount,
          isFullyEvaluated: false,
          errors: evaluationErrors,
          data: lockedAssessment,
        });
      }

      // Case 2: Partial success (some evaluated, some failed)
      if (evaluatedCount > 0 && failedCount > 0) {
        return res.status(200).json({
          success: true,
          partial: true,
          message: `Partial evaluation completed: ${evaluatedCount} answer(s) evaluated; ${failedCount} answer(s) failed and remain pending for retry.`,
          evaluatedCount,
          failedCount,
          isFullyEvaluated: false,
          errors: evaluationErrors,
          data: lockedAssessment,
        });
      }

      // Case 3: Complete success
      res.status(200).json({
        success: true,
        message: 'Assessment evaluated successfully',
        evaluatedCount,
        failedCount: 0,
        isFullyEvaluated,
        errors: [],
        data: lockedAssessment,
      });
    } finally {
      // Guaranteed lock release matching this exact token, preventing an old request from clearing another's lock
      if (lockToken) {
        await Assessment.findOneAndUpdate(
          { _id: id, evaluationLockToken: lockToken },
          { $set: { isEvaluating: false, evaluationLockToken: null, lockedAt: null } }
        );
      }
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateAssessment,
  getAssessmentById,
  submitAssessment,
  getAssessmentResults,
  getMyAssessments,
  evaluateAssessment,
};
