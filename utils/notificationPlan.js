const Task = require("../models/Task");
const FocusSession = require("../models/FocusSession");
const ChallengeSession = require("../models/ChallengeSession");
const User = require("../models/User");
const { listStaleDreams, todayKey, startOfDay, asId } = require("./dreamProgress");
const { remainingMsFor } = require("./productivity");
const { pickMorningQuote } = require("./quotes");

const PRIORITY = {
  missedTodo: 1,
  challengeHour: 2,
  focusHour: 3,
  focusStarting: 3,
  focusEnding: 3,
  dreamWarning: 4,
  eveningShutdown: 5,
  weeklyReview: 6,
  peakHour: 7,
  morningMotivation: 8,
};

const DAILY_SLOT = new Set([
  "missedTodo",
  "dreamWarning",
  "eveningShutdown",
  "weeklyReview",
  "peakHour",
]);

const item = ({
  category,
  title,
  body,
  url,
  entityId = "",
  actions = ["open"],
  schedule,
  extra = {},
}) => ({
  id: ["dood", category, String(entityId || "x").slice(0, 18), todayKey()]
    .join(".")
    .slice(0, 64),
  category,
  priority: PRIORITY[category] || 9,
  title,
  body,
  url,
  entityId: String(entityId || ""),
  actions,
  schedule,
  extra,
});

const buildNotificationPlan = async (userId, pref) => {
  const cats = pref.notificationPreferences || {};
  const smart = Boolean(pref.smartNotificationsEnabled);
  const extra = Boolean(pref.extraRemindersEnabled);
  const user = await User.findById(userId).select("intent lastWeeklyReviewOn eveningNoteOn");

  const [tasks, staleDreams, activeFocus, scheduledFocus, activeChallenge] =
    await Promise.all([
      Task.find({ userId, isCompleted: false }).sort({ dueDate: 1 }).limit(40),
      listStaleDreams(userId),
      FocusSession.findOne({
        userId,
        status: { $in: ["active", "paused"] },
      }).sort({ updatedAt: -1 }),
      FocusSession.findOne({
        userId,
        status: "scheduled",
      }).sort({ createdAt: -1 }),
      ChallengeSession.findOne({
        userId,
        status: { $in: ["suggested", "active", "paused"] },
      }).sort({ updatedAt: -1 }),
    ]);

  const today = startOfDay();
  const missed = tasks.filter(
    (task) =>
      task.missedFrom ||
      (task.dueDate && startOfDay(task.dueDate).getTime() < today.getTime()),
  );
  const notifications = [];

  if (smart && cats.missedTodo !== false && missed[0]) {
    const todo = missed[0];
    notifications.push(
      item({
        category: "missedTodo",
        title: todo.title,
        body: "You left this open. Close it before starting something new.",
        url: `dood://todo/${asId(todo)}`,
        entityId: asId(todo),
        actions: ["open", "reschedule", "complete"],
        schedule: { kind: "soon", delaySec: 75 },
        extra: {
          todoId: asId(todo),
          rescheduleUrl: `dood://todo/${asId(todo)}/reschedule`,
          completeUrl: `dood://todo/${asId(todo)}/complete`,
        },
      }),
    );
  }

  if (smart && cats.dreamWarning !== false && staleDreams[0]) {
    const dream = staleDreams[0];
    notifications.push(
      item({
        category: "dreamWarning",
        title: dream.title,
        body: `Your ${dream.title} has no next move. What will you do today?`,
        url: `dood://dream/${dream.id}`,
        entityId: dream.id,
        schedule: { kind: "today", time: pref.dreamWarningTime || "11:00" },
        extra: { dreamId: dream.id },
      }),
    );
  }

  if (smart && cats.peakHour !== false && pref.peakHour) {
    notifications.push(
      item({
        category: "peakHour",
        title: "Your peak hour starts now.",
        body: "One result. No distractions.",
        url: "dood://focus",
        entityId: "peak",
        schedule: { kind: "today", time: pref.peakHour, skipIfPast: true },
      }),
    );
  }

  if (smart && cats.focusStarting === true && pref.peakHour) {
    notifications.push(
      item({
        category: "focusStarting",
        title: "Focus starts in 10 minutes.",
        body: "Clear the desk. One result.",
        url: "dood://focus",
        entityId: "peak-10",
        schedule: {
          kind: "today",
          time: pref.peakHour,
          offsetMin: -10,
          skipIfPast: true,
        },
      }),
    );
  }

  if (smart && cats.focusStarting === true && scheduledFocus) {
    notifications.push(
      item({
        category: "focusStarting",
        title: "Focus starts in 10 minutes.",
        body: scheduledFocus.title
          ? `“${scheduledFocus.title}”. One result.`
          : "One result. No distractions.",
        url: `dood://focus/${asId(scheduledFocus)}`,
        entityId: asId(scheduledFocus),
        schedule: {
          kind: "at",
          iso: new Date(
            (scheduledFocus.startedAt
              ? new Date(scheduledFocus.startedAt).getTime()
              : Date.now()) - 10 * 60 * 1000,
          ).toISOString(),
        },
      }),
    );
  }

  if (
    smart &&
    cats.focusEnding !== false &&
    activeFocus &&
    activeFocus.status === "active"
  ) {
    const remaining = remainingMsFor(activeFocus);
    if (remaining > 15 * 1000) {
      notifications.push(
        item({
          category: "focusEnding",
          title: "Your hour is done.",
          body: "Did you produce the result?",
          url: `dood://focus/${asId(activeFocus)}`,
          entityId: asId(activeFocus),
          schedule: {
            kind: "at",
            iso: new Date(Date.now() + remaining).toISOString(),
          },
        }),
      );
    }
  }

  if (
    smart &&
    cats.challengeHour !== false &&
    pref.challengeEnabled !== false &&
    activeChallenge &&
    activeChallenge.status === "active" &&
    activeChallenge.startedAt
  ) {
    const startedMs = new Date(activeChallenge.startedAt).getTime();
    if (Date.now() - startedMs < 2 * 60 * 1000) {
      notifications.push(
        item({
          category: "challengeHour",
          title: "Your challenge starts now.",
          body: `${activeChallenge.title}. One result. ${activeChallenge.duration || 60} minutes.`,
          url: `dood://challenge/${asId(activeChallenge)}`,
          entityId: asId(activeChallenge),
          schedule: { kind: "soon", delaySec: 20 },
        }),
      );
    }
  }

  if (smart && cats.eveningShutdown !== false) {
    notifications.push(
      item({
        category: "eveningShutdown",
        title: "Evening shutdown",
        body: "What did you finish? What is still open?",
        url: "dood://evening",
        entityId: "evening",
        schedule: {
          kind: "today",
          time: pref.eveningShutdownTime || "18:00",
          skipIfPast: true,
        },
      }),
    );
  }

  if (smart && cats.weeklyReview !== false) {
    notifications.push(
      item({
        category: "weeklyReview",
        title: "Weekly review",
        body: "To-dos, missed work, actions, dreams with no next step, ideas, money.",
        url: "dood://review",
        entityId: "week",
        schedule: {
          kind: "weekly",
          weekday: Number.isInteger(pref.weeklyReviewWeekday)
            ? pref.weeklyReviewWeekday
            : 0,
          time: pref.weeklyReviewTime || "10:00",
        },
      }),
    );
  }

  if (smart && cats.morningMotivation !== false) {
    const quote = pickMorningQuote(user?.intent);
    notifications.push(
      item({
        category: "morningMotivation",
        title: quote.title,
        body: quote.body,
        url: "dood://home",
        entityId: todayKey(),
        schedule: {
          kind: "today",
          time: pref.morningMotivationTime || "07:30",
          skipIfPast: true,
        },
        extra: { intent: user?.intent || "", by: quote.by },
      }),
    );
  }

  const inFocus = Boolean(activeFocus && activeFocus.status === "active");
  const remaining = inFocus ? remainingMsFor(activeFocus) : 0;

  let filtered = notifications;
  if (!extra) {
    const slot = filtered
      .filter((n) => DAILY_SLOT.has(n.category))
      .sort((a, b) => a.priority - b.priority)[0];
    filtered = filtered.filter((n) => !DAILY_SLOT.has(n.category) || n === slot);
  }

  return {
    smartEnabled: smart,
    extraRemindersEnabled: extra,
    timezone: pref.timezone || "",
    quietHours: pref.quietHours || {
      enabled: false,
      start: "22:00",
      end: "07:00",
    },
    inFocus,
    focusEndsAt: inFocus ? new Date(Date.now() + remaining).toISOString() : null,
    today: todayKey(),
    intent: user?.intent || "",
    activeFocusId: activeFocus ? asId(activeFocus) : "",
    activeChallengeId: activeChallenge ? asId(activeChallenge) : "",
    notifications: filtered,
  };
};

module.exports = {
  PRIORITY,
  buildNotificationPlan,
};
