const mongoose = require("mongoose");

const appEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },
  name: {
    type: String,
    required: true,
    maxlength: 40,
    index: true,
  },
  platform: {
    type: String,
    maxlength: 20,
    default: "",
  },
  appVersion: {
    type: String,
    maxlength: 20,
    default: "",
  },
  detail: {
    type: String,
    maxlength: 180,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 90,
  },
});

module.exports = mongoose.model("AppEvent", appEventSchema);
