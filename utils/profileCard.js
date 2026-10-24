const crypto = require("crypto");
const Dream = require("../models/Dream");
const Action = require("../models/Action");
const MoneyEntry = require("../models/MoneyEntry");
const { IDOLS } = require("./idols");
const { chatCompletion, parseJsonContent } = require("./groq");

const clamp = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const dreamKey = (dreams) =>
  crypto
    .createHash("sha256")
    .update(
      dreams
        .map((dream) => `${dream._id}:${dream.title}:${dream.type}`)
        .sort()
        .join("|"),
    )
    .digest("hex")
    .slice(0, 20);

const fallbackBio = (dreams) => {
  const titles = dreams
    .map((dream) => clamp(dream.title, 60))
    .filter(Boolean)
    .slice(0, 2);
  if (!titles.length) return "Name one dream you will pay for.";
  if (titles.length === 1) return `Paying for ${titles[0]}.`;
  return `Paying for ${titles[0]} and ${titles[1]}.`;
};

const writeBio = async (user, dreams) => {
  const idols = (user.idols || [])
    .map((id) => IDOLS.find((idol) => idol.id === id)?.name)
    .filter(Boolean);
  const payload = {
    name: user.name || "",
    idols,
    dreams: dreams.slice(0, 6).map((dream) => ({
      title: dream.title,
      type: dream.type,
      subtitle: dream.subTitle || "",
    })),
  };
  const { content } = await chatCompletion({
    messages: [
      {
        role: "system",
        content:
          'Write one profile sentence for a person from their dreams. Plain language. No hashtags. No quotation marks. Max 140 characters. Use only the dreams given. Return JSON {"bio":"one sentence"}.',
      },
      { role: "user", content: JSON.stringify(payload) },
    ],
    json: true,
    temperature: 0.4,
  });
  const bio = clamp(parseJsonContent(content)?.bio, 160);
  if (!bio || bio.length < 8) return fallbackBio(dreams);
  return bio;
};

const ensureBio = async (user, dreams) => {
  const key = dreamKey(dreams);
  if (user.dreamBio && user.dreamBioKey === key) return user.dreamBio;
  let bio = fallbackBio(dreams);
  if (dreams.length) {
    try {
      bio = await writeBio(user, dreams);
    } catch (error) {
      console.error(error);
    }
  }
  user.dreamBio = bio;
  user.dreamBioKey = key;
  await user.save();
  return bio;
};

const clubLabel = (raw) => {
  if (raw <= 0.01) return "0.01% club";
  if (raw <= 0.1) return "0.1% club";
  if (raw <= 1) return "1% club";
  return `Top ${Math.max(1, Math.round(raw))}% of people building a dream`;
};

const builderScores = async () => {
  const dreams = await Dream.find({}).select("userId type");
  const builderIds = [...new Map(dreams.map((dream) => [String(dream.userId), dream.userId])).values()];
  if (!builderIds.length) return [];
  const financeIds = dreams.filter((dream) => dream.type === "finance").map((dream) => dream._id);
  const [actions, saves] = await Promise.all([
    Action.aggregate([
      {
        $match: {
          userId: { $in: builderIds },
          status: "completed",
          dreamId: { $ne: null },
        },
      },
      { $group: { _id: "$userId", n: { $sum: 1 } } },
    ]),
    financeIds.length
      ? MoneyEntry.aggregate([
          { $match: { type: "save", dreamId: { $in: financeIds } } },
          { $group: { _id: "$userId", amount: { $sum: "$amount" } } },
        ])
      : [],
  ]);
  const actionMap = new Map(actions.map((row) => [String(row._id), row.n]));
  const saveMap = new Map(saves.map((row) => [String(row._id), row.amount]));
  return builderIds.map((id) => ({
    id: String(id),
    score: (actionMap.get(String(id)) || 0) * 10 + Math.floor((saveMap.get(String(id)) || 0) / 1000),
  }));
};

const clubFor = (userId, scores) => {
  const total = scores.length;
  const mine = scores.find((row) => row.id === String(userId));
  if (!mine) {
    return { label: "Name a dream to join.", builders: total };
  }
  if (total < 2) {
    return { label: "The only person building a dream here.", builders: total, rank: 1 };
  }
  const better = scores.filter((row) => row.score > mine.score).length;
  const raw = ((better + 1) / total) * 100;
  return {
    label: clubLabel(raw),
    builders: total,
    rank: better + 1,
  };
};

const buildProfileCard = async (user) => {
  const dreams = await Dream.find({ userId: user._id }).sort({ updatedAt: -1 }).limit(8);
  const [bio, scores] = await Promise.all([
    ensureBio(user, dreams),
    builderScores(),
  ]);
  const club = clubFor(user._id, scores);
  return { bio, club };
};

module.exports = { buildProfileCard, clubLabel, fallbackBio };
