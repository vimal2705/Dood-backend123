const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const monthBounds = (from = new Date()) => {
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(from.getFullYear(), from.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const summarizeMoney = (entries, financeDreams = []) => {
  const list = Array.isArray(entries) ? entries : [];
  let income = 0;
  let spent = 0;
  let saved = 0;
  const byCategory = {};

  list.forEach((entry) => {
    const amount = roundMoney(entry.amount);
    const category = entry.category || "other";
    if (entry.type === "in") income += amount;
    if (entry.type === "out") spent += amount;
    if (entry.type === "save") saved += amount;
    if (!byCategory[category]) {
      byCategory[category] = { category, in: 0, out: 0, save: 0 };
    }
    if (entry.type === "in") byCategory[category].in += amount;
    if (entry.type === "out") byCategory[category].out += amount;
    if (entry.type === "save") byCategory[category].save += amount;
  });

  income = roundMoney(income);
  spent = roundMoney(spent);
  saved = roundMoney(saved);
  const net = roundMoney(income - spent);
  const leftover = roundMoney(income - spent - saved);

  const topSpend = Object.values(byCategory)
    .filter((item) => item.out > 0)
    .sort((a, b) => b.out - a.out)[0];

  const dream = financeDreams[0] || null;
  let insight = "Log one money move. A line like “spent 200 coffee” is enough.";
  let nextMove = { title: "Log today’s spend", reason: "Money only helps if it is visible." };

  if (list.length) {
    if (spent > income && income > 0) {
      insight = "This month outflow is bigger than inflow. Cut one spend before you add a new money dream.";
      nextMove = {
        title: "Cancel or skip one purchase today",
        reason: "Spent more than you brought in.",
      };
    } else if (saved === 0 && income > 0) {
      insight = "Income came in, but nothing moved to savings.";
      nextMove = {
        title: "Move a small amount to savings",
        reason: "A finance dream needs a transfer, not a wish.",
      };
    } else if (topSpend && spent > 0 && topSpend.out / spent >= 0.4) {
      insight = `Most spending is going to ${topSpend.category}.`;
      nextMove = {
        title: `Cap ${topSpend.category} spend this week`,
        reason: "One category is eating the month.",
      };
    } else if (dream && saved > 0) {
      insight = `₹${saved.toLocaleString("en-IN")} saved this month toward ${dream.title}.`;
      nextMove = {
        title: `Add one to-do for ${dream.title}`,
        reason: "Keep the money dream on today’s list.",
      };
    } else if (net >= 0) {
      insight = `In ₹${income.toLocaleString("en-IN")} · out ₹${spent.toLocaleString("en-IN")}. Saved ₹${saved.toLocaleString("en-IN")}.`;
      nextMove = {
        title: "Log the next spend as it happens",
        reason: "Keep the picture honest.",
      };
    }
  }

  return {
    income,
    spent,
    saved,
    net,
    leftover,
    count: list.length,
    byCategory: Object.values(byCategory)
      .map((item) => ({
        category: item.category,
        in: roundMoney(item.in),
        out: roundMoney(item.out),
        save: roundMoney(item.save),
      }))
      .sort((a, b) => b.out + b.save + b.in - (a.out + a.save + a.in)),
    insight,
    nextMove,
    financeDream: dream
      ? { id: String(dream._id || dream.id), title: dream.title }
      : null,
  };
};

module.exports = {
  monthBounds,
  summarizeMoney,
  roundMoney,
};
