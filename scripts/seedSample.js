const BASE = process.env.API_BASE || 'http://127.0.0.1:4000';

const iso = (daysFromNow, hour = 12) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const request = async (path, { token, method = 'GET', body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(`${method} ${path} failed: ${JSON.stringify(data)}`);
  }
  return data;
};

const idOf = (doc) => doc?._id || doc?.id;

const seed = async () => {
  const auth = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'tester@example.com', password: 'Test1234' },
  });
  const token = auth.token;

  const existing = await request('/api/dreams', { token });
  const byTitle = Object.fromEntries(
    (existing.dreams || []).map((dream) => [dream.title, dream]),
  );

  const getOrCreateDream = async (body) => {
    const found = byTitle[body.title];
    if (found) {
      return found;
    }
    const created = await request('/api/dreams', { token, method: 'POST', body });
    return created.dream;
  };

  const alreadySeeded = Boolean(byTitle['Launch Dood for friends']);

  const launch = await getOrCreateDream({
    title: 'Launch Dood for friends',
    subTitle: 'Ship a usable goal planner this month',
    description: 'Get a small group using Dood daily and collect feedback.',
    type: 'work',
    priority: 'top',
    status: 'boosted',
    targetDate: iso(21),
  });
  const marathon = await getOrCreateDream({
    title: 'Finish a half marathon',
    subTitle: 'Build a 12-week running habit',
    description: 'Train consistently and complete 21.1 km without injury.',
    type: 'achievement',
    priority: 'high',
    status: 'in progress',
    targetDate: iso(70),
  });
  const family = await getOrCreateDream({
    title: 'Weekly family dinners',
    subTitle: 'Protect one evening every week',
    description: 'Cook together and keep phones away from the table.',
    type: 'relation',
    priority: 'medium',
    status: 'in progress',
    targetDate: iso(40),
  });
  const fund = await getOrCreateDream({
    title: 'Build a $10k emergency fund',
    subTitle: 'Automate savings before spending',
    description: 'Move leftover income into a high-yield savings account.',
    type: 'finance',
    priority: 'high',
    status: 'in progress',
    targetDate: iso(120),
  });
  const home = await getOrCreateDream({
    title: 'Refresh the apartment',
    subTitle: 'Make the living room feel finished',
    description: 'Lighting, plants, and a reading corner.',
    type: 'home',
    priority: 'low',
    status: 'slow down',
    targetDate: iso(55),
  });

  const dreams = {
    launch: idOf(launch),
    marathon: idOf(marathon),
    family: idOf(family),
    fund: idOf(fund),
    home: idOf(home),
  };

  if (!alreadySeeded) {
    await Promise.all([
    request(`/api/dreams/${dreams.launch}/progress`, {
      token,
      method: 'PATCH',
      body: { progress: 42 },
    }),
    request(`/api/dreams/${dreams.marathon}/progress`, {
      token,
      method: 'PATCH',
      body: { progress: 18 },
    }),
    request(`/api/dreams/${dreams.family}/progress`, {
      token,
      method: 'PATCH',
      body: { progress: 35 },
    }),
    request(`/api/dreams/${dreams.fund}/progress`, {
      token,
      method: 'PATCH',
      body: { progress: 27 },
    }),
    request(`/api/dreams/${dreams.home}/progress`, {
      token,
      method: 'PATCH',
      body: { progress: 10 },
    }),
  ]);

  const onboard = await request('/api/actions', {
    token,
    method: 'POST',
    body: {
      title: 'Write onboarding copy',
      description: 'Login, signup, and empty-state text that matches the product.',
      dreamId: dreams.launch,
      priority: 'high',
      status: 'in progress',
      dueDate: iso(2),
    },
  });
  const beta = await request('/api/actions', {
    token,
    method: 'POST',
    body: {
      title: 'Invite 5 beta testers',
      description: 'Friends who already track goals in notes or spreadsheets.',
      dreamId: dreams.launch,
      priority: 'high',
      status: 'not started',
      dueDate: iso(8),
    },
  });
  const longRun = await request('/api/actions', {
    token,
    method: 'POST',
    body: {
      title: 'Complete a 12 km long run',
      description: 'Easy pace, walk breaks allowed.',
      dreamId: dreams.marathon,
      priority: 'medium',
      status: 'in progress',
      dueDate: iso(5),
    },
  });
  const dinner = await request('/api/actions', {
    token,
    method: 'POST',
    body: {
      title: 'Plan Sunday dinner menu',
      description: 'One shared dish plus a simple dessert.',
      dreamId: dreams.family,
      priority: 'medium',
      status: 'not started',
      dueDate: iso(3),
    },
  });
  const transfer = await request('/api/actions', {
    token,
    method: 'POST',
    body: {
      title: 'Set up auto-transfer',
      description: 'Move $250 on payday before anything else.',
      dreamId: dreams.fund,
      priority: 'high',
      status: 'completed',
      dueDate: iso(-4),
    },
  });
  const lamp = await request('/api/actions', {
    token,
    method: 'POST',
    body: {
      title: 'Buy a floor lamp',
      description: 'Warm light for the reading corner.',
      dreamId: dreams.home,
      priority: 'low',
      status: 'not started',
      dueDate: iso(14),
    },
  });

  const actions = {
    onboard: idOf(onboard.action),
    beta: idOf(beta.action),
    longRun: idOf(longRun.action),
    dinner: idOf(dinner.action),
    transfer: idOf(transfer.action),
    lamp: idOf(lamp.action),
  };

  const tasks = [
    {
      title: 'Draft empty-state copy',
      description: 'Dreams, brain dump, and calendar.',
      actionId: actions.onboard,
      priority: 'high',
      dueDate: iso(1),
      estimatedTime: 45,
    },
    {
      title: 'Record a 60s product walkthrough',
      description: 'Show creating a dream and a task.',
      actionId: actions.beta,
      priority: 'medium',
      dueDate: iso(6),
      estimatedTime: 30,
    },
    {
      title: 'Tuesday tempo run',
      description: '6 km at conversational pace.',
      actionId: actions.longRun,
      priority: 'medium',
      dueDate: iso(0),
      estimatedTime: 50,
    },
    {
      title: 'Buy groceries for Sunday',
      description: 'Tomatoes, pasta, basil, ice cream.',
      actionId: actions.dinner,
      priority: 'high',
      dueDate: iso(2),
      estimatedTime: 40,
    },
    {
      title: 'Review last month spending',
      description: 'Find one subscription to cancel.',
      actionId: actions.transfer,
      dreamId: dreams.fund,
      priority: 'medium',
      dueDate: iso(-2),
      estimatedTime: 25,
    },
    {
      title: 'Measure lamp space',
      description: 'Corner next to the sofa.',
      actionId: actions.lamp,
      priority: 'low',
      dueDate: iso(10),
      estimatedTime: 15,
    },
  ];

  const createdTasks = [];
  for (const task of tasks) {
    const created = await request('/api/tasks', { token, method: 'POST', body: task });
    createdTasks.push(created.task);
  }

  await request(`/api/tasks/${idOf(createdTasks[4])}/toggle`, {
    token,
    method: 'PUT',
  });

  const ideas = [
    {
      title: 'Streak freeze for travel weeks',
      description: 'Let people pause a goal without losing momentum.',
      dreamId: dreams.launch,
      priority: 'medium',
      tags: ['product', 'retention'],
      category: 'product',
    },
    {
      title: 'Sunrise long-run route',
      description: 'River path, then coffee at kilometer 8.',
      dreamId: dreams.marathon,
      priority: 'low',
      tags: ['training'],
      category: 'health',
    },
    {
      title: 'Potluck rotation',
      description: 'Each person brings one course so hosting stays light.',
      dreamId: dreams.family,
      priority: 'high',
      tags: ['family'],
      category: 'home',
    },
  ];

  const createdIdeas = [];
  for (const idea of ideas) {
    const created = await request('/api/ideas', { token, method: 'POST', body: idea });
    createdIdeas.push(created.idea);
    }
  }

  const actionList = (await request('/api/actions', { token })).actions || [];
  const ideaList = (await request('/api/ideas', { token })).ideas || [];
  const noteList = (await request('/api/notes', { token })).notes || [];
  const hasNote = (content) => noteList.some((note) => note.content === content);
  const actionIdByTitle = (title) =>
    idOf(actionList.find((action) => action.title === title));
  const ideaIdByTitle = (title) => idOf(ideaList.find((idea) => idea.title === title));

  const notes = [
    {
      content: 'Keep the home screen about progress, not sleep journaling.',
      linkedType: 'dream',
      linkedId: dreams.launch,
      tags: ['copy'],
      isPinned: true,
    },
    {
      content: 'If it rains, swap the long run for an indoor 45-minute session.',
      linkedType: 'action',
      linkedId: actionIdByTitle('Complete a 12 km long run'),
      tags: ['training'],
    },
    {
      content: 'Ask testers what they already use: notes, Notion, or nothing.',
      linkedType: 'idea',
      linkedId: ideaIdByTitle('Streak freeze for travel weeks'),
      tags: ['research'],
    },
    {
      content: 'Sunday 7pm is the only slot everyone can keep.',
      linkedType: 'standalone',
      tags: ['family'],
      isPinned: true,
    },
  ];

  for (const note of notes) {
    if (hasNote(note.content) || (note.linkedType !== 'standalone' && !note.linkedId)) {
      continue;
    }
    await request('/api/notes', { token, method: 'POST', body: note });
  }

  const summary = await Promise.all([
    request('/api/dreams/stats/summary', { token }),
    request('/api/actions/stats/summary', { token }),
    request('/api/tasks/stats/summary', { token }),
    request('/api/ideas/stats/summary', { token }),
    request('/api/notes/stats/summary', { token }),
  ]);

  console.log(
    JSON.stringify(
      {
        seededFor: 'tester@example.com',
        dreams: summary[0].stats,
        actions: summary[1].stats,
        tasks: summary[2].stats,
        ideas: summary[3].stats,
        notes: summary[4].stats,
      },
      null,
      2,
    ),
  );
};

seed().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
