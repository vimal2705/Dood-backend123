const mongoose = require("mongoose");

const focusSessionSchema = new mongoose.Schema(
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
    plannedDuration: {
      type: Number,
      required: true,
      min: 10,
      max: 180,
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
      enum: ["scheduled", "active", "paused", "completed", "abandoned", "interrupted"],
      default: "scheduled",
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
  },
  { timestamps: true },
);

focusSessionSchema.index({ userId: 1, status: 1 });
focusSessionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("FocusSession", focusSessionSchema);
