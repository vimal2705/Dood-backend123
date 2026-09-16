const mongoose = require("mongoose");

const timeString = {
  type: String,
  trim: true,
  default: "",
};

const productivityPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    mode: {
      type: String,
      enum: ["morning", "afternoon", "evening", "peak", "unset"],
      default: "unset",
    },
    preferredStartTime: { ...timeString, default: "09:00" },
    preferredEndTime: { ...timeString, default: "18:00" },
    peakHour: { ...timeString, default: "" },
    focusDuration: {
      type: Number,
      default: 60,
      min: 10,
      max: 180,
    },
    eveningShutdownTime: { ...timeString, default: "18:00" },
    smartNotificationsEnabled: {
      type: Boolean,
      default: true,
    },
    notificationPreferences: {
      missedTodo: { type: Boolean, default: true },
      peakHour: { type: Boolean, default: true },
      dreamWarning: { type: Boolean, default: true },
      focusStarting: { type: Boolean, default: false },
      focusEnding: { type: Boolean, default: true },
      challengeHour: { type: Boolean, default: true },
      eveningShutdown: { type: Boolean, default: true },
      weeklyReview: { type: Boolean, default: true },
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { ...timeString, default: "22:00" },
      end: { ...timeString, default: "07:00" },
    },
    challengeEnabled: {
      type: Boolean,
      default: true,
    },
    timezone: {
      type: String,
      trim: true,
      default: "",
    },
    peakHourConfirmed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "ProductivityPreference",
  productivityPreferenceSchema,
);
