const Dream = require("../models/Dream");
const Action = require("../models/Action");
const Task = require("../models/Task");
const { asId } = require("./dreamProgress");
const { elapsedMsFor, remainingMsFor, clampDuration } = require("./productivity");

const asRef = (doc) => {
  if (!doc) return null;
  if (typeof doc === "object") {
    return {
      id: String(doc._id || doc.id || ""),
      title: doc.title || "",
    };
  }
  return { id: String(doc), title: "" };
};

const loadLinked = async ({ dreamId, actionId, todoId }) => {
  const [dream, action, todo] = await Promise.all([
    dreamId ? Dream.findById(asId(dreamId)).select("title") : null,
    actionId ? Action.findById(asId(actionId)).select("title status dreamId").setOptions({ _recursed: true }) : null,
    todoId
      ? Task.findById(asId(todoId)).select("title isCompleted dreamId actionId").setOptions({ _recursed: true })
      : null,
  ]);
  return { dream, action, todo };
};

const serializeSession = (session, extras = {}) => {
  if (!session) return null;
  const raw = session.toObject ? session.toObject() : session;
  const now = extras.now || new Date();
  const planned = clampDuration(raw.plannedDuration || raw.duration);
  return {
    id: String(raw._id),
    title: raw.title,
    dreamId: asId(raw.dreamId),
    actionId: asId(raw.actionId),
    todoId: asId(raw.todoId),
    dream: extras.dream ? asRef(extras.dream) : asRef(raw.dreamId),
    action: extras.action ? asRef(extras.action) : asRef(raw.actionId),
    todo: extras.todo ? asRef(extras.todo) : asRef(raw.todoId),
    plannedDuration: planned,
    duration: planned,
    startedAt: raw.startedAt || null,
    endedAt: raw.endedAt || null,
    pausedAt: raw.pausedAt || null,
    status: raw.status,
    outcome: raw.outcome || "",
    notes: raw.notes || "",
    reason: raw.reason || "",
    coachMessage: raw.coachMessage || "",
    elapsedMs: elapsedMsFor({ ...raw, plannedDuration: planned }, now),
    remainingMs: remainingMsFor({ ...raw, plannedDuration: planned }, now),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

const hydrateSession = async (session) => {
  if (!session) return null;
  const linked = await loadLinked(session);
  return serializeSession(session, linked);
};

module.exports = {
  loadLinked,
  serializeSession,
  hydrateSession,
};
