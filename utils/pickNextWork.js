const Dream = require("../models/Dream");
const Action = require("../models/Action");
const Task = require("../models/Task");
const { asId, startOfDay, listStaleDreams } = require("./dreamProgress");
const { clampDuration } = require("./productivity");

const titleOf = (doc) => (doc && doc.title ? String(doc.title) : "");

const workPayload = ({
  kind,
  title,
  reason,
  dream,
  action,
  todo,
  coachMessage,
  duration = 60,
}) => ({
  kind,
  title,
  reason,
  coachMessage,
  duration: clampDuration(duration, 60),
  dreamId: dream ? asId(dream) : null,
  dreamTitle: titleOf(dream),
  actionId: action ? asId(action) : null,
  actionTitle: titleOf(action),
  todoId: todo ? asId(todo) : null,
  todoTitle: titleOf(todo),
});

const coachLine = ({ dream, action, todo, fallback }) => {
  if (todo?.missedFrom) {
    return `You left “${todo.title}” open. Close it before starting something new.`;
  }
  if (dream?.title && todo?.title) {
    return `You said you want ${dream.title}. Today's challenge is to ${todo.title}. Start.`;
  }
  if (dream?.title && action?.title) {
    return `You said you want ${dream.title}. Produce this result: ${action.title}.`;
  }
  if (todo?.title) {
    return `One result: ${todo.title}.`;
  }
  return fallback;
};

const pickNextWork = async (userId, { excludeTodoIds = [], excludeActionIds = [] } = {}) => {
  const excludeTodos = new Set(excludeTodoIds.map((id) => String(id)));
  const excludeActions = new Set(excludeActionIds.map((id) => String(id)));

  const [tasks, actions, staleDreams] = await Promise.all([
    Task.find({ userId, isCompleted: false }).setOptions({ _recursed: true }).sort({ dueDate: 1 }),
    Action.find({
      userId,
      status: { $nin: ["completed", "dropped"] },
    })
      .setOptions({ _recursed: true })
      .sort({ dueDate: 1 }),
    listStaleDreams(userId),
  ]);

  const openTasks = tasks.filter((task) => !excludeTodos.has(asId(task)));
  const openActions = actions.filter((action) => !excludeActions.has(asId(action)));
  const today = startOfDay().getTime();

  const missed = openTasks.filter((task) => task.missedFrom);
  if (missed[0]) {
    const todo = missed[0];
    return workPayload({
      kind: "missed",
      title: todo.title,
      reason: "Close yesterday's work first.",
      dream: todo.dreamId,
      action: todo.actionId,
      todo,
      coachMessage: coachLine({
        dream: todo.dreamId,
        action: todo.actionId,
        todo,
      }),
    });
  }

  const overdueAction = openActions.find((action) => {
    if (!action.dueDate) return false;
    return startOfDay(action.dueDate).getTime() < today;
  });
  if (overdueAction) {
    return workPayload({
      kind: "overdue",
      title: overdueAction.title,
      reason: "This result is overdue.",
      dream: overdueAction.dreamId,
      action: overdueAction,
      coachMessage: coachLine({
        dream: overdueAction.dreamId,
        action: overdueAction,
        fallback: `Produce the result: ${overdueAction.title}.`,
      }),
    });
  }

  const todayTodo = openTasks.find((task) => {
    if (!task.dueDate) return false;
    return startOfDay(task.dueDate).getTime() === today;
  });
  if (todayTodo) {
    return workPayload({
      kind: "today",
      title: todayTodo.title,
      reason: "Today's meaningful result.",
      dream: todayTodo.dreamId,
      action: todayTodo.actionId,
      todo: todayTodo,
      coachMessage: coachLine({
        dream: todayTodo.dreamId,
        action: todayTodo.actionId,
        todo: todayTodo,
      }),
    });
  }

  if (staleDreams[0]) {
    const dream = await Dream.findOne({ _id: staleDreams[0].id, userId });
    if (dream) {
      return workPayload({
        kind: "stale-dream",
        title: `Give “${dream.title}” a dated next step`,
        reason: "This dream has no dated next step in 48 hours.",
        dream,
        coachMessage: `“${dream.title}” has no next move. What will you do today?`,
      });
    }
  }

  if (openActions[0]) {
    const action = openActions[0];
    return workPayload({
      kind: "open-action",
      title: action.title,
      reason: "An open result is still waiting.",
      dream: action.dreamId,
      action,
      coachMessage: coachLine({
        dream: action.dreamId,
        action,
        fallback: `Produce the result: ${action.title}.`,
      }),
    });
  }

  return null;
};

const pickAlternatives = async (userId, current) => {
  const next = await pickNextWork(userId, {
    excludeTodoIds: current?.todoId ? [current.todoId] : [],
    excludeActionIds: current?.actionId && !current?.todoId ? [current.actionId] : [],
  });
  return next ? [next] : [];
};

module.exports = {
  pickNextWork,
  pickAlternatives,
  workPayload,
};
