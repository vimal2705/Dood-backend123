const { validationResult } = require("express-validator");
const FocusSession = require("../models/FocusSession");
const ChallengeSession = require("../models/ChallengeSession");
const Task = require("../models/Task");
const Action = require("../models/Action");
const Dream = require("../models/Dream");
const {
  getOrCreatePreference,
  clampDuration,
  accumulateRunning,
} = require("../utils/productivity");
const { hydrateSession } = require("../utils/sessionSerialize");
const { applyResultOutcome, clampOutcome } = require("../utils/applyOutcome");
const { asId } = require("../utils/dreamProgress");
const { pickNextWork } = require("../utils/pickNextWork");

const LIVE = ["scheduled", "active", "paused"];

const failValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
};

const findOwned = (id, userId) =>
  FocusSession.findOne({ _id: id, userId });

const resolveLinks = async (userId, { dreamId, actionId, todoId, title }) => {
  let dream = null;
  let action = null;
  let todo = null;

  if (todoId) {
    todo = await Task.findOne({ _id: todoId, userId }).setOptions({ _recursed: true });
    if (!todo) {
      const err = new Error("To-do not found");
      err.status = 404;
      throw err;
    }
    action = todo.actionId || null;
    dream = todo.dreamId || (todo.actionId && todo.actionId.dreamId) || null;
  } else if (actionId) {
    action = await Action.findOne({ _id: actionId, userId }).setOptions({
      _recursed: true,
    });
    if (!action) {
      const err = new Error("Action not found");
      err.status = 404;
      throw err;
    }
    dream = action.dreamId || null;
  } else if (dreamId) {
    dream = await Dream.findOne({ _id: dreamId, userId });
    if (!dream) {
      const err = new Error("Dream not found");
      err.status = 404;
      throw err;
    }
  }

  const resolvedTitle =
    String(title || "").trim() ||
    todo?.title ||
    action?.title ||
    (dream?.title ? `Next step for ${dream.title}` : "");

  if (!resolvedTitle) {
    const err = new Error("Pick a to-do or action first.");
    err.status = 400;
    throw err;
  }

  return {
    dreamId: asId(dream),
    actionId: asId(action),
    todoId: asId(todo),
    title: resolvedTitle.slice(0, 100),
  };
};

const ensureNoLiveSession = async (userId) => {
  const existing = await FocusSession.findOne({
    userId,
    status: { $in: LIVE },
  }).sort({ updatedAt: -1 });
  if (existing) {
    const err = new Error("A focus session is already open. Finish or end it first.");
    err.status = 409;
    err.session = existing;
    throw err;
  }
};

exports.createFocusSession = async (req, res) => {
  try {
    if (failValidation(req, res)) return;
    const pref = await getOrCreatePreference(req.user.id);
    const startNow = req.body.start !== false;
    const duration = clampDuration(
      req.body.plannedDuration ?? req.body.duration ?? pref.focusDuration,
      pref.focusDuration,
    );

    if (startNow) {
      try {
        await ensureNoLiveSession(req.user.id);
      } catch (error) {
        if (error.status === 409) {
          return res.status(409).json({
            success: false,
            message: error.message,
            session: await hydrateSession(error.session),
          });
        }
        throw error;
      }
    }

    let links;
    if (req.body.todoId || req.body.actionId || req.body.dreamId || req.body.title) {
      links = await resolveLinks(req.user.id, req.body);
    } else {
      const suggested = await pickNextWork(req.user.id);
      if (!suggested) {
        return res.status(400).json({
          success: false,
          message: "Nothing to focus on. Add a to-do first.",
        });
      }
      links = {
        dreamId: suggested.dreamId,
        actionId: suggested.actionId,
        todoId: suggested.todoId,
        title: suggested.title,
      };
    }

    const now = new Date();
    const session = await FocusSession.create({
      userId: req.user.id,
      ...links,
      plannedDuration: duration,
      status: startNow ? "active" : "scheduled",
      startedAt: startNow ? now : null,
      resumedAt: startNow ? now : null,
      accumulatedMs: 0,
    });

    return res.status(201).json({
      success: true,
      session: await hydrateSession(session),
    });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.listFocusSessions = async (req, res) => {
  try {
    const sessions = await FocusSession.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30);
    const live = sessions.find((item) => LIVE.includes(item.status));
    return res.json({
      success: true,
      sessions: await Promise.all(sessions.map((item) => hydrateSession(item))),
      active: live ? await hydrateSession(live) : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFocusSession = async (req, res) => {
  try {
    const session = await findOwned(req.params.id, req.user.id);
    if (!session) {
      return res.status(404).json({ success: false, message: "Focus session not found" });
    }
    return res.json({ success: true, session: await hydrateSession(session) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateFocusSession = async (req, res) => {
  try {
    if (failValidation(req, res)) return;
    const session = await findOwned(req.params.id, req.user.id);
    if (!session) {
      return res.status(404).json({ success: false, message: "Focus session not found" });
    }

    const now = new Date();
    const nextStatus = req.body.status;
    const notes = req.body.notes;

    if (typeof notes === "string") {
      session.notes = notes.trim().slice(0, 400);
    }

    if (nextStatus === "paused" && session.status === "active") {
      accumulateRunning(session, now);
      session.status = "paused";
      session.pausedAt = now;
      session.resumedAt = null;
    } else if (nextStatus === "active" && (session.status === "paused" || session.status === "scheduled")) {
      if (session.status === "scheduled") {
        session.startedAt = now;
        session.accumulatedMs = 0;
      }
      session.status = "active";
      session.pausedAt = null;
      session.resumedAt = now;
    } else if (nextStatus === "interrupted" && LIVE.includes(session.status)) {
      accumulateRunning(session, now);
      session.status = "interrupted";
      session.endedAt = now;
      session.pausedAt = null;
      session.resumedAt = null;
    }

    await session.save();
    return res.json({
      success: true,
      session: await hydrateSession(session),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeFocusSession = async (req, res) => {
  try {
    const session = await findOwned(req.params.id, req.user.id);
    if (!session) {
      return res.status(404).json({ success: false, message: "Focus session not found" });
    }
    if (!LIVE.includes(session.status) && session.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "This session is already closed.",
      });
    }

    const now = new Date();
    if (LIVE.includes(session.status)) {
      accumulateRunning(session, now);
      session.status = "completed";
      session.endedAt = now;
      session.pausedAt = null;
      session.resumedAt = null;
    }

    const outcome = clampOutcome(req.body.outcome || "open");
    session.outcome = outcome;
    if (typeof req.body.notes === "string") {
      session.notes = req.body.notes.trim().slice(0, 400);
    }
    await session.save();

    await applyResultOutcome({
      userId: req.user.id,
      outcome,
      todoId: session.todoId,
      actionId: session.actionId,
    });

    if (session.status === "completed") {
      await ChallengeSession.updateMany(
        {
          userId: req.user.id,
          focusSessionId: session._id,
          status: { $in: ["active", "paused"] },
        },
        { status: "completed", endedAt: now, outcome },
      );
    }

    return res.json({
      success: true,
      session: await hydrateSession(session),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.abandonFocusSession = async (req, res) => {
  try {
    const session = await findOwned(req.params.id, req.user.id);
    if (!session) {
      return res.status(404).json({ success: false, message: "Focus session not found" });
    }
    if (!LIVE.includes(session.status)) {
      return res.json({ success: true, session: await hydrateSession(session) });
    }

    const now = new Date();
    accumulateRunning(session, now);
    session.status = "abandoned";
    session.endedAt = now;
    session.outcome = clampOutcome(req.body.outcome || "stopped");
    session.pausedAt = null;
    session.resumedAt = null;
    if (typeof req.body.notes === "string") {
      session.notes = req.body.notes.trim().slice(0, 400);
    }
    await session.save();

    if (session.outcome === "dropped") {
      await applyResultOutcome({
        userId: req.user.id,
        outcome: "dropped",
        todoId: session.todoId,
        actionId: session.actionId,
      });
    }

    return res.json({
      success: true,
      session: await hydrateSession(session),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
