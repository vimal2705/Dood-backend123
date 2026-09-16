const QUOTES = {
  exam: [
    { line: "It always seems impossible until it's done.", by: "Nelson Mandela" },
    { line: "The secret of getting ahead is getting started.", by: "Mark Twain" },
    { line: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", by: "Aristotle" },
    { line: "I have not failed. I've just found 10,000 ways that won't work.", by: "Thomas Edison" },
    { line: "The expert in anything was once a beginner.", by: "Helen Hayes" },
    { line: "Success is the sum of small efforts, repeated day in and day out.", by: "Robert Collier" },
    { line: "Do the work. The grade is a side effect.", by: "Dood" },
  ],
  business: [
    { line: "The way to get started is to quit talking and begin doing.", by: "Walt Disney" },
    { line: "Your most unhappy customers are your greatest source of learning.", by: "Bill Gates" },
    { line: "Done is better than perfect.", by: "Sheryl Sandberg" },
    { line: "Opportunities don't happen. You create them.", by: "Chris Grosser" },
    { line: "Make something people want.", by: "Paul Graham" },
    { line: "The best time to plant a tree was 20 years ago. The second best time is now.", by: "Chinese proverb" },
    { line: "One result today beats ten ideas tomorrow.", by: "Dood" },
  ],
  sport: [
    { line: "You miss 100% of the shots you don't take.", by: "Wayne Gretzky" },
    { line: "It's not whether you get knocked down, it's whether you get up.", by: "Vince Lombardi" },
    { line: "Champions keep playing until they get it right.", by: "Billie Jean King" },
    { line: "The more I practice, the luckier I get.", by: "Gary Player" },
    { line: "Hard work beats talent when talent doesn't work hard.", by: "Tim Notke" },
    { line: "Pain is temporary. Quitting lasts the whole season.", by: "Dood" },
    { line: "Show up. Warm up. Do the rep.", by: "Dood" },
  ],
  home: [
    { line: "The strength of a nation derives from the integrity of the home.", by: "Confucius" },
    { line: "Have nothing in your houses that you do not know to be useful or believe to be beautiful.", by: "William Morris" },
    { line: "The ornament of a house is the friends who frequent it.", by: "Ralph Waldo Emerson" },
    { line: "Home is the starting place of love, hope and dreams.", by: "Anonymous" },
    { line: "A house is made of walls and beams; a home is built with love and days.", by: "Anonymous" },
    { line: "Put the house in order before you add more rooms.", by: "Dood" },
    { line: "One chore finished is a quieter home.", by: "Dood" },
  ],
  money: [
    { line: "Do not save what is left after spending, but spend what is left after saving.", by: "Warren Buffett" },
    { line: "Beware of little expenses; a small leak will sink a great ship.", by: "Benjamin Franklin" },
    { line: "A penny saved is a penny earned.", by: "Benjamin Franklin" },
    { line: "Wealth consists not in having great possessions, but in having few wants.", by: "Epictetus" },
    { line: "The habit of saving is itself an education.", by: "T. T. Munger" },
    { line: "Pay yourself first. Then pay the world.", by: "Dood" },
    { line: "Today's small save is tomorrow's emergency fund.", by: "Dood" },
  ],
  default: [
    { line: "The secret of getting ahead is getting started.", by: "Mark Twain" },
    { line: "It always seems impossible until it's done.", by: "Nelson Mandela" },
    { line: "You miss 100% of the shots you don't take.", by: "Wayne Gretzky" },
    { line: "The way to get started is to quit talking and begin doing.", by: "Walt Disney" },
    { line: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", by: "Aristotle" },
  ],
};

const INTENT_OPENER = {
  exam: "Charge up. Study like it counts.",
  business: "Charge up. Build one thing today.",
  sport: "Charge up. Train like game day.",
  home: "Charge up. Make the house lighter.",
  money: "Charge up. Move the money, not the worry.",
  default: "Charge up. One result today.",
};

const dayIndex = (date = new Date()) => {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / (24 * 60 * 60 * 1000));
};

const pickMorningQuote = (intent, date = new Date()) => {
  const key = QUOTES[intent] ? intent : "default";
  const list = QUOTES[key];
  const quote = list[Math.abs(dayIndex(date)) % list.length];
  const opener = INTENT_OPENER[key] || INTENT_OPENER.default;
  return {
    intent: key,
    opener,
    line: quote.line,
    by: quote.by,
    title: opener,
    body: `${quote.line} — ${quote.by}`,
  };
};

module.exports = {
  QUOTES,
  pickMorningQuote,
};
