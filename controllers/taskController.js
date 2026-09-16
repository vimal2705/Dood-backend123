const Task = require('../models/Task');
const Action = require('../models/Action');
const Dream = require('../models/Dream');
const Note = require('../models/Note');
const { validationResult } = require('express-validator');
const { asId, syncDreamProgress } = require('../utils/dreamProgress');

const startOfDay = (date = new Date()) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const todayAtHour = (hour = 18) => {
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  return next;
};

const isSameCalendarDay = (left, right) => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return startOfDay(left).getTime() === startOfDay(right).getTime();
};

const carryOverMissedTasks = async (userId) => {
  const missed = await Task.find({
    userId,
    isCompleted: false,
    dueDate: { $ne: null, $lt: startOfDay() },
  }).setOptions({ _recursed: true });

  if (!missed.length) {
    return;
  }

  const movedTo = todayAtHour(18);
  await Promise.all(
    missed.map((task) => {
      if (!task.missedFrom) {
        task.missedFrom = task.dueDate;
      }
      task.dueDate = movedTo;
      return task.save();
    }),
  );
};

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
exports.createTask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, priority, dueDate, actionId, dreamId, estimatedTime } = req.body;

    // Verify action belongs to user (if provided)
    if (actionId) {
      const action = await Action.findOne({ _id: actionId, userId: req.user.id });
      if (!action) {
        return res.status(404).json({ success: false, message: 'Action not found or does not belong to you' });
      }
    }

    // Verify dream belongs to user (if provided)
    if (dreamId) {
      const dream = await Dream.findOne({ _id: dreamId, userId: req.user.id });
      if (!dream) {
        return res.status(404).json({ success: false, message: 'Dream not found or does not belong to you' });
      }
    }

    // If actionId is provided, override dreamId with action's dreamId (if it has one)
    let finalDreamId = dreamId;
    if (actionId) {
      const action = await Action.findById(actionId);
      if (action.dreamId) {
        finalDreamId = action.dreamId;
      }
    }

    const task = new Task({
      userId: req.user.id,
      title,
      description,
      priority: priority || 'medium',
      dueDate,
      actionId: actionId || null,
      dreamId: finalDreamId || null,
      estimatedTime,
    });

    await task.save();
    await task.populate(['actionId', 'dreamId']);
    await syncDreamProgress(
      req.user.id,
      asId(task.dreamId) || asId(task.actionId?.dreamId),
    );

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all tasks for a user
// @route   GET /api/tasks
// @access  Private
exports.getAllTasks = async (req, res) => {
  try {
    await carryOverMissedTasks(req.user.id);
    const { isCompleted, priority, actionId, dreamId, sortBy } = req.query;

    // Build filter object
    const filter = { userId: req.user.id };

    if (isCompleted !== undefined) {
      filter.isCompleted = isCompleted === 'true';
    }
    if (priority) {
      filter.priority = priority;
    }
    if (actionId) {
      filter.actionId = actionId;
    }
    if (dreamId) {
      filter.dreamId = dreamId;
    }

    // Build sort object
    let sortObject = { dueDate: 1, createdAt: -1 }; // Default: by due date
    if (sortBy) {
      switch (sortBy) {
        case 'priority':
          sortObject = { priority: 1 };
          break;
        case 'dueDate':
          sortObject = { dueDate: 1 };
          break;
        case 'completed':
          sortObject = { isCompleted: 1 };
          break;
        case 'newest':
          sortObject = { createdAt: -1 };
          break;
        default:
          sortObject = { dueDate: 1, createdAt: -1 };
      }
    }

    const tasks = await Task.find(filter)
      .sort(sortObject)
      .populate('actionId', 'title priority status')
      .populate('dreamId', 'title subTitle priority status');

    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single task by ID
// @route   GET /api/tasks/:id
// @access  Private
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.id,
    })
      .populate('actionId', 'title priority status')
      .populate('dreamId', 'title subTitle priority status');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get tasks for specific action
// @route   GET /api/tasks/action/:actionId
// @access  Private
exports.getTasksByAction = async (req, res) => {
  try {
    const { actionId } = req.params;

    // Verify action belongs to user
    const action = await Action.findOne({ _id: actionId, userId: req.user.id });
    if (!action) {
      return res.status(404).json({ success: false, message: 'Action not found' });
    }

    const tasks = await Task.find({ actionId, userId: req.user.id })
      .sort({ dueDate: 1 })
      .populate('dreamId', 'title subTitle');

    res.status(200).json({
      success: true,
      count: tasks.length,
      actionTitle: action.title,
      tasks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get tasks for specific dream
// @route   GET /api/tasks/dream/:dreamId
// @access  Private
exports.getTasksByDream = async (req, res) => {
  try {
    const { dreamId } = req.params;

    // Verify dream belongs to user
    const dream = await Dream.findOne({ _id: dreamId, userId: req.user.id });
    if (!dream) {
      return res.status(404).json({ success: false, message: 'Dream not found' });
    }

    const tasks = await Task.find({ dreamId, userId: req.user.id })
      .sort({ dueDate: 1 })
      .populate('actionId', 'title priority status');

    res.status(200).json({
      success: true,
      count: tasks.length,
      dreamTitle: dream.title,
      tasks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
exports.updateTask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      title,
      description,
      priority,
      dueDate,
      dateChangeReason,
      actionId,
      dreamId,
      estimatedTime,
      timeSpent,
    } = req.body;

    // Find task
    let task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // If actionId is being changed, verify new action belongs to user
    if (actionId && actionId !== task.actionId?.toString()) {
      const action = await Action.findOne({ _id: actionId, userId: req.user.id });
      if (!action) {
        return res.status(404).json({ success: false, message: 'Action not found or does not belong to you' });
      }
    }

    // If dreamId is being changed, verify new dream belongs to user
    if (dreamId && dreamId !== task.dreamId?.toString()) {
      const dream = await Dream.findOne({ _id: dreamId, userId: req.user.id });
      if (!dream) {
        return res.status(404).json({ success: false, message: 'Dream not found or does not belong to you' });
      }
    }

    // Update fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) {
      const nextDue = dueDate ? new Date(dueDate) : null;
      const dateMoved = !isSameCalendarDay(task.dueDate, nextDue);
      if (dateMoved) {
        const reason = String(dateChangeReason || "").trim();
        if (reason.length < 3) {
          return res.status(400).json({
            success: false,
            message: "Say why you are moving this to-do",
          });
        }
        task.dateChanges.push({
          from: task.dueDate || null,
          to: nextDue,
          reason,
          changedAt: new Date(),
        });
        if (task.dateChanges.length > 20) {
          task.dateChanges.splice(0, task.dateChanges.length - 20);
        }
        task.dateChangeReason = reason;
        task.missedFrom = null;
      }
      task.dueDate = nextDue;
    }
    if (actionId !== undefined) task.actionId = actionId || null;
    if (dreamId !== undefined) task.dreamId = dreamId || null;
    if (estimatedTime !== undefined) task.estimatedTime = estimatedTime;
    if (timeSpent !== undefined) task.timeSpent = timeSpent;

    await task.save();
    await task.populate(['actionId', 'dreamId']);
    await syncDreamProgress(
      req.user.id,
      asId(task.dreamId) || asId(task.actionId?.dreamId),
    );

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      task,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle task completion status
// @route   PUT /api/tasks/:id/toggle
// @access  Private
exports.toggleTaskCompletion = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Toggle completion
    task.isCompleted = !task.isCompleted;

    // Set or unset completion date
    if (task.isCompleted) {
      task.completedDate = new Date();
    } else {
      task.completedDate = null;
    }

    await task.save();
    await task.populate(['actionId', 'dreamId']);
    await syncDreamProgress(
      req.user.id,
      asId(task.dreamId) || asId(task.actionId?.dreamId),
    );

    res.status(200).json({
      success: true,
      message: `Task marked as ${task.isCompleted ? 'completed' : 'not completed'}`,
      task,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add time spent on task
// @route   PUT /api/tasks/:id/add-time
// @access  Private
exports.addTimeSpent = async (req, res) => {
  try {
    const { minutes } = req.body;

    if (!minutes || minutes < 0) {
      return res.status(400).json({ success: false, message: 'Please provide valid minutes' });
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $inc: { timeSpent: minutes } },
      { new: true, runValidators: true }
    ).populate(['actionId', 'dreamId']);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.status(200).json({
      success: true,
      message: `Added ${minutes} minutes to task`,
      task,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    await Note.deleteMany({
      userId: req.user.id,
      linkedType: 'task',
      linkedId: task._id,
    });
    await syncDreamProgress(
      req.user.id,
      asId(task.dreamId) || asId(task.actionId?.dreamId),
    );

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
      taskId: task._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get task statistics
// @route   GET /api/tasks/stats/summary
// @access  Private
exports.getTaskStats = async (req, res) => {
  try {
    await carryOverMissedTasks(req.user.id);
    const tasks = await Task.find({ userId: req.user.id });

    const stats = {
      totalTasks: tasks.length,
      completedTasks: 0,
      incompleteTasks: 0,
      byPriority: {},
      standalone: 0,
      linkedToAction: 0,
      linkedToDream: 0,
      totalTimeSpent: 0,
      averageTimePerTask: 0,
      overdue: 0,
      dueSoon: 0,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    tasks.forEach((task) => {
      if (task.isCompleted) {
        stats.completedTasks++;
      } else {
        stats.incompleteTasks++;
      }

      // Count by priority
      stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;

      // Count by link type
      if (task.actionId) {
        stats.linkedToAction++;
      } else if (task.dreamId) {
        stats.linkedToDream++;
      } else {
        stats.standalone++;
      }

      // Sum time spent
      stats.totalTimeSpent += task.timeSpent;

      // Count overdue and due soon
      if (task.dueDate && !task.isCompleted) {
        const dueDate = new Date(task.dueDate);
        if (dueDate < today) {
          stats.overdue++;
        } else if (dueDate <= nextWeek) {
          stats.dueSoon++;
        }
      }
    });

    // Calculate average time
    if (tasks.length > 0) {
      stats.averageTimePerTask = Math.round(stats.totalTimeSpent / tasks.length);
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
