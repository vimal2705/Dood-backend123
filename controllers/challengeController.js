const { validationResult } = require("express-validator");
const ChallengeSession = require("../models/ChallengeSession");
const FocusSession = require("../models/FocusSession");
const {
  getOrCreatePreference,
  clampDuration,
  accumulateRunning,
} = require("../utils/productivity");
const { pickNextWork, pickAlternatives } = require("../utils/pickNextWork");
const { hydrateSession } = require("../utils/sessionSerialize");
const { applyResultOutcome, clampOutcome } = require("../utils/applyOutcome");

const LIVE = ["suggested", "active", "paused"];

const failValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
};

const toChallengePayload = (work, duration) => {
  if (!work) return null;
  return {
    title: work.title,
    reason: work.reason,
    coachMessage: work.coachMessage,
    duration,
    dreamId: work.dreamId,
    actionId: work.actionId,
    todoId: work.todoId,
    dreamTitle: work.dreamTitle,
    actionTitle: work.actionTitle,
    todoTitle: work.todoTitle,
    kind: work.kind,
  };
};

exports.suggestChallenge = async (req, res) => {
  try {
    const pref = await getOrCreatePreference(req.user.id);
    if (!pref.challengeEnabled) {
      return res.json({
        success: true,
        challenge: null,
        message: "Challenge Hour is off.",
      });
    }

    const liveFocus = await FocusSession.findOne({
      userId: req.user.id,
      status: { $in: ["active", "paused"] },
    });
    if (liveFocus) {
      return res.json({
        success: true,
        challenge: null,
        blockedByFocus: await hydrateSession(liveFocus),
        message: "Finish the open focus session first.",
      });
    }

    const existing = await ChallengeSession.findOne({
      userId: req.user.id,
      status: { $in: LIVE },
    }).sort({ updatedAt: -1 });
    if (existing && existing.status !== "suggested") {
      return res.json({
        success: true,
        challenge: await hydrateSession(existing),
        existing: true,
      });
    }

    const duration = clampDuration(req.body?.duration ?? pref.focusDuration, 60);
    const work = await pickNextWork(req.user.id, {
      excludeTodoIds: req.body?.excludeTodoIds || [],
      excludeActionIds: req.body?.excludeActionIds || [],
    });
    if (!work) {
      return res.json({
        success: true,
        challenge: null,
        message: "No challenge right now. Close work you already have, or add a dated to-do.",
      });
    }

    const payload = toChallengePayload(work, duration);
    let challenge = existing;
    if (existing && existing.status === "suggested") {
      existing.title = payload.title;
      existing.reason = payload.reason;
      existing.coachMessage = payload.coachMessage;
      existing.duration = duration;
      existing.dreamId = payload.dreamId;
      existing.actionId = payload.actionId;
      existing.todoId = payload.todoId;
      await existing.save();
      challenge = existing;
    } else {
      challenge = await ChallengeSession.create({
        userId: req.user.id,
        ...payload,
        status: "suggested",
      });
    }

    const alternatives = await pickAlternatives(req.user.id, payload);
    return res.json({
      success: true,
      challenge: await hydrateSession(challenge),
      suggestion: payload,
      alternatives,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createChallenge = async (req, res) => {
  try {
    if (failValidation(req, res)) return;
    const pref = await getOrCreatePreference(req.user.id);
    const duration = clampDuration(req.body.duration ?? pref.focusDuration, 60);
    const work =
      req.body.title
        ? {
            title: String(req.body.title).trim().slice(0, 100),
            reason: String(req.body.reason || "").slice(0, 300),
            coachMessage: String(req.body.coachMessage || "").slice(0, 400),
            dreamId: req.body.dreamId || null,
            actionId: req.body.actionId || null,
            todoId: req.body.todoId || null,
          }
        : await pickNextWork(req.user.id);

    if (!work || !work.title) {
      return res.status(400).json({
        success: false,
        message: "Nothing to challenge. Add a to-do first.",
      });
    }

    const challenge = await ChallengeSession.create({
      userId: req.user.id,
      title: work.title,
      reason: work.reason || "",
      coachMessage: work.coachMessage || `One result. ${work.title}.`,
      duration,
      dreamId: work.dreamId || null,
      actionId: work.actionId || null,
      todoId: work.todoId || null,
      status: "suggested",
    });

    return res.status(201).json({
      success: true,
      challenge: await hydrateSession(challenge),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.listChallenges = async (req, res) => {
  try {
    const challenges = await ChallengeSession.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);
    return res.json({
      success: true,
      challenges: await Promise.all(challenges.map((item) => hydrateSession(item))),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getChallenge = async (req, res) => {
  try {
    const challenge = await ChallengeSession.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }
    return res.json({ success: true, challenge: await hydrateSession(challenge) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.startChallenge = async (req, res) => {
  try {
    const challenge = await ChallengeSession.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }
    if (challenge.status === "declined") {
      return res.status(400).json({ success: false, message: "This challenge was declined." });
    }
    if (challenge.status === "completed" || challenge.status === "dropped") {
      return res.status(400).json({ success: false, message: "This challenge is closed." });
    }

    const liveFocus = await FocusSession.findOne({
      userId: req.user.id,
      status: { $in: ["active", "paused", "scheduled"] },
    });
    if (liveFocus && String(liveFocus._id) !== String(challenge.focusSessionId)) {
      return res.status(409).json({
        success: false,
        message: "A focus session is already open. Finish it first.",
        session: await hydrateSession(liveFocus),
      });
    }

    const now = new Date();
    let focus = liveFocus;
    if (!focus) {
      focus = await FocusSession.create({
        userId: req.user.id,
        dreamId: challenge.dreamId,
        actionId: challenge.actionId,
        todoId: challenge.todoId,
        title: challenge.title,
        plannedDuration: challenge.duration,
        status: "active",
        startedAt: now,
        resumedAt: now,
        accumulatedMs: 0,
      });
    }

    challenge.status = "active";
    challenge.startedAt = challenge.startedAt || now;
    challenge.resumedAt = now;
    challenge.pausedAt = null;
    challenge.focusSessionId = focus._id;
    await challenge.save();

    return res.json({
      success: true,
      challenge: await hydrateSession(challenge),
      session: await hydrateSession(focus),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeChallenge = async (req, res) => {
  try {
    const challenge = await ChallengeSession.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    const now = new Date();
    if (LIVE.includes(challenge.status) || challenge.status === "active") {
      accumulateRunning(challenge, now);
      challenge.endedAt = now;
      challenge.pausedAt = null;
      challenge.resumedAt = null;
    }
    const outcome = clampOutcome(req.body.outcome || "open");
    challenge.outcome = outcome;
    challenge.status = outcome === "dropped" ? "dropped" : "completed";
    if (typeof req.body.notes === "string") {
      challenge.notes = req.body.notes.trim().slice(0, 400);
    }
    await challenge.save();

    await applyResultOutcome({
      userId: req.user.id,
      outcome,
      todoId: challenge.todoId,
      actionId: challenge.actionId,
    });

    if (challenge.focusSessionId) {
      const focus = await FocusSession.findOne({
        _id: challenge.focusSessionId,
        userId: req.user.id,
      });
      if (focus && ["scheduled", "active", "paused"].includes(focus.status)) {
        accumulateRunning(focus, now);
        focus.status = "completed";
        focus.endedAt = now;
        focus.outcome = outcome;
        focus.pausedAt = null;
        focus.resumedAt = null;
        await focus.save();
      }
    }

    return res.json({
      success: true,
      challenge: await hydrateSession(challenge),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.declineChallenge = async (req, res) => {
  try {
    const challenge = await ChallengeSession.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }
    if (challenge.status === "active" || challenge.status === "paused") {
      return res.status(400).json({
        success: false,
        message: "End the running challenge instead of declining it.",
      });
    }
    challenge.status = "declined";
    challenge.endedAt = new Date();
    await challenge.save();
    return res.json({
      success: true,
      challenge: await hydrateSession(challenge),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
