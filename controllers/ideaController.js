const Idea = require('../models/Idea');
const Dream = require('../models/Dream');
const Action = require('../models/Action');
const Task = require('../models/Task');
const { toObjectId } = require('../utils/ids');
const { syncDreamProgress } = require('../utils/dreamProgress');

// Create a new idea
exports.createIdea = async (req, res) => {
  try {
    const { title, description, dreamId, priority, status, tags, category } = req.body;

    // Validate dreamId if provided
    if (dreamId) {
      const dream = await Dream.findOne({ _id: dreamId, userId: req.user.id });
      if (!dream) {
        return res.status(404).json({
          success: false,
          message: 'Dream not found or does not belong to current user'
        });
      }
    }

    const idea = new Idea({
      userId: req.user.id,
      title,
      description,
      dreamId: dreamId || null,
      priority: priority || 'medium',
      status: status || 'active',
      tags: tags || [],
      category,
    });

    await idea.save();
    await idea.populate('dreamId');

    res.status(201).json({
      success: true,
      message: 'Idea created successfully',
      idea
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all ideas
exports.getAllIdeas = async (req, res) => {
  try {
    const { status, priority, dreamId, sortBy } = req.query;

    // Build filter object
    const filter = { userId: req.user.id };

    if (status) {
      filter.status = status;
    }

    if (priority) {
      filter.priority = priority;
    }

    if (dreamId) {
      filter.dreamId = dreamId;
    }

    // Build sort object
    let sortObject = {};
    if (sortBy) {
      sortObject[sortBy] = -1;
    } else {
      sortObject['createdAt'] = -1;
    }

    const ideas = await Idea.find(filter)
      .sort(sortObject)
      .populate('dreamId');

    res.status(200).json({
      success: true,
      count: ideas.length,
      ideas
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single idea
exports.getIdeaById = async (req, res) => {
  try {
    const idea = await Idea.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).populate('dreamId');

    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
    }

    res.status(200).json({
      success: true,
      idea
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get ideas for specific dream
exports.getIdeasByDream = async (req, res) => {
  try {
    const { dreamId } = req.params;

    // Verify dream belongs to user
    const dream = await Dream.findOne({ _id: dreamId, userId: req.user.id });
    if (!dream) {
      return res.status(404).json({
        success: false,
        message: 'Dream not found or does not belong to current user'
      });
    }

    const ideas = await Idea.find({
      userId: req.user.id,
      dreamId: dreamId
    }).populate('dreamId');

    res.status(200).json({
      success: true,
      count: ideas.length,
      dreamTitle: dream.title,
      ideas
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update idea
exports.updateIdea = async (req, res) => {
  try {
    const { title, description, dreamId, priority, status, tags, category, implementation } = req.body;

    const idea = await Idea.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
    }

    // Validate dreamId if provided
    if (dreamId && dreamId !== idea.dreamId?.toString()) {
      const dream = await Dream.findOne({ _id: dreamId, userId: req.user.id });
      if (!dream) {
        return res.status(404).json({
          success: false,
          message: 'Dream not found or does not belong to current user'
        });
      }
      idea.dreamId = dreamId;
    } else if (dreamId === null) {
      idea.dreamId = null;
    }

    if (title !== undefined) idea.title = title;
    if (description !== undefined) idea.description = description;
    if (priority) idea.priority = priority;
    if (status) idea.status = status;
    if (tags) idea.tags = tags;
    if (category) idea.category = category;
    if (implementation) idea.implementation = implementation;

    await idea.save();
    await idea.populate('dreamId');

    res.status(200).json({
      success: true,
      message: 'Idea updated successfully',
      idea
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Mark idea as implemented
exports.markAsImplemented = async (req, res) => {
  try {
    const idea = await Idea.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
    }

    idea.status = 'implemented';
    await idea.save();

    res.status(200).json({
      success: true,
      message: 'Idea marked as implemented',
      idea
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.convertIdea = async (req, res) => {
  try {
    const idea = await Idea.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!idea) {
      return res.status(404).json({ success: false, message: 'Idea not found' });
    }

    const kind = String(req.body.kind || '').toLowerCase();
    const kinds = ['dream', 'action', 'task'];
    if (!kinds.includes(kind)) {
      return res.status(400).json({
        success: false,
        message: 'Convert to dream, action, or task',
      });
    }

    const title = (req.body.title || idea.title || '').trim().slice(0, 100);
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    const description = String(idea.description || '').trim().slice(0, 1000);

    let created = null;
    if (kind === 'dream') {
      const types = ['work', 'achievement', 'relation', 'finance', 'home'];
      const type = types.includes(req.body.type) ? req.body.type : 'work';
      created = await Dream.create({
        userId: req.user.id,
        title,
        subTitle: (description || 'Captured from Brain').slice(0, 200),
        description,
        type,
        priority: 'medium',
      });
      idea.dreamId = created._id;
    }

    if (kind === 'action') {
      let dreamId = req.body.dreamId || idea.dreamId || null;
      if (dreamId) {
        const dream = await Dream.findOne({ _id: dreamId, userId: req.user.id });
        if (!dream) {
          return res.status(404).json({ success: false, message: 'Dream not found' });
        }
        dreamId = dream._id;
      }
      created = await Action.create({
        userId: req.user.id,
        title,
        description,
        priority: 'medium',
        status: 'not started',
        dreamId,
      });
      if (dreamId) {
        idea.dreamId = dreamId;
        await syncDreamProgress(req.user.id, dreamId);
      }
    }

    if (kind === 'task') {
      let dreamId = req.body.dreamId || idea.dreamId || null;
      if (dreamId) {
        const dream = await Dream.findOne({ _id: dreamId, userId: req.user.id });
        if (!dream) {
          return res.status(404).json({ success: false, message: 'Dream not found' });
        }
        dreamId = dream._id;
      }
      const due = req.body.dueDate ? new Date(req.body.dueDate) : new Date();
      due.setHours(18, 0, 0, 0);
      created = await Task.create({
        userId: req.user.id,
        title,
        description,
        priority: 'medium',
        dueDate: due,
        dreamId,
      });
      if (dreamId) {
        idea.dreamId = dreamId;
        await syncDreamProgress(req.user.id, dreamId);
      }
    }

    idea.status = 'implemented';
    idea.implementation = `Converted to ${kind}`;
    await idea.save();

    return res.status(201).json({
      success: true,
      message: `Idea is now a ${kind}`,
      kind,
      idea,
      created,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete idea
exports.deleteIdea = async (req, res) => {
  try {
    const idea = await Idea.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Idea deleted successfully',
      ideaId: idea._id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get idea statistics
exports.getIdeaStats = async (req, res) => {
  try {
    const totalIdeas = await Idea.countDocuments({ userId: req.user.id });
    const activeIdeas = await Idea.countDocuments({ userId: req.user.id, status: 'active' });
    const implementedIdeas = await Idea.countDocuments({ userId: req.user.id, status: 'implemented' });
    const archivedIdeas = await Idea.countDocuments({ userId: req.user.id, status: 'archived' });
    const linkedToDream = await Idea.countDocuments({ userId: req.user.id, dreamId: { $ne: null } });
    const standalone = await Idea.countDocuments({ userId: req.user.id, dreamId: null });

    const userId = toObjectId(req.user.id);

    const byPriority = await Idea.aggregate([
      { $match: { userId } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    const byStatus = await Idea.aggregate([
      { $match: { userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const stats = {
      totalIdeas,
      activeIdeas,
      implementedIdeas,
      archivedIdeas,
      linkedToDream,
      standalone,
      byPriority: {},
      byStatus: {}
    };

    byPriority.forEach(item => {
      stats.byPriority[item._id] = item.count;
    });

    byStatus.forEach(item => {
      stats.byStatus[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
