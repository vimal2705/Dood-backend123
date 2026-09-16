const mongoose = require("mongoose");

const challengeSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dreamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dream",
      default: null,
    },
    actionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Action",
      default: null,
    },
    todoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    coachMessage: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
    duration: {
      type: Number,
      required: true,
      min: 10,
      max: 180,
      default: 60,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    pausedAt: {
      type: Date,
      default: null,
    },
    resumedAt: {
      type: Date,
      default: null,
    },
    accumulatedMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["suggested", "active", "paused", "completed", "declined", "dropped"],
      default: "suggested",
    },
    outcome: {
      type: String,
      enum: ["done", "partly", "open", "stopped", "dropped", ""],
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
    focusSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FocusSession",
      default: null,
    },
  },
  { timestamps: true },
);

challengeSessionSchema.index({ userId: 1, status: 1 });
challengeSessionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ChallengeSession", challengeSessionSchema);
