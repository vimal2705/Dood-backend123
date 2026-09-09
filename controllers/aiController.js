const { validationResult } = require("express-validator");
const Dream = require("../models/Dream");
const Action = require("../models/Action");
const Task = require("../models/Task");
const Idea = require("../models/Idea");
const User = require("../models/User");
const { JSON_ONLY_SUFFIX } = require("../utils/aiMentorPrompt");
const {
  chatCompletion,
  parseJsonContent,
  mentorMessages,
} = require("../utils/groq");
const {
  buildUserContext,
  formatContextForPrompt,
} = require("../utils/aiContext");

const PRIORITIES = ["low", "medium", "high"];

const fail = (res, error) => {
  const status = error.status || 500;
  const message = error.message || "Mentor request failed";
  return res.status(status).json({ success: false, message });
};

const clampPriority = (value, fallback = "medium") =>
  PRIORITIES.includes(value) ? value : fallback;

const clampTitle = (value, max = 100) =>
  String(value || "")
    .trim()
    .slice(0, max);

const clampText = (value, max = 500) =>
  String(value || "")
    .trim()
    .slice(0, max);

const dueFromOffset = (days) => {
  const offset = Number.isFinite(Number(days)) ? Number(days) : 0;
  const safe = Math.min(30, Math.max(0, Math.round(offset)));
  const next = new Date();
  next.setDate(next.getDate() + safe);
  next.setHours(18, 0, 0, 0);
  return next;
};

const dueFromValue = (value, offsetDays = 0) => {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return dueFromOffset(offsetDays);
};

const todayKey = () => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

const fallbackMorningNote = (context) => {
  const missed = context?.missedTodos?.[0];
  if (missed?.title) {
    return `Start with “${missed.title}”. Close yesterday before you add more.`;
  }
  const today = context?.todayTodos?.[0];
  if (today?.title) {
    return `Today is “${today.title}”. Do that, then stop stacking.`;
  }
  const dream = context?.dreams?.[0];
  if (dream?.title) {
    return `${dream.title} is still a vision. Give it one small to-do today.`;
  }
  return "Name one dream. Give today one step. That is enough.";
};

exports.mentorChat = async (req, res) => {
  try {
    const message = clampText(req.body?.message, 2000);
    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const context = await buildUserContext(req.user.id);
    const payload = `${formatContextForPrompt(context)}

User said:
${message}

Reply as Dood's mentor. Challenge, give feedback, then suggest the next 48 hours. End with one direct question.`;

    const { content, model } = await chatCompletion({
      messages: mentorMessages(req.body?.messages, payload),
      temperature: 0.45,
    });

    return res.json({
      success: true,
      reply: content,
      model,
    });
  } catch (error) {
    console.error(error);
    return fail(res, error);
  }
};

exports.morningMotivation = async (req, res) => {
  try {
    const day = todayKey();
    const user = await User.findById(req.user.id).select(
      "morningNote morningNoteOn name",
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.morningNoteOn === day && user.morningNote) {
      return res.json({
        success: true,
        note: user.morningNote,
        cached: true,
      });
    }

    const context = await buildUserContext(req.user.id);
    let note = fallbackMorningNote(context);
    let model = "fallback";

    try {
      const payload = `${formatContextForPrompt(context)}

Write a daily morning motivation for ${user.name || "this person"}. Two short sentences. Warm, specific, and useful. Use their real dreams and to-dos. If they have missed work, point them at it without shaming. Do not flatter. No questions. No hashtags. No quotes around the whole note.

${JSON_ONLY_SUFFIX}

JSON shape:
{ "note": "two short sentences" }`;

      const result = await chatCompletion({
        messages: mentorMessages([], payload),
        json: true,
        temperature: 0.5,
      });
      const parsed = parseJsonContent(result.content);
      const generated = clampText(parsed.note, 280);
      if (generated) {
        note = generated;
        model = result.model;
      }
    } catch (error) {
      console.error(error);
    }

    await User.findByIdAndUpdate(req.user.id, {
      morningNote: note,
      morningNoteOn: day,
    });

    return res.json({
      success: true,
      note,
      model,
      cached: false,
    });
  } catch (error) {
    console.error(error);
    return fail(res, error);
  }
};

exports.planToday = async (req, res) => {
  try {
    const context = await buildUserContext(req.user.id);
    const payload = `${formatContextForPrompt(context)}

Plan today for this person. Start with missed to-dos if any exist. Do not pile on more than they can finish. Prefer closing existing work over inventing new dreams.

${JSON_ONLY_SUFFIX}

JSON shape:
{
  "focus": "one sentence",
  "challenge": "what they are avoiding or overloading",
  "feedback": "blunt coaching",
  "suggestedTodos": [
    { "title": "concrete to-do", "reason": "why today", "priority": "high|medium|low", "dueOffsetDays": 0 }
  ]
}

Return 1-3 suggestedTodos. If missed items exist, the first suggestion must address them.`;

    const { content, model } = await chatCompletion({
      messages: mentorMessages([], payload),
      json: true,
      temperature: 0.3,
    });

    const plan = parseJsonContent(content);
    const suggestedTodos = Array.isArray(plan.suggestedTodos)
      ? plan.suggestedTodos.slice(0, 3).map((item) => ({
          title: clampTitle(item.title),
          reason: clampText(item.reason, 180),
          priority: clampPriority(item.priority),
          dueOffsetDays: Math.min(7, Math.max(0, Number(item.dueOffsetDays) || 0)),
        })).filter((item) => item.title)
      : [];

    return res.json({
      success: true,
      model,
      plan: {
        focus: clampText(plan.focus, 240),
        challenge: clampText(plan.challenge, 240),
        feedback: clampText(plan.feedback, 400),
        suggestedTodos,
      },
    });
  } catch (error) {
    console.error(error);
    return fail(res, error);
  }
};

exports.expandDream = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const dream = await Dream.findOne({
      _id: req.body.dreamId,
      userId: req.user.id,
    });
    if (!dream) {
      return res.status(404).json({ success: false, message: "Dream not found" });
    }

    const context = await buildUserContext(req.user.id);
    const payload = `${formatContextForPrompt(context)}

Break this dream into a plan. Dream:
${JSON.stringify({
  id: String(dream._id),
  title: dream.title,
  subTitle: dream.subTitle,
  description: dream.description,
  type: dream.type,
  priority: dream.priority,
  status: dream.status,
  progress: dream.progress,
  targetDate: dream.targetDate,
})}

Do not celebrate a vision with no next step. Challenge if it is vague or too big for the next 48 hours. Prefer 2-4 actions and a few dated tasks. Do not overload today if missed to-dos already exist.

${JSON_ONLY_SUFFIX}

JSON shape:
{
  "challenge": "string",
  "feedback": "string",
  "actions": [
    {
      "title": "string",
      "description": "string",
      "priority": "high|medium|low",
      "dueOffsetDays": 7,
      "tasks": [
        { "title": "string", "priority": "medium", "dueOffsetDays": 1 }
      ]
    }
  ]
}`;

    const { content, model } = await chatCompletion({
      messages: mentorMessages([], payload),
      json: true,
      temperature: 0.35,
    });

    const plan = parseJsonContent(content);
    const actions = Array.isArray(plan.actions)
      ? plan.actions.slice(0, 4).map((action) => ({
          title: clampTitle(action.title),
          description: clampText(action.description, 500),
          priority: clampPriority(action.priority),
          dueOffsetDays: Math.min(90, Math.max(0, Number(action.dueOffsetDays) || 7)),
          tasks: Array.isArray(action.tasks)
            ? action.tasks.slice(0, 4).map((task) => ({
                title: clampTitle(task.title),
                priority: clampPriority(task.priority),
                dueOffsetDays: Math.min(30, Math.max(0, Number(task.dueOffsetDays) || 1)),
              })).filter((task) => task.title)
            : [],
        })).filter((action) => action.title)
      : [];

    return res.json({
      success: true,
      model,
      dreamId: String(dream._id),
      plan: {
        challenge: clampText(plan.challenge, 240),
        feedback: clampText(plan.feedback, 400),
        actions,
      },
    });
  } catch (error) {
    console.error(error);
    return fail(res, error);
  }
};

exports.applyDreamPlan = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const dream = await Dream.findOne({
      _id: req.body.dreamId,
      userId: req.user.id,
    });
    if (!dream) {
      return res.status(404).json({ success: false, message: "Dream not found" });
    }

    const incoming = Array.isArray(req.body.actions) ? req.body.actions.slice(0, 4) : [];
    if (!incoming.length) {
      return res.status(400).json({
        success: false,
        message: "At least one action is required",
      });
    }

    const createdActions = [];
    const createdTasks = [];

    for (const item of incoming) {
      const title = clampTitle(item.title);
      if (!title) continue;

      const action = new Action({
        userId: req.user.id,
        dreamId: dream._id,
        title,
        description: clampText(item.description, 500),
        priority: clampPriority(item.priority),
        status: "not started",
        dueDate: dueFromValue(item.dueDate, item.dueOffsetDays ?? 7),
      });
      await action.save();
      createdActions.push(action);

      const tasks = Array.isArray(item.tasks) ? item.tasks.slice(0, 4) : [];
      for (const taskItem of tasks) {
        const taskTitle = clampTitle(taskItem.title);
        if (!taskTitle) continue;
        const task = new Task({
          userId: req.user.id,
          dreamId: dream._id,
          actionId: action._id,
          title: taskTitle,
          priority: clampPriority(taskItem.priority),
          dueDate: dueFromValue(taskItem.dueDate, taskItem.dueOffsetDays ?? 1),
        });
        await task.save();
        createdTasks.push(task);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Plan applied",
      actionCount: createdActions.length,
      taskCount: createdTasks.length,
    });
  } catch (error) {
    console.error(error);
    return fail(res, error);
  }
};

exports.classifyIdea = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const idea = await Idea.findOne({
      _id: req.body.ideaId,
      userId: req.user.id,
    });
    if (!idea) {
      return res.status(404).json({ success: false, message: "Idea not found" });
    }

    const context = await buildUserContext(req.user.id);
    const payload = `${formatContextForPrompt(context)}

Classify this Brain idea. Is it a dream (vision), an action (plan), a task (dated to-do), a note, or noise?

Idea:
${JSON.stringify({
  id: String(idea._id),
  title: idea.title,
  description: idea.description,
  status: idea.status,
})}

Challenge if they are treating a vision like a checkbox, or dumping a chore as a life goal.

${JSON_ONLY_SUFFIX}

JSON shape:
{
  "kind": "dream|action|task|note|noise",
  "reason": "string",
  "challenge": "string",
  "suggestedTitle": "string",
  "nextStep": "string",
  "createTodo": { "title": "string", "priority": "medium", "dueOffsetDays": 0 }
}`;

    const { content, model } = await chatCompletion({
      messages: mentorMessages([], payload),
      json: true,
      temperature: 0.3,
    });

    const result = parseJsonContent(content);
    const kinds = ["dream", "action", "task", "note", "noise"];
    const kind = kinds.includes(result.kind) ? result.kind : "note";
    const createTodo = result.createTodo?.title
      ? {
          title: clampTitle(result.createTodo.title),
          priority: clampPriority(result.createTodo.priority),
          dueOffsetDays: Math.min(14, Math.max(0, Number(result.createTodo.dueOffsetDays) || 0)),
        }
      : null;

    return res.json({
      success: true,
      model,
      ideaId: String(idea._id),
      classification: {
        kind,
        reason: clampText(result.reason, 240),
        challenge: clampText(result.challenge, 240),
        suggestedTitle: clampTitle(result.suggestedTitle || idea.title),
        nextStep: clampText(result.nextStep, 240),
        createTodo,
      },
    });
  } catch (error) {
    console.error(error);
    return fail(res, error);
  }
};
