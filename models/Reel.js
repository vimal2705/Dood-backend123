const mongoose = require("mongoose");

const reelSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["instagram", "youtube", "link", "file"],
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    embedUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    externalId: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "",
    },
    contentType: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
  },
  { timestamps: true },
);

reelSchema.index({ url: 1 }, { unique: true });

module.exports = mongoose.model("Reel", reelSchema);
