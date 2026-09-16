const ProductivityPreference = require("../models/ProductivityPreference");
const { asId } = require("./dreamProgress");

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const MODE_WINDOWS = {
  morning: {
    preferredStartTime: "06:00",
    preferredEndTime: "12:00",
    peakHour: "09:00",
    label: "Morning",
    window: "6 AM–12 PM",
  },
  afternoon: {
    preferredStartTime: "12:00",
    preferredEndTime: "17:00",
    peakHour: "14:00",
    label: "Afternoon",
    window: "12 PM–5 PM",
  },
  evening: {
    preferredStartTime: "17:00",
    preferredEndTime: "22:00",
    peakHour: "19:00",
    label: "Evening",
    window: "5 PM–10 PM",
  },
  peak: {
    preferredStartTime: "19:00",
    preferredEndTime: "20:00",
    peakHour: "19:00",
    label: "Peak hour",
    window: "Your chosen hour",
  },
  unset: {
    preferredStartTime: "09:00",
    preferredEndTime: "18:00",
    peakHour: "",
    label: "Not set",
    window: "No claimed window yet",
  },
};

const DEFAULT_NOTIFICATIONS = {
  missedTodo: true,
  peakHour: false,
  dreamWarning: true,
  focusStarting: false,
  focusEnding: true,
  challengeHour: true,
  eveningShutdown: true,
  weeklyReview: true,
  morningMotivation: true,
};

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const clampWeekday = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 6) return fallback;
  return n;
};

const clampDuration = (value, fallback = 60) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(180, Math.max(10, Math.round(n)));
};

const isTime = (value) => TIME_RE.test(String(value || ""));

const cleanTime = (value, fallback = "") =>
  isTime(value) ? String(value) : fallback;

const formatHourLabel = (hhmm) => {
  if (!isTime(hhmm)) return "";
  const [hStr, mStr] = hhmm.split(":");
  const hour = Number(hStr);
  const minute = Number(mStr);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  if (minute === 0) return `${display} ${suffix}`;
  return `${display}:${String(minute).padStart(2, "0")} ${suffix}`;
};

const hourToTime = (hour) =>
  `${String(Math.min(23, Math.max(0, Math.round(hour)))).padStart(2, "0")}:00`;

const serializePreference = (doc) => {
  if (!doc) return null;
  const raw = doc.toObject ? doc.toObject() : doc;
  const mode = MODE_WINDOWS[raw.mode] ? raw.mode : "unset";
  return {
    id: String(raw._id),
    userId: asId(raw.userId),
    mode,
    modeLabel: MODE_WINDOWS[mode].label,
    windowLabel: MODE_WINDOWS[mode].window,
    preferredStartTime: raw.preferredStartTime || MODE_WINDOWS[mode].preferredStartTime,
    preferredEndTime: raw.preferredEndTime || MODE_WINDOWS[mode].preferredEndTime,
    peakHour: raw.peakHour || "",
    peakHourLabel: formatHourLabel(raw.peakHour),
    focusDuration: clampDuration(raw.focusDuration),
    eveningShutdownTime: raw.eveningShutdownTime || "18:00",
    smartNotificationsEnabled: Boolean(raw.smartNotificationsEnabled),
    extraRemindersEnabled: Boolean(raw.extraRemindersEnabled),
    morningMotivationTime: raw.morningMotivationTime || "07:30",
    dreamWarningTime: raw.dreamWarningTime || "11:00",
    weeklyReviewTime: raw.weeklyReviewTime || "10:00",
    weeklyReviewWeekday: clampWeekday(raw.weeklyReviewWeekday, 0),
    notificationPreferences: {
      ...DEFAULT_NOTIFICATIONS,
      ...(raw.notificationPreferences || {}),
    },
    quietHours: {
      enabled: Boolean(raw.quietHours?.enabled),
      start: raw.quietHours?.start || "22:00",
      end: raw.quietHours?.end || "07:00",
    },
    challengeEnabled: raw.challengeEnabled !== false,
    timezone: raw.timezone || "",
    peakHourConfirmed: Boolean(raw.peakHourConfirmed),
    updatedAt: raw.updatedAt,
    createdAt: raw.createdAt,
  };
};

const applyModeWindow = (pref, mode, { keepPeak = false } = {}) => {
  const window = MODE_WINDOWS[mode] || MODE_WINDOWS.unset;
  pref.mode = MODE_WINDOWS[mode] ? mode : "unset";
  pref.preferredStartTime = window.preferredStartTime;
  pref.preferredEndTime = window.preferredEndTime;
  if (!keepPeak || !pref.peakHour) {
    pref.peakHour = window.peakHour;
    pref.peakHourConfirmed = Boolean(window.peakHour) && mode !== "unset";
  }
};

const getOrCreatePreference = async (userId) => {
  let pref = await ProductivityPreference.findOne({ userId });
  if (pref) return pref;
  pref = await ProductivityPreference.create({
    userId,
    mode: "unset",
    notificationPreferences: DEFAULT_NOTIFICATIONS,
    quietHours: { enabled: false, start: "22:00", end: "07:00" },
  });
  return pref;
};

const elapsedMsFor = (session, now = new Date()) => {
  const accumulated = Number(session.accumulatedMs) || 0;
  if (session.status === "active" && session.startedAt && !session.pausedAt) {
    const runningFrom = session.resumedAt || session.startedAt;
    return accumulated + Math.max(0, now.getTime() - new Date(runningFrom).getTime());
  }
  if (session.status === "paused" && session.pausedAt && session.startedAt) {
    return accumulated;
  }
  if (session.endedAt && session.startedAt) {
    return Math.max(
      accumulated,
      Math.max(0, new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()),
    );
  }
  return accumulated;
};

const remainingMsFor = (session, now = new Date()) => {
  const planned = clampDuration(session.plannedDuration || session.duration) * 60 * 1000;
  return Math.max(0, planned - elapsedMsFor(session, now));
};

const accumulateRunning = (session, now = new Date()) => {
  if (session.status !== "active" || session.pausedAt) return session;
  const from = session.resumedAt || session.startedAt;
  if (!from) return session;
  session.accumulatedMs =
    (Number(session.accumulatedMs) || 0) + Math.max(0, now.getTime() - new Date(from).getTime());
  session.resumedAt = undefined;
  return session;
};

module.exports = {
  MODE_WINDOWS,
  DEFAULT_NOTIFICATIONS,
  WEEKDAYS,
  TIME_RE,
  clampWeekday,
  clampDuration,
  isTime,
  cleanTime,
  formatHourLabel,
  hourToTime,
  serializePreference,
  applyModeWindow,
  getOrCreatePreference,
  elapsedMsFor,
  remainingMsFor,
  accumulateRunning,
};
