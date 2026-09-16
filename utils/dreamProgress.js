const Dream = require("../models/Dream");
const Action = require("../models/Action");
const Task = require("../models/Task");
const { toObjectId } = require("./ids");

const asId = (value) => {
  if (!value) return null;
  if (typeof value === "object") {
    return String(value._id || value.id || "");
  }
  return String(value);
};

const startOfDay = (date = new Date()) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfHorizon = (hours = 48) => {
  const next = startOfDay();
  next.setHours(next.getHours() + hours);
  next.setHours(23, 59, 59, 999);
  return next;
};

const todayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const weekBounds = (from = new Date()) => {
  const end = new Date(from);
  end.setHours(23, 59, 59, 999);
  const start = new Date(from);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

const loadDreamWork = async (userId, dreamId) => {
  const id = toObjectId(asId(dreamId));
  const actions = await Action.find({ userId, dreamId: id }).setOptions({
    _recursed: true,
  });
  const actionIds = actions.map((action) => action._id);
  const taskQuery = [{ dreamId: id }];
  if (actionIds.length) {
    taskQuery.push({ actionId: { $in: actionIds } });
  }
  const tasks = await Task.find({
    userId,
    $or: taskQuery,
  }).setOptions({ _recursed: true });

  return { actions, tasks };
};

const computeProgress = (actions, tasks) => {
  const liveActions = (actions || []).filter((action) => action.status !== "dropped");
  const actionTotal = liveActions.length;
  const actionDone = liveActions.filter((action) => action.status === "completed").length;
  const taskTotal = tasks.length;
  const taskDone = tasks.filter((task) => task.isCompleted).length;

  if (!actionTotal && !taskTotal) {
    return 0;
  }
  if (!actionTotal) {
    return Math.round((taskDone / taskTotal) * 100);
  }
  if (!taskTotal) {
    return Math.round((actionDone / actionTotal) * 100);
  }
  const mixed =
    0.5 * (actionDone / actionTotal) + 0.5 * (taskDone / taskTotal);
  return Math.round(mixed * 100);
};

const hasStepWithin48h = (actions, tasks) => {
  const from = startOfDay();
  const to = endOfHorizon(48);
  const openTask = tasks.some((task) => {
    if (task.isCompleted || !task.dueDate) return false;
    const due = new Date(task.dueDate);
    return due >= from && due <= to;
  });
  if (openTask) return true;
  return actions.some((action) => {
    if (action.status === "completed" || action.status === "dropped" || !action.dueDate) return false;
    const due = new Date(action.dueDate);
    return due >= from && due <= to;
  });
};

const syncDreamProgress = async (userId, dreamId) => {
  const id = asId(dreamId);
  if (!id) return null;

  const dream = await Dream.findOne({ _id: id, userId });
  if (!dream) return null;

  const { actions, tasks } = await loadDreamWork(userId, id);
  dream.progress = computeProgress(actions, tasks);
  await dream.save();
  return dream;
};

const syncAllDreamProgress = async (userId) => {
  const dreams = await Dream.find({ userId });
  await Promise.all(dreams.map((dream) => syncDreamProgress(userId, dream._id)));
};

const listStaleDreams = async (userId) => {
  const dreams = await Dream.find({ userId }).sort({ priority: 1, updatedAt: -1 });
  const stale = [];
  for (const dream of dreams) {
    const { actions, tasks } = await loadDreamWork(userId, dream._id);
    if (hasStepWithin48h(actions, tasks)) continue;
    stale.push({
      id: String(dream._id),
      title: dream.title,
      type: dream.type,
      progress: dream.progress || 0,
    });
  }
  return stale;
};

module.exports = {
  asId,
  todayKey,
  weekBounds,
  startOfDay,
  syncDreamProgress,
  syncAllDreamProgress,
  listStaleDreams,
  loadDreamWork,
  computeProgress,
};
