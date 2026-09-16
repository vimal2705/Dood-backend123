require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Dream = require('../models/Dream');
const Action = require('../models/Action');
const Task = require('../models/Task');
const Idea = require('../models/Idea');
const Note = require('../models/Note');
const MoneyEntry = require('../models/MoneyEntry');
const { syncAllDreamProgress } = require('../utils/dreamProgress');

const EMAIL = 'demo@dood.app';
const PASSWORD = 'Demo1234';

const at = (daysFromNow, hour = 18) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const todayKey = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const seed = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  let user = await User.findOne({ email: EMAIL }).select('+password');
  if (!user) {
    user = await User.create({
      name: 'Demo Tester',
      email: EMAIL,
      username: 'dooddemo',
      password: PASSWORD,
      phoneNumber: '9876543210',
      dob: new Date('1996-04-12'),
      intent: 'business',
    });
  } else {
    user.intent = 'business';
    user.name = 'Demo Tester';
  }

  user.morningNote = 'Close yesterday’s delayed to-dos before you add a new dream.';
  user.morningNoteOn = todayKey();
  user.eveningNote = '';
  user.eveningNoteOn = '';
  user.lastWeeklyReviewOn = '';
  await user.save();

  const userId = user._id;
  await Promise.all([
    Dream.deleteMany({ userId }),
    Action.deleteMany({ userId }),
    Task.deleteMany({ userId }),
    Idea.deleteMany({ userId }),
    Note.deleteMany({ userId }),
    MoneyEntry.deleteMany({ userId }),
  ]);

  const [launch, marathon, fund] = await Dream.create([
    {
      userId,
      title: 'Get 10 people paying for Dood',
      subTitle: 'A live product people open every morning',
      description: 'I will put nights and weekends into this until 10 people pay.',
      type: 'work',
      priority: 'top',
      status: 'boosted',
      targetDate: at(40),
      points: ['Ship a daily loop', 'Collect honest feedback', 'Charge something small'],
    },
    {
      userId,
      title: 'Finish a half marathon',
      subTitle: '21.1 km without quitting the block',
      description: 'I do not have the full plan yet. I am paying with training time.',
      type: 'achievement',
      priority: 'high',
      status: 'in progress',
      targetDate: at(80),
      points: ['Run 3 days a week', 'One long run', 'Do not get injured'],
    },
    {
      userId,
      title: 'Build a ₹1 lakh emergency fund',
      subTitle: 'Pay for safety before lifestyle',
      description: 'Move money on payday. Do not wait for leftover cash.',
      type: 'finance',
      priority: 'high',
      status: 'in progress',
      targetDate: at(120),
      targetAmount: 100000,
      points: ['Auto-transfer on salary day', 'Cut one subscription', 'Log every spend'],
    },
  ]);

  const [copy, testers, testflight, droppedGraphs, build, longRun, rest, transfer, cutSub, hysa] =
    await Action.create([
      {
        userId,
        dreamId: launch._id,
        title: 'Write onboarding that names the 3 layers',
        description: 'Dream = pay to achieve. Action = result. To-do = today.',
        priority: 'high',
        status: 'completed',
        dueDate: at(-18),
        completedDate: at(-16),
      },
      {
        userId,
        dreamId: launch._id,
        title: 'Invite 5 people who already fail at to-do apps',
        description: 'Friends who dump goals in Notes.',
        priority: 'high',
        status: 'in progress',
        dueDate: at(2),
      },
      {
        userId,
        dreamId: launch._id,
        title: 'Ship a TestFlight build this week',
        description: 'A result I can control: a build in testers’ phones.',
        priority: 'high',
        status: 'not started',
        dueDate: at(5),
      },
      {
        userId,
        dreamId: launch._id,
        title: 'Add streak graphs for every hour',
        description: 'Dropped. Fights the product.',
        priority: 'low',
        status: 'dropped',
        dueDate: at(-10),
      },
      {
        userId,
        dreamId: marathon._id,
        title: 'Complete a 12-week base',
        description: 'A result: 12 weeks of 3 runs, logged.',
        priority: 'medium',
        status: 'in progress',
        dueDate: at(21),
      },
      {
        userId,
        dreamId: marathon._id,
        title: 'Finish a 12 km long run',
        description: 'Easy pace. Walk breaks allowed.',
        priority: 'medium',
        status: 'not started',
        dueDate: at(6),
      },
      {
        userId,
        dreamId: marathon._id,
        title: 'Join a paid running club this month',
        description: 'Dropped. Too much travel.',
        priority: 'low',
        status: 'dropped',
        dueDate: at(-4),
      },
      {
        userId,
        dreamId: fund._id,
        title: 'Set up auto-transfer of ₹5,000',
        description: 'Payday, before spending.',
        priority: 'high',
        status: 'completed',
        dueDate: at(-22),
        completedDate: at(-21),
      },
      {
        userId,
        dreamId: fund._id,
        title: 'Cancel one recurring spend',
        description: 'A result: money that used to leak now saves.',
        priority: 'high',
        status: 'in progress',
        dueDate: at(1),
      },
      {
        userId,
        dreamId: fund._id,
        title: 'Open a high-yield savings pocket',
        description: 'Park the emergency fund away from the debit card.',
        priority: 'medium',
        status: 'not started',
        dueDate: at(9),
      },
    ]);

  const monthTodos = [];
  const dailyTitles = [
    ['Log yesterday’s spend', fund._id, transfer._id],
    ['Write 20 minutes of Dood copy', launch._id, copy._id],
    ['Easy 4 km jog', marathon._id, build._id],
    ['Inbox to zero for 15 minutes', launch._id, testers._id],
    ['Prep one simple dinner', null, null],
    ['Move ₹500 to savings', fund._id, transfer._id],
    ['Stretch and foam roll', marathon._id, build._id],
  ];

  for (let offset = -29; offset <= 2; offset += 1) {
    const [title, dreamId, actionId] = dailyTitles[(offset + 29) % dailyTitles.length];
    const due = at(offset, 18);
    const isFuture = offset > 0;
    const isToday = offset === 0;
    const complete = !isFuture && !isToday && offset % 4 !== 0;
    monthTodos.push({
      userId,
      title,
      description: offset < 0 ? 'From the last month of dummy days.' : 'Seeded for testing.',
      dreamId,
      actionId,
      priority: offset % 5 === 0 ? 'high' : 'medium',
      dueDate: due,
      isCompleted: complete,
      completedDate: complete ? at(offset, 20) : null,
      estimatedTime: 25,
      createdAt: due,
      updatedAt: due,
    });
  }

  monthTodos.push(
    {
      userId,
      title: 'Reply to tester feedback',
      description: 'Delayed from last week.',
      dreamId: launch._id,
      actionId: testers._id,
      priority: 'high',
      dueDate: at(0, 10),
      missedFrom: at(-3, 18),
      isCompleted: false,
      dateChangeReason: '',
      estimatedTime: 30,
    },
    {
      userId,
      title: 'Do the missed Tuesday tempo run',
      description: 'Rolled to today.',
      dreamId: marathon._id,
      actionId: build._id,
      priority: 'high',
      dueDate: at(0, 11),
      missedFrom: at(-7, 18),
      isCompleted: false,
      estimatedTime: 50,
    },
    {
      userId,
      title: 'Review last month’s bank SMS',
      description: 'Find the leak.',
      dreamId: fund._id,
      actionId: cutSub._id,
      priority: 'medium',
      dueDate: at(0, 19),
      missedFrom: at(-1, 18),
      isCompleted: false,
      estimatedTime: 20,
    },
    {
      userId,
      title: 'Record a 60s walkthrough',
      description: 'Moved because the build was late.',
      dreamId: launch._id,
      actionId: testflight._id,
      priority: 'medium',
      dueDate: at(3, 18),
      dateChangeReason: 'Build was not ready. Moving so I do not fake done.',
      dateChanges: [
        {
          from: at(-2, 18),
          to: at(3, 18),
          reason: 'Build was not ready. Moving so I do not fake done.',
          changedAt: at(-1, 12),
        },
      ],
      isCompleted: false,
      estimatedTime: 30,
    },
    {
      userId,
      title: 'Buy groceries for Sunday',
      dreamId: null,
      actionId: null,
      priority: 'medium',
      dueDate: at(1, 17),
      isCompleted: false,
      estimatedTime: 40,
    },
    {
      userId,
      title: 'Long run 8 km',
      dreamId: marathon._id,
      actionId: longRun._id,
      priority: 'medium',
      dueDate: at(4, 7),
      isCompleted: false,
      estimatedTime: 70,
    },
  );

  await Task.insertMany(monthTodos, { ordered: false });

  const [activeIdea, implementedIdea, archivedIdea, anotherActive] = await Idea.create([
    {
      userId,
      title: 'Charge ₹99 for the first month',
      description: 'If nobody pays, the dream is still a hobby.',
      dreamId: launch._id,
      priority: 'high',
      status: 'active',
      tags: ['pricing'],
      category: 'product',
    },
    {
      userId,
      title: 'Onboarding should explain pay / result / today',
      description: 'Converted into the onboarding action.',
      dreamId: launch._id,
      priority: 'high',
      status: 'implemented',
      implementation: 'Converted to action',
      tags: ['copy'],
      category: 'product',
    },
    {
      userId,
      title: 'Add XP and badges for streaks',
      description: 'Archived. Not this product.',
      priority: 'low',
      status: 'archived',
      tags: ['wont-do'],
      category: 'noise',
    },
    {
      userId,
      title: 'Sunrise river-path long-run route',
      description: 'Coffee after kilometer 8. Still just an idea.',
      dreamId: marathon._id,
      priority: 'low',
      status: 'active',
      tags: ['training'],
      category: 'health',
    },
  ]);

  await Note.create([
    {
      userId,
      content: 'Home must be productivity, not a second dream journal.',
      linkedType: 'dream',
      linkedId: launch._id,
      tags: ['copy'],
      isPinned: true,
      points: ['Keep today short', 'Missed work stays red'],
    },
    {
      userId,
      content: 'If it rains, swap the long run for an indoor 45-minute session.',
      linkedType: 'action',
      linkedId: longRun._id,
      tags: ['training'],
    },
    {
      userId,
      content: 'Ask testers what they already use: Notes, Notion, or nothing.',
      linkedType: 'idea',
      linkedId: activeIdea._id,
      tags: ['research'],
    },
    {
      userId,
      content: 'Payday rule: save first, then spend.',
      linkedType: 'dream',
      linkedId: fund._id,
      tags: ['money'],
      isPinned: true,
      points: ['₹5,000 auto-transfer', 'Log coffee the same hour'],
    },
    {
      userId,
      content: 'Still open: TestFlight notes from last night.',
      linkedType: 'standalone',
      tags: ['shutdown'],
    },
  ]);

  await MoneyEntry.create([
    {
      userId,
      type: 'in',
      amount: 45000,
      note: 'salary',
      category: 'income',
      happenedAt: at(-28, 10),
    },
    {
      userId,
      type: 'out',
      amount: 12000,
      note: 'rent',
      category: 'rent',
      happenedAt: at(-27, 11),
    },
    {
      userId,
      type: 'save',
      amount: 5000,
      note: 'payday transfer',
      category: 'save',
      dreamId: fund._id,
      happenedAt: at(-26, 12),
    },
    {
      userId,
      type: 'out',
      amount: 320,
      note: 'coffee',
      category: 'food',
      happenedAt: at(-20, 9),
    },
    {
      userId,
      type: 'out',
      amount: 890,
      note: 'groceries',
      category: 'food',
      happenedAt: at(-14, 19),
    },
    {
      userId,
      type: 'save',
      amount: 2500,
      note: 'cut a subscription',
      category: 'save',
      dreamId: fund._id,
      happenedAt: at(-12, 16),
    },
    {
      userId,
      type: 'out',
      amount: 1500,
      note: 'metro and cab',
      category: 'travel',
      happenedAt: at(-8, 21),
    },
    {
      userId,
      type: 'out',
      amount: 700,
      note: 'lunch with tester',
      category: 'work',
      happenedAt: at(-5, 13),
    },
    {
      userId,
      type: 'save',
      amount: 2000,
      note: 'extra into emergency fund',
      category: 'save',
      dreamId: fund._id,
      happenedAt: at(-3, 18),
    },
    {
      userId,
      type: 'out',
      amount: 250,
      note: 'coffee',
      category: 'food',
      happenedAt: at(-1, 9),
    },
  ]);

  await syncAllDreamProgress(userId);

  const [dreams, actions, tasks, ideas, notes, money] = await Promise.all([
    Dream.countDocuments({ userId }),
    Action.countDocuments({ userId }),
    Task.countDocuments({ userId }),
    Idea.countDocuments({ userId }),
    Note.countDocuments({ userId }),
    MoneyEntry.countDocuments({ userId }),
  ]);

  console.log(
    JSON.stringify(
      {
        login: { email: EMAIL, password: PASSWORD },
        counts: {
          dreams,
          actions,
          tasks,
          ideas,
          notes,
          money,
        },
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
