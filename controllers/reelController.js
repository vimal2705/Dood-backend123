const { validationResult } = require("express-validator");
const Reel = require("../models/Reel");
const { parseReelUrl } = require("../utils/reelUrl");

const MAX_REELS = 40;

const serialize = reel => ({
  id: String(reel._id),
  platform: reel.platform,
  url: reel.url,
  embedUrl: reel.embedUrl || "",
  thumbnailUrl: reel.thumbnailUrl || "",
  externalId: reel.externalId || "",
  createdAt: reel.createdAt,
});

exports.listReels = async (req, res) => {
  try {
    const reels = await Reel.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json({ success: true, reels: reels.map(serialize) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not load reels" });
  }
};

exports.createReel = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const parsed = parseReelUrl(req.body.url);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: "Paste an Instagram reel, a YouTube Short, or a link.",
      });
    }

    const existing = await Reel.findOne({ userId: req.user.id, url: parsed.url });
    if (existing) {
      return res.json({ success: true, reel: serialize(existing) });
    }

    const count = await Reel.countDocuments({ userId: req.user.id });
    if (count >= MAX_REELS) {
      return res.status(400).json({
        success: false,
        message: "You can save 40 reels. Remove one to add another.",
      });
    }

    const reel = await Reel.create({ userId: req.user.id, ...parsed });
    return res.status(201).json({ success: true, reel: serialize(reel) });
  } catch (error) {
    if (error?.code === 11000) {
      const parsed = parseReelUrl(req.body.url);
      const existing = parsed
        ? await Reel.findOne({ userId: req.user.id, url: parsed.url })
        : null;
      if (existing) return res.json({ success: true, reel: serialize(existing) });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not save reel" });
  }
};

exports.deleteReel = async (req, res) => {
  try {
    const reel = await Reel.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!reel) {
      return res.status(404).json({ success: false, message: "Reel not found" });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not remove reel" });
  }
};
