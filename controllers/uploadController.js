const crypto = require("crypto");
const { putObject } = require("../utils/r2");

const extensionFor = (mimetype = "") => {
  if (mimetype.includes("png")) return "png";
  if (mimetype.includes("webp")) return "webp";
  if (mimetype.includes("gif")) return "gif";
  if (mimetype.includes("heic") || mimetype.includes("heif")) return "heic";
  return "jpg";
};

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Choose an image first",
      });
    }

    const key = `dreams/${Date.now()}-${crypto.randomUUID()}.${extensionFor(req.file.mimetype)}`;
    const url = await putObject({
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype || "image/jpeg",
    });

    return res.status(201).json({
      success: true,
      url,
    });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Could not upload image",
    });
  }
};
