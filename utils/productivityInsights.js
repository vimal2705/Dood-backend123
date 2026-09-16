const Task = require("../models/Task");
const FocusSession = require("../models/FocusSession");
const ChallengeSession = require("../models/ChallengeSession");
const ProductivityInsight = require("../models/ProductivityInsight");
const { startOfDay } = require("./dreamProgress");
const {
  getOrCreatePreference,
  serializePreference,
  hourToTime,
  formatHourLabel,
} = require("./productivity");

const MIN_COMPLETIONS_ENOUGH = 14;
const MIN_DAYS_ENOUGH = 5;
const MIN_COMPLETIONS_LOW = 5;
const MIN_DAYS_LOW = 3;
const MIN_HOUR_COUNT = 3;

const lookbackStart = () => {
  const from = startOfDay();
  from.setDate(from.getDate() - 28);
  return from;
};

const hourOf = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours();
};

const dayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const computeInsights = async (userId) => {
  const from = lookbackStart();
  const [tasks, pref, focusCount, challengeCount] = await Promise.all([
    Task.find({ userId }).setOptions({ _recursed: true }),
    getOrCreatePreference(userId),
    FocusSession.countDocuments({
      userId,
      status: "completed",
      endedAt: { $gte: from },
    }),
    ChallengeSession.countDocuments({
      userId,
      status: "completed",
      endedAt: { $gte: from },
    }),
  ]);

  const completed = tasks.filter(
    (task) => task.isCompleted && task.completedDate && new Date(task.completedDate) >= from,
  );
  const missed = tasks.filter((task) => !task.isCompleted && task.missedFrom);

  const byHour = Array.from({ length: 24 }, () => 0);
  const days = new Set();
  completed.forEach((task) => {
    const hour = hourOf(task.completedDate);
    if (hour === null) return;
    byHour[hour] += 1;
    days.add(dayKey(task.completedDate));
  });

  let topHour = 0;
  let topCount = 0;
  byHour.forEach((count, hour) => {
    if (count > topCount) {
      topCount = count;
      topHour = hour;
    }
  });

  const completedCount = completed.length;
  const distinctDays = days.size;

  let dataSufficiency = "insufficient";
  if (completedCount >= MIN_COMPLETIONS_ENOUGH && distinctDays >= MIN_DAYS_ENOUGH && topCount >= MIN_HOUR_COUNT) {
    dataSufficiency = "enough";
  } else if (completedCount >= MIN_COMPLETIONS_LOW && distinctDays >= MIN_DAYS_LOW) {
    dataSufficiency = "low";
  }

  const suggestedPeakHour =
    dataSufficiency === "enough" ? hourToTime(topHour) : "";

  const confidence =
    dataSufficiency === "insufficient"
      ? 0
      : Math.min(
          1,
          Number(
            (
              (completedCount / 28) * 0.5 +
              (distinctDays / 14) * 0.3 +
              (topCount / Math.max(completedCount, 1)) * 0.2
            ).toFixed(2),
          ),
        );

  const serializedPref = serializePreference(pref);
  const summary = {
    completedCount,
    missedCount: missed.length,
    distinctDays,
    topHourCount: topCount,
    focusSessionsCompleted: focusCount,
    challengeSessionsCompleted: challengeCount,
  };

  let supportingSummary = "Not enough completed work to suggest a peak hour.";
  if (dataSufficiency === "low") {
    supportingSummary =
      "There is a pattern starting to form, but not enough days to change your peak hour.";
  } else if (dataSufficiency === "enough") {
    supportingSummary = `You complete more planned work around ${formatHourLabel(suggestedPeakHour)}.`;
  }

  const insight = await ProductivityInsight.findOneAndUpdate(
    { userId },
    {
      userId,
      suggestedPeakHour,
      mode: serializedPref.mode,
      dataSufficiency,
      confidence: dataSufficiency === "enough" ? confidence : Math.min(confidence, 0.4),
      completionSummary: summary,
      generatedAt: new Date(),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return {
    currentMode: serializedPref.mode,
    preferredTime: serializedPref.peakHour || serializedPref.preferredStartTime,
    suggestedPeakHour: dataSufficiency === "enough" ? suggestedPeakHour : null,
    suggestedPeakHourLabel:
      dataSufficiency === "enough" ? formatHourLabel(suggestedPeakHour) : "",
    currentPeakHour: serializedPref.peakHour || "",
    currentPeakHourLabel: serializedPref.peakHourLabel,
    dataSufficiency,
    confidence: insight.confidence,
    supportingSummary,
    completionSummary: summary,
    lastUpdated: insight.generatedAt,
    askToChange:
      dataSufficiency === "enough" &&
      suggestedPeakHour &&
      suggestedPeakHour !== serializedPref.peakHour,
  };
};

module.exports = {
  computeInsights,
};
