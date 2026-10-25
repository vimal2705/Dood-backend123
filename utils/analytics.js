const AppEvent = require("../models/AppEvent");

const NAMES = new Set([
  "app_open",
  "client_error",
  "signup",
  "login",
  "dream_create",
  "action_done",
  "task_done",
  "reel_save",
  "idol_save",
  "coach_chat",
]);

const adminEmails = () =>
  String(process.env.ANALYTICS_ADMINS || "jarvisnow27@gmail.com,vimalzaptech@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const isAdminEmail = (email) => adminEmails().includes(String(email || "").trim().toLowerCase());

const cleanDetail = (value) =>
  String(value || "")
    .replace(/[\w.+-]+@[\w.-]+/g, "[email]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

const recordEvent = (userId, name, extra = {}) => {
  if (!NAMES.has(name)) return;
  AppEvent.create({
    userId: userId || null,
    name,
    platform: String(extra.platform || "").slice(0, 20),
    appVersion: String(extra.appVersion || "").slice(0, 20),
    detail: cleanDetail(extra.detail),
  }).catch(() => {});
};

const recordEvents = (userId, events = []) => {
  events.slice(0, 20).forEach((event) => {
    recordEvent(userId, event?.name, event);
  });
};

const summarySince = async (since, userId) => {
  const match = { createdAt: { $gte: since } };
  if (userId) match.userId = userId;
  const rows = await AppEvent.aggregate([
    { $match: match },
    { $group: { _id: "$name", count: { $sum: 1 } } },
  ]);
  const counts = {};
  rows.forEach((row) => {
    counts[row._id] = row.count;
  });
  const people = await AppEvent.distinct("userId", match);
  return {
    counts,
    people: people.filter(Boolean).length,
  };
};

module.exports = {
  NAMES,
  isAdminEmail,
  recordEvent,
  recordEvents,
  summarySince,
};
