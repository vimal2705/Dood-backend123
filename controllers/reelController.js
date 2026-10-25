const crypto = require("crypto");
const { validationResult } = require("express-validator");
const Reel = require("../models/Reel");
const { parseReelUrl } = require("../utils/reelUrl");
const { deleteByUrls, putObject } = require("../utils/r2");
const { downloadVideo, extensionFor, looksLikeVideoUrl } = require("../utils/reelFile");
const { recordEvent } = require("../utils/analytics");

const MAX_REELS = 40;

const storedReel = (publicUrl, contentType) => ({
  platform: "file",
  url: publicUrl,
  embedUrl: publicUrl,
  thumbnailUrl: "",
  externalId: "",
  contentType: contentType || "video/mp4",
});

const ensureRoom = async userId => {
  const count = await Reel.countDocuments({ userId });
  if (count >= MAX_REELS) {
    const error = new Error("You can save 40 reels. Remove one to add another.");
    error.status = 400;
    throw error;
  }
};

const saveStoredVideo = async (userId, { buffer, contentType, extension }) => {
  await ensureRoom(userId);
  const key = `reels/${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const publicUrl = await putObject({
    key,
    body: buffer,
    contentType,
  });
  const existing = await Reel.findOne({ userId, url: publicUrl });
  if (existing) return existing;
  return Reel.create({ userId, ...storedReel(publicUrl, contentType) });
};

const serialize = reel => ({
  id: String(reel._id),
  platform: reel.platform,
  url: reel.url,
  embedUrl: reel.embedUrl || "",
  thumbnailUrl: reel.thumbnailUrl || "",
  externalId: reel.externalId || "",
  contentType: reel.contentType || "",
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
        message: "Paste an Instagram reel, a YouTube Short, or a video link.",
      });
    }

    if (looksLikeVideoUrl(parsed.url)) {
      const file = await downloadVideo(parsed.url);
      const reel = await saveStoredVideo(req.user.id, file);
      recordEvent(req.user.id, "reel_save");
      return res.status(201).json({ success: true, reel: serialize(reel) });
    }

    const existing = await Reel.findOne({ userId: req.user.id, url: parsed.url });
    if (existing) {
      return res.json({ success: true, reel: serialize(existing) });
    }

    await ensureRoom(req.user.id);
    const reel = await Reel.create({ userId: req.user.id, ...parsed });
    recordEvent(req.user.id, "reel_save");
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
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Could not save reel",
    });
  }
};

exports.uploadReelFile = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Choose a video first",
      });
    }

    const contentType = String(req.file.mimetype || "video/mp4").split(";")[0];
    const reel = await saveStoredVideo(req.user.id, {
      buffer: req.file.buffer,
      contentType: contentType.startsWith("video/") ? contentType : "video/mp4",
      extension: extensionFor(contentType, req.file.originalname),
    });
    recordEvent(req.user.id, "reel_save");
    return res.status(201).json({ success: true, reel: serialize(reel) });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Could not upload video",
    });
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
    await deleteByUrls([reel.url]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not remove reel" });
  }
};
