const User = require("../models/User");
const { isAdminEmail, recordEvents, summarySince } = require("../utils/analytics");

exports.ingest = async (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  recordEvents(req.user.id, events);
  return res.json({ success: true });
};

exports.summary = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("email");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const admin = isAdminEmail(user.email);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const week = await summarySince(since, admin ? null : user._id);
    return res.json({
      success: true,
      admin,
      days: 7,
      people: week.people,
      counts: week.counts,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load analytics" });
  }
};
