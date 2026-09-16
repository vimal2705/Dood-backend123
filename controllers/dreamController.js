const Dream = require('../models/Dream');
const Action = require('../models/Action');
const Task = require('../models/Task');
const Idea = require('../models/Idea');
const Note = require('../models/Note');
const MoneyEntry = require('../models/MoneyEntry');
const { validationResult } = require('express-validator');
const { sanitizePoints } = require('../utils/points');
const { syncAllDreamProgress, syncDreamProgress } = require('../utils/dreamProgress');

// @desc    Create a new dream
// @route   POST /api/dreams
// @access  Private
exports.createDream = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, subTitle, description, image, priority, type, status, targetDate, targetAmount, points } = req.body;

    // Check if priority is "top" and user already has a "top" dream
    if (priority === 'top') {
      const existingTopDream = await Dream.findOne({ userId: req.user.id, priority: 'top' });
      if (existingTopDream) {
        return res.status(400).json({
          success: false,
          message: 'You can only have one dream with "top" priority',
        });
      }
    }

    const dream = new Dream({
      userId: req.user.id,
      title,
      subTitle,
      description,
      image,
      priority: priority || 'medium',
      type,
      status: status || 'in progress',
      targetDate,
      targetAmount:
        type === "finance" && targetAmount !== undefined && targetAmount !== null && targetAmount !== ""
          ? Number(targetAmount)
          : null,
      points: sanitizePoints(points) || [],
    });

    await dream.save();

    res.status(201).json({
      success: true,
      message: 'Dream created successfully',
      dream,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all dreams for a user
// @route   GET /api/dreams
// @access  Private
exports.getAllDreams = async (req, res) => {
  try {
    const { type, status, priority, sortBy } = req.query;

    // Build filter object
    const filter = { userId: req.user.id };

    if (type) {
      filter.type = type;
    }
    if (status) {
      filter.status = status;
    }
    if (priority) {
      filter.priority = priority;
    }

    // Build sort object
    let sortObject = { createdAt: -1 }; // Default: newest first
    if (sortBy) {
      switch (sortBy) {
        case 'priority':
          sortObject = { priority: 1 };
          break;
        case 'timeline':
          sortObject = { timeline: -1 };
          break;
        case 'targetDate':
          sortObject = { targetDate: 1 };
          break;
        case 'progress':
          sortObject = { progress: -1 };
          break;
        default:
          sortObject = { createdAt: -1 };
      }
    }

    await syncAllDreamProgress(req.user.id);

    const dreams = await Dream.find(filter)
      .sort(sortObject)
      .populate('userId', 'name email');

    res.status(200).json({
      success: true,
      count: dreams.length,
      dreams,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single dream by ID
// @route   GET /api/dreams/:id
// @access  Private
exports.getDreamById = async (req, res) => {
  try {
    const dream = await Dream.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate('userId', 'name email');

    if (!dream) {
      return res.status(404).json({ success: false, message: 'Dream not found' });
    }

    res.status(200).json({
      success: true,
      dream,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update dream
// @route   PUT /api/dreams/:id
// @access  Private
exports.updateDream = async (req, res) => {
  try {
    const { title, subTitle, description, image, priority, type, status, targetDate, progress, targetAmount, points } = req.body;

    // Find dream
    let dream = await Dream.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!dream) {
      return res.status(404).json({ success: false, message: 'Dream not found' });
    }

    // If changing priority to "top", make sure no other dream has "top"
    if (priority === 'top' && dream.priority !== 'top') {
      const existingTopDream = await Dream.findOne({
        userId: req.user.id,
        priority: 'top',
        _id: { $ne: req.params.id },
      });
      if (existingTopDream) {
        return res.status(400).json({
          success: false,
          message: 'You can only have one dream with "top" priority',
        });
      }
    }

    // Update fields
    if (title !== undefined) dream.title = title;
    if (subTitle !== undefined) dream.subTitle = subTitle;
    if (description !== undefined) dream.description = description;
    if (image !== undefined) dream.image = image;
    if (priority !== undefined) dream.priority = priority;
    if (type !== undefined) dream.type = type;
    if (status !== undefined) dream.status = status;
    if (targetDate !== undefined) dream.targetDate = targetDate;
    if (targetAmount !== undefined) {
      dream.targetAmount =
        targetAmount === null || targetAmount === "" ? null : Number(targetAmount);
    }
    if (progress !== undefined) dream.progress = progress;
    if (points !== undefined) dream.points = sanitizePoints(points) || [];

    await dream.save();

    res.status(200).json({
      success: true,
      message: 'Dream updated successfully',
      dream,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete dream
// @route   DELETE /api/dreams/:id
// @access  Private
exports.deleteDream = async (req, res) => {
  try {
    const dream = await Dream.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!dream) {
      return res.status(404).json({ success: false, message: 'Dream not found' });
    }

    const actionIds = await Action.find({
      userId: req.user.id,
      dreamId: dream._id,
    }).distinct('_id');
    const taskIds = await Task.find({
      userId: req.user.id,
      $or: [{ dreamId: dream._id }, { actionId: { $in: actionIds } }],
    }).distinct('_id');
    const ideaIds = await Idea.find({
      userId: req.user.id,
      dreamId: dream._id,
    }).distinct('_id');

    await Promise.all([
      Action.deleteMany({ userId: req.user.id, dreamId: dream._id }),
      Task.deleteMany({ _id: { $in: taskIds }, userId: req.user.id }),
      Idea.deleteMany({ userId: req.user.id, dreamId: dream._id }),
      Note.deleteMany({
        userId: req.user.id,
        $or: [
          { linkedType: 'dream', linkedId: dream._id },
          { linkedType: 'action', linkedId: { $in: actionIds } },
          { linkedType: 'task', linkedId: { $in: taskIds } },
          { linkedType: 'idea', linkedId: { $in: ideaIds } },
        ],
      }),
      MoneyEntry.updateMany(
        { userId: req.user.id, dreamId: dream._id },
        { $set: { dreamId: null } },
      ),
    ]);

    res.status(200).json({
      success: true,
      message: 'Dream deleted successfully',
      dreamId: dream._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dreams statistics for user
// @route   GET /api/dreams/stats/summary
// @access  Private
exports.getDreamStats = async (req, res) => {
  try {
    const dreams = await Dream.find({ userId: req.user.id });

    const stats = {
      totalDreams: dreams.length,
      byType: {},
      byStatus: {},
      byPriority: {},
      averageProgress: 0,
    };

    let totalProgress = 0;

    dreams.forEach((dream) => {
      // Count by type
      stats.byType[dream.type] = (stats.byType[dream.type] || 0) + 1;

      // Count by status
      stats.byStatus[dream.status] = (stats.byStatus[dream.status] || 0) + 1;

      // Count by priority
      stats.byPriority[dream.priority] = (stats.byPriority[dream.priority] || 0) + 1;

      // Sum progress
      totalProgress += dream.progress;
    });

    // Calculate average progress
    if (dreams.length > 0) {
      stats.averageProgress = Math.round(totalProgress / dreams.length);
    }

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update dream progress
// @route   PATCH /api/dreams/:id/progress
// @access  Private
exports.updateDreamProgress = async (req, res) => {
  try {
    const dream = await syncDreamProgress(req.user.id, req.params.id);

    if (!dream) {
      return res.status(404).json({ success: false, message: 'Dream not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Dream progress updated',
      dream,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

