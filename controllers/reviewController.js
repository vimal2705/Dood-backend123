const User = require("../models/User");
const Dream = require("../models/Dream");
const Action = require("../models/Action");
const Task = require("../models/Task");
const Idea = require("../models/Idea");
const Note = require("../models/Note");
const MoneyEntry = require("../models/MoneyEntry");
const { monthBounds, summarizeMoney } = require("../utils/moneyInsights");
const {
  todayKey,
  weekBounds,
  startOfDay,
  syncAllDreamProgress,
  listStaleDreams,
} = require("../utils/dreamProgress");

const hourNow = () => new Date().getHours();

exports.getPulse = async (req, res) => {
  try {
    await syncAllDreamProgress(req.user.id);
    const user = await User.findById(req.user.id);
    const today = todayKey();
    const [tasks, staleDreams] = await Promise.all([
      Task.find({ userId: req.user.id }).setOptions({ _recursed: true }),
      listStaleDreams(req.user.id),
    ]);

    const missed = tasks.filter((task) => !task.isCompleted && task.missedFrom);
    const todayOpen = tasks.filter((task) => {
      if (task.isCompleted || !task.dueDate) return false;
      return startOfDay(task.dueDate).getTime() === startOfDay().getTime();
    });
    const completedToday = tasks.filter((task) => {
      if (!task.isCompleted || !task.completedDate) return false;
      return startOfDay(task.completedDate).getTime() === startOfDay().getTime();
    });

    const eveningDue = hourNow() >= 18 && user?.eveningNoteOn !== today;
    const morningDue = hourNow() < 12 && Boolean(user?.morningNote);

    return res.json({
      success: true,
      pulse: {
        today,
        missedCount: missed.length,
        todayOpenCount: todayOpen.length,
        completedTodayCount: completedToday.length,
        staleDreams,
        eveningDue,
        eveningNote: user?.eveningNoteOn === today ? user.eveningNote : "",
        morningDue,
        reminders: [
          missed.length
            ? {
                id: "missed",
                title: `${missed.length} missed to-do${missed.length === 1 ? "" : "s"}`,
                body: "Close yesterday before you start something new.",
              }
            : null,
          staleDreams.length
            ? {
                id: "stale",
                title: `${staleDreams.length} dream${staleDreams.length === 1 ? "" : "s"} with no result in 48 hours`,
                body: staleDreams[0]
                  ? `Start with “${staleDreams[0].title}”.`
                  : "Give the dream an action you can control, then a to-do.",
              }
            : null,
          morningDue
            ? {
                id: "morning",
                title: "Morning",
                body: user.morningNote,
              }
            : null,
        ].filter(Boolean),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveEvening = async (req, res) => {
  try {
    const finished = String(req.body.finished || "").trim();
    const leftover = String(req.body.leftover || "").trim();
    const note = [finished && `Finished: ${finished}`, leftover && `Still open: ${leftover}`]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 280);

    if (!note && !leftover && !finished) {
      return res.status(400).json({
        success: false,
        message: "Say what you finished or what is still open.",
      });
    }

    const today = todayKey();
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.eveningNote = note || leftover || finished;
    user.eveningNoteOn = today;
    await user.save();

    let captured = null;
    if (leftover) {
      captured = await Note.create({
        userId: req.user.id,
        content: leftover.slice(0, 1000),
        linkedType: "standalone",
        tags: ["shutdown"],
      });
    }

    return res.json({
      success: true,
      eveningNote: user.eveningNote,
      eveningNoteOn: user.eveningNoteOn,
      capturedNoteId: captured ? String(captured._id) : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getWeek = async (req, res) => {
  try {
    await syncAllDreamProgress(req.user.id);
    const user = await User.findById(req.user.id);
    const { start, end } = weekBounds();
    const today = todayKey();
    const { start: monthStart, end: monthEnd } = monthBounds();

    const [tasks, actions, dreams, ideas, moneyEntries, staleDreams] = await Promise.all([
      Task.find({ userId: req.user.id }).setOptions({ _recursed: true }),
      Action.find({ userId: req.user.id }).setOptions({ _recursed: true }),
      Dream.find({ userId: req.user.id }),
      Idea.find({ userId: req.user.id, status: "active" }).setOptions({ _recursed: true }),
      MoneyEntry.find({
        userId: req.user.id,
        happenedAt: { $gte: monthStart, $lte: monthEnd },
      }),
      listStaleDreams(req.user.id),
    ]);

    const inWeek = (value) => {
      if (!value) return false;
      const date = new Date(value);
      return date >= start && date <= end;
    };

    const completed = tasks.filter((task) => task.isCompleted && inWeek(task.completedDate));
    const missed = tasks.filter((task) => !task.isCompleted && task.missedFrom);
    const moved = tasks
      .filter((task) => task.dateChangeReason && inWeek(task.updatedAt))
      .map((task) => ({
        id: String(task._id),
        title: task.title,
        reason: task.dateChangeReason,
        dueDate: task.dueDate,
      }));
    const completedActions = actions.filter(
      (action) => action.status === "completed" && inWeek(action.completedDate),
    );
    const money = summarizeMoney(moneyEntries);

    user.lastWeeklyReviewOn = today;
    await user.save();

    return res.json({
      success: true,
      review: {
        from: start.toISOString(),
        to: end.toISOString(),
        completedTodos: completed.length,
        completedActions: completedActions.length,
        missedTodos: missed.map((task) => ({
          id: String(task._id),
          title: task.title,
        })),
        movedTodos: moved,
        staleDreams,
        openIdeas: ideas.length,
        dreamCount: dreams.length,
        money: {
          income: money.income,
          spent: money.spent,
          saved: money.saved,
          insight: money.insight,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
