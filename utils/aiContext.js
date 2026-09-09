const Dream = require("../models/Dream");
const Action = require("../models/Action");
const Task = require("../models/Task");
const Idea = require("../models/Idea");
const Note = require("../models/Note");
const MoneyEntry = require("../models/MoneyEntry");
const { monthBounds, summarizeMoney } = require("./moneyInsights");

const asId = (value) => {
  if (!value) return null;
  if (typeof value === "object") {
    return String(value._id || value.id || "");
  }
  return String(value);
};

const slim = (doc, fields) => {
  if (!doc) return null;
  const raw = doc.toObject ? doc.toObject() : doc;
  const next = {};
  fields.forEach((field) => {
    if (raw[field] === undefined) return;
    if (field.endsWith("Id") || field === "missedFrom" || field === "dueDate" || field === "targetDate") {
      if (raw[field] instanceof Date) {
        next[field] = raw[field].toISOString();
        return;
      }
      if (field.endsWith("Id")) {
        next[field] = asId(raw[field]);
        return;
      }
    }
    next[field] = raw[field];
  });
  next.id = String(raw._id || raw.id);
  return next;
};

const buildUserContext = async (userId) => {
  const { start, end } = monthBounds();
  const [dreams, actions, tasks, ideas, notes, moneyEntries] = await Promise.all([
    Dream.find({ userId }).sort({ updatedAt: -1 }).limit(20),
    Action.find({ userId })
      .setOptions({ _recursed: true })
      .sort({ dueDate: 1 })
      .limit(30),
    Task.find({ userId })
      .setOptions({ _recursed: true })
      .sort({ dueDate: 1 })
      .limit(40),
    Idea.find({ userId }).sort({ updatedAt: -1 }).limit(15),
    Note.find({ userId }).sort({ updatedAt: -1 }).limit(15),
    MoneyEntry.find({
      userId,
      happenedAt: { $gte: start, $lte: end },
    }),
  ]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const openTasks = tasks.filter((task) => !task.isCompleted);
  const todayTodos = openTasks.filter(
    (task) =>
      task.dueDate &&
      new Date(task.dueDate) >= todayStart &&
      new Date(task.dueDate) <= todayEnd,
  );
  const missedTodos = openTasks.filter((task) => task.missedFrom);

  return {
    generatedAt: new Date().toISOString(),
    dreams: dreams.map((dream) =>
      slim(dream, [
        "title",
        "subTitle",
        "type",
        "priority",
        "status",
        "progress",
        "targetDate",
      ]),
    ),
    actions: actions.map((action) =>
      slim(action, ["title", "status", "priority", "dueDate", "dreamId"]),
    ),
    todayTodos: todayTodos.map((task) =>
      slim(task, ["title", "priority", "dueDate", "missedFrom", "dreamId"]),
    ),
    missedTodos: missedTodos.map((task) =>
      slim(task, ["title", "priority", "dueDate", "missedFrom"]),
    ),
    openTaskCount: openTasks.length,
    ideas: ideas.map((idea) => {
      const item = slim(idea, ["title", "description", "status"]);
      if (item?.description) {
        item.description = String(item.description).slice(0, 220);
      }
      return item;
    }),
    notes: notes.map((note) => {
      const item = slim(note, ["content", "isPinned", "linkedType"]);
      if (item?.content) {
        item.content = String(item.content).slice(0, 180);
      }
      return item;
    }),
    money: summarizeMoney(
      moneyEntries,
      dreams.filter((dream) => dream.type === "finance"),
    ),
  };
};

const formatContextForPrompt = (context) =>
  `Current Dood snapshot:\n${JSON.stringify(context, null, 2)}`;

module.exports = {
  buildUserContext,
  formatContextForPrompt,
};
