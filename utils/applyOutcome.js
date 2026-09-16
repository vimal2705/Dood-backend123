const Task = require("../models/Task");
const Action = require("../models/Action");
const { asId, syncDreamProgress } = require("./dreamProgress");

const OUTCOMES = ["done", "partly", "open", "stopped", "dropped"];

const clampOutcome = (value) => (OUTCOMES.includes(value) ? value : "open");

const completeTask = async (userId, todoId) => {
  const id = asId(todoId);
  if (!id) return null;
  const task = await Task.findOne({ _id: id, userId }).setOptions({ _recursed: true });
  if (!task || task.isCompleted) return task;
  task.isCompleted = true;
  task.completedDate = new Date();
  await task.save();
  await syncDreamProgress(userId, asId(task.dreamId) || asId(task.actionId?.dreamId));
  return task;
};

const completeAction = async (userId, actionId) => {
  const id = asId(actionId);
  if (!id) return null;
  const action = await Action.findOne({ _id: id, userId }).setOptions({ _recursed: true });
  if (!action || action.status === "completed" || action.status === "dropped") {
    return action;
  }
  action.status = "completed";
  action.completedDate = new Date();
  await action.save();
  await syncDreamProgress(userId, asId(action.dreamId));
  return action;
};

const dropAction = async (userId, actionId) => {
  const id = asId(actionId);
  if (!id) return null;
  const action = await Action.findOne({ _id: id, userId }).setOptions({ _recursed: true });
  if (!action || action.status === "dropped") return action;
  action.status = "dropped";
  action.completedDate = null;
  await action.save();
  await syncDreamProgress(userId, asId(action.dreamId));
  return action;
};

const applyResultOutcome = async ({ userId, outcome, todoId, actionId }) => {
  const next = clampOutcome(outcome);
  if (next === "done") {
    if (todoId) {
      await completeTask(userId, todoId);
    } else if (actionId) {
      await completeAction(userId, actionId);
    }
  }
  if (next === "dropped" && actionId) {
    await dropAction(userId, actionId);
  }
  return next;
};

module.exports = {
  OUTCOMES,
  clampOutcome,
  applyResultOutcome,
};
