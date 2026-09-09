const TYPES = ["in", "out", "save"];

const TYPE_WORDS = {
  in: ["got", "earned", "salary", "income", "received", "freelance", "stipend", "credited"],
  out: ["spent", "paid", "bought", "cost", "bill", "debit"],
  save: ["saved", "save", "sip", "invested", "investment", "emergency fund"],
};

const CATEGORY_WORDS = {
  food: ["lunch", "dinner", "breakfast", "coffee", "food", "grocery", "groceries", "swiggy", "zomato", "cafe"],
  rent: ["rent", "hostel", "pg"],
  travel: ["uber", "ola", "metro", "fuel", "petrol", "cab", "bus", "train", "flight"],
  fun: ["movie", "game", "netflix", "party"],
  bills: ["electric", "wifi", "phone", "emi", "recharge", "internet"],
  health: ["medicine", "gym", "doctor", "hospital"],
  work: ["client", "office", "software"],
  income: ["salary", "freelance", "stipend"],
  save: ["sip", "emergency", "invest", "mutual"],
};

const CATEGORIES = [
  "food",
  "rent",
  "travel",
  "fun",
  "bills",
  "health",
  "work",
  "income",
  "save",
  "other",
];

const parseAmount = (text) => {
  const match = String(text || "").match(
    /(?:₹|rs\.?\s*)?(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?/i,
  );
  if (!match) return null;
  const whole = match[1].replace(/,/g, "");
  const cents = match[2] || "0";
  const amount = Number(`${whole}.${cents}`);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount: Math.round(amount * 100) / 100, raw: match[0] };
};

const detectType = (lower) => {
  const ranked = TYPES.map((type) => ({
    type,
    hit: TYPE_WORDS[type].some((word) => lower.includes(word)),
  })).filter((item) => item.hit);
  return ranked[0]?.type || null;
};

const detectCategory = (lower, type) => {
  const match = Object.entries(CATEGORY_WORDS).find(([, words]) =>
    words.some((word) => lower.includes(word)),
  );
  if (match) return match[0];
  if (type === "in") return "income";
  if (type === "save") return "save";
  return "other";
};

const parseMoneyInput = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const amountInfo = parseAmount(raw);
  if (!amountInfo) return null;

  const lower = raw.toLowerCase();
  const type = detectType(lower) || "out";
  const category = detectCategory(lower, type);

  let note = raw;
  note = note.replace(amountInfo.raw, " ");
  [...TYPE_WORDS.in, ...TYPE_WORDS.out, ...TYPE_WORDS.save, "rs", "₹", "on", "for", "to"].forEach(
    (word) => {
      note = note.replace(new RegExp(`\\b${word}\\b`, "ig"), " ");
    },
  );
  note = note.replace(/\s+/g, " ").trim() || (type === "in" ? "Income" : type === "save" ? "Saved" : "Spend");

  return {
    type,
    amount: amountInfo.amount,
    note: note.slice(0, 100),
    category,
  };
};

module.exports = {
  TYPES,
  CATEGORIES,
  parseMoneyInput,
};
