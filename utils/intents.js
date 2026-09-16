const INTENTS = ["exam", "business", "sport", "home", "money"];

const INTENT_COACH = {
  exam: "They are building toward an exam. Prefer study blocks, recall, and dated revision over new projects.",
  business: "They are building a business. Prefer one customer, one offer, or one revenue step over busywork.",
  sport: "They are building toward sport. Prefer training load, recovery, and the next session over extra goals.",
  home: "They are building a home. Prefer finishing one room or chore over starting a new renovation.",
  money: "They are building money. Prefer a transfer, a cap on spend, and the finance dream target over vague saving talk.",
};

const intentCoachLine = (intent) => {
  if (!INTENTS.includes(intent)) return "";
  return INTENT_COACH[intent];
};

module.exports = { INTENTS, intentCoachLine };
