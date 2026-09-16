const { validationResult } = require("express-validator");
const FocusSession = require("../models/FocusSession");
const ChallengeSession = require("../models/ChallengeSession");
const Task = require("../models/Task");
const {
  getOrCreatePreference,
  serializePreference,
  applyModeWindow,
  cleanTime,
  clampDuration,
  isTime,
} = require("../utils/productivity");
const { computeInsights } = require("../utils/productivityInsights");
const { pickNextWork } = require("../utils/pickNextWork");
const { hydrateSession } = require("../utils/sessionSerialize");
const { asId, listStaleDreams, startOfDay } = require("../utils/dreamProgress");

const failValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
};

exports.getPreferences = async (req, res) => {
  try {
    const pref = await getOrCreatePreference(req.user.id);
    return res.json({ success: true, preferences: serializePreference(pref) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    if (failValidation(req, res)) return;
    const pref = await getOrCreatePreference(req.user.id);
    const body = req.body || {};

    if (body.mode) {
      const keepPeak = body.peakHour ? true : body.keepPeakHour === true;
      applyModeWindow(pref, body.mode, { keepPeak });
    }
    if (body.preferredStartTime !== undefined) {
      pref.preferredStartTime = cleanTime(
        body.preferredStartTime,
        pref.preferredStartTime,
      );
    }
    if (body.preferredEndTime !== undefined) {
      pref.preferredEndTime = cleanTime(
        body.preferredEndTime,
        pref.preferredEndTime,
      );
    }
    if (body.peakHour !== undefined) {
      if (body.peakHour === "" || body.peakHour === null) {
        pref.peakHour = "";
        pref.peakHourConfirmed = false;
      } else if (isTime(body.peakHour)) {
        pref.peakHour = body.peakHour;
        pref.peakHourConfirmed = true;
        if (!body.mode && pref.mode === "unset") {
          pref.mode = "peak";
        }
      }
    }
    if (body.focusDuration !== undefined) {
      pref.focusDuration = clampDuration(body.focusDuration, pref.focusDuration);
    }
    if (body.eveningShutdownTime !== undefined) {
      pref.eveningShutdownTime = cleanTime(
        body.eveningShutdownTime,
        pref.eveningShutdownTime,
      );
    }
    if (body.smartNotificationsEnabled !== undefined) {
      pref.smartNotificationsEnabled = Boolean(body.smartNotificationsEnabled);
    }
    if (body.challengeEnabled !== undefined) {
      pref.challengeEnabled = Boolean(body.challengeEnabled);
    }
    if (body.timezone !== undefined) {
      pref.timezone = String(body.timezone || "").slice(0, 64);
    }
    if (body.notificationPreferences && typeof body.notificationPreferences === "object") {
      pref.notificationPreferences = {
        ...(pref.notificationPreferences || {}),
        ...body.notificationPreferences,
      };
    }
    if (body.quietHours && typeof body.quietHours === "object") {
      pref.quietHours = {
        enabled:
          body.quietHours.enabled !== undefined
            ? Boolean(body.quietHours.enabled)
            : Boolean(pref.quietHours?.enabled),
        start: cleanTime(body.quietHours.start, pref.quietHours?.start || "22:00"),
        end: cleanTime(body.quietHours.end, pref.quietHours?.end || "07:00"),
      };
    }

    await pref.save();
    return res.json({
      success: true,
      message: "Preferences updated",
      preferences: serializePreference(pref),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInsights = async (req, res) => {
  try {
    const insights = await computeInsights(req.user.id);
    return res.json({ success: true, insights });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.refreshInsights = async (req, res) => {
  try {
    const insights = await computeInsights(req.user.id);
    return res.json({ success: true, insights });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getWidgetSnapshot = async (req, res) => {
  try {
    const pref = await getOrCreatePreference(req.user.id);
    const dayStart = startOfDay();
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const [openTasks, todayTasks, staleDreams, activeFocus, activeChallenge] = await Promise.all([
      Task.find({ userId: req.user.id, isCompleted: false })
        .sort({ dueDate: 1 })
        .limit(30),
      Task.find({
        userId: req.user.id,
        dueDate: { $gte: dayStart, $lt: dayEnd },
      }),
      listStaleDreams(req.user.id),
      FocusSession.findOne({
        userId: req.user.id,
        status: { $in: ["active", "paused"] },
      }).sort({ updatedAt: -1 }),
      ChallengeSession.findOne({
        userId: req.user.id,
        status: { $in: ["suggested", "active", "paused"] },
      }).sort({ updatedAt: -1 }),
    ]);

    const today = dayStart.getTime();
    const missed = openTasks.filter((task) => task.missedFrom || (task.dueDate && startOfDay(task.dueDate).getTime() < today));
    const todayOpen = openTasks.filter((task) => {
      if (!task.dueDate) return false;
      return startOfDay(task.dueDate).getTime() === today;
    });
    const selected = missed[0] || todayOpen[0] || openTasks[0] || null;
    const suggested = await pickNextWork(req.user.id);
    const queued = [];
    const seen = new Set();
    [...missed, ...todayOpen].forEach((task) => {
      const id = asId(task);
      if (!id || seen.has(id)) return;
      seen.add(id);
      queued.push({
        id,
        title: task.title,
        status: task.missedFrom ? "missed" : "open",
      });
    });

    return res.json({
      success: true,
      snapshot: {
        signedIn: true,
        selectedResult: selected
          ? {
              id: asId(selected),
              title: selected.title,
              status: selected.missedFrom ? "missed" : "open",
            }
          : suggested
            ? { id: suggested.todoId || suggested.actionId, title: suggested.title, status: "open" }
            : null,
        todayTodos: queued.slice(0, 3),
        missedCount: missed.length,
        dreamTitle: selected?.dreamId?.title || suggested?.dreamTitle || "",
        actionTitle: selected?.actionId?.title || suggested?.actionTitle || "",
        openCount: new Set(
          [...missed, ...todayOpen].map((task) => asId(task)).filter(Boolean),
        ).size,
        doneCount: todayTasks.filter((task) => task.isCompleted).length,
        todayCount: todayTasks.length,
        nextFocusTime: serializePreference(pref).peakHourLabel,
        peakHour: serializePreference(pref).peakHour,
        activeFocusTitle: activeFocus?.title || activeChallenge?.title || "",
        staleDreamCount: staleDreams.length,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCockpit = async (req, res) => {
  try {
    const pref = await getOrCreatePreference(req.user.id);
    const [insights, suggested, activeFocus, activeChallenge] = await Promise.all([
      computeInsights(req.user.id),
      pickNextWork(req.user.id),
      FocusSession.findOne({
        userId: req.user.id,
        status: { $in: ["active", "paused"] },
      }).sort({ updatedAt: -1 }),
      ChallengeSession.findOne({
        userId: req.user.id,
        status: { $in: ["suggested", "active", "paused"] },
      }).sort({ updatedAt: -1 }),
    ]);

    return res.json({
      success: true,
      cockpit: {
        preferences: serializePreference(pref),
        insights,
        suggestedFocus: suggested,
        activeFocus: await hydrateSession(activeFocus),
        activeChallenge: await hydrateSession(activeChallenge),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
