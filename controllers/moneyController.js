const { validationResult } = require("express-validator");
const MoneyEntry = require("../models/MoneyEntry");
const Dream = require("../models/Dream");
const { parseMoneyInput, CATEGORIES, TYPES } = require("../utils/moneyParse");
const { monthBounds, summarizeMoney, roundMoney } = require("../utils/moneyInsights");

const attachFinanceDream = async (userId, type, dreamId) => {
  if (dreamId) {
    const dream = await Dream.findOne({ _id: dreamId, userId });
    return dream ? dream._id : null;
  }
  if (type !== "save") return null;
  const financeDream = await Dream.findOne({ userId, type: "finance" }).sort({
    updatedAt: -1,
  });
  return financeDream?._id || null;
};

exports.parseMoney = async (req, res) => {
  const parsed = parseMoneyInput(req.body?.text);
  if (!parsed) {
    return res.status(400).json({
      success: false,
      message: "Could not find an amount. Try “spent 450 lunch”.",
    });
  }
  return res.json({ success: true, parsed });
};

exports.createMoney = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const fromText = req.body.text ? parseMoneyInput(req.body.text) : null;
    const type = TYPES.includes(req.body.type) ? req.body.type : fromText?.type;
    const amount = roundMoney(req.body.amount || fromText?.amount);
    const note = String(req.body.note || fromText?.note || "").trim().slice(0, 100);
    const category = CATEGORIES.includes(req.body.category)
      ? req.body.category
      : fromText?.category || "other";

    if (!type || !amount) {
      return res.status(400).json({
        success: false,
        message: "Need an amount. Try “spent 450 lunch” or “saved 2000”.",
      });
    }

    const dreamId = await attachFinanceDream(req.user.id, type, req.body.dreamId);

    const entry = await MoneyEntry.create({
      userId: req.user.id,
      type,
      amount,
      note: note || (type === "in" ? "Income" : type === "save" ? "Saved" : "Spend"),
      category,
      dreamId,
      happenedAt: req.body.happenedAt || new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Logged",
      entry,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.listMoney = async (req, res) => {
  try {
    const entries = await MoneyEntry.find({ userId: req.user.id })
      .sort({ happenedAt: -1 })
      .limit(60)
      .populate("dreamId", "title type");

    return res.json({
      success: true,
      count: entries.length,
      entries,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.moneyStats = async (req, res) => {
  try {
    const { start, end } = monthBounds();
    const [entries, financeDreams] = await Promise.all([
      MoneyEntry.find({
        userId: req.user.id,
        happenedAt: { $gte: start, $lte: end },
      }),
      Dream.find({ userId: req.user.id, type: "finance" }).sort({ updatedAt: -1 }).limit(3),
    ]);

    const stats = summarizeMoney(entries, financeDreams);
    return res.json({
      success: true,
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      stats,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteMoney = async (req, res) => {
  try {
    const entry = await MoneyEntry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }
    return res.json({ success: true, message: "Removed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
