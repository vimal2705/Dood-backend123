const catalog = require("../data/idols.json");

const STANDARDS = {
  leader: "Ask for one finished result they can name, not a hope.",
  business: "Ask for one customer, one offer, or one money step they control.",
  sport: "Ask for the next session or the attempt they are avoiding.",
  science: "Ask for the next fact they will test, not another plan.",
  letters: "Ask for the habit they will repeat, not a new dream.",
  culture: "Ask for the piece of work they will finish today.",
};

const LINE_OVERRIDES = {
  mandela: "Ask for one finished result, not a hope.",
  twain: "Ask what they will start today. Starting beats planning.",
  disney: "Ask them to stop talking and name the first action.",
  sandberg: "Prefer a finished result over a perfect plan.",
  gretzky: "Ask for the attempt they are avoiding.",
  king: "If the last attempt failed, ask for the next one, not a new dream.",
  buffett: "Ask for one money step they control. If they spent and saved nothing toward a finance dream, say so.",
  aristotle: "Ask for the action they will repeat, not a new dream.",
};

const IDOLS = catalog.map((idol) => ({
  id: idol.id,
  name: idol.name,
  group: idol.group,
  line: LINE_OVERRIDES[idol.id] || STANDARDS[idol.group] || STANDARDS.letters,
}));

const MAX_IDOLS = 3;
const IDOL_IDS = IDOLS.map((idol) => idol.id);

const normalizeIdols = (value) => {
  if (!Array.isArray(value)) return [];
  const ids = [];
  value.forEach((item) => {
    const id = String(item || "").trim().toLowerCase();
    if (!IDOL_IDS.includes(id) || ids.includes(id) || ids.length >= MAX_IDOLS) return;
    ids.push(id);
  });
  return ids;
};

const idolPromptBlock = (value) => {
  const chosen = normalizeIdols(value)
    .map((id) => IDOLS.find((idol) => idol.id === id))
    .filter(Boolean);
  if (!chosen.length) return "";
  const names = chosen.map((idol) => idol.name).join(", ");
  const rules = chosen.map((idol) => `- ${idol.name}: ${idol.line}`).join("\n");
  return `This user's idols are ${names}. Ask in their standard. Use only this user's dreams, actions, and to-dos.
${rules}
Do not invent a quote or a biography.`;
};

module.exports = {
  IDOLS,
  IDOL_IDS,
  MAX_IDOLS,
  normalizeIdols,
  idolPromptBlock,
};
