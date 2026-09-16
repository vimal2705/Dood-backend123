const mongoose = require("mongoose");

const productivityInsightSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    suggestedPeakHour: {
      type: String,
      trim: true,
      default: "",
    },
    mode: {
      type: String,
      enum: ["morning", "afternoon", "evening", "peak", "unset"],
      default: "unset",
    },
    dataSufficiency: {
      type: String,
      enum: ["insufficient", "low", "enough"],
      default: "insufficient",
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    completionSummary: {
      completedCount: { type: Number, default: 0 },
      missedCount: { type: Number, default: 0 },
      distinctDays: { type: Number, default: 0 },
      topHourCount: { type: Number, default: 0 },
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ProductivityInsight", productivityInsightSchema);
