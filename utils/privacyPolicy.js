const PRIVACY_UPDATED = '17 September 2026';

const PRIVACY_SECTIONS = [
  {
    title: 'Who we are',
    body: 'Dood is a personal planner made by Jarvis. It helps you name a dream you will pay for, add an action that produces a result, and do today’s to-dos. This policy explains what Dood collects and why.',
  },
  {
    title: 'What we collect',
    body: 'When you create an account we collect your name, email, username, phone number, date of birth, password (stored hashed), and optional intent (exam, business, sport, home, or money). While you use Dood we store the content you add: dreams and dream photos, actions, to-dos, ideas, notes, money entries, focus and challenge sessions, evening notes, and notification preferences. We also store a technical account id so your data stays on your account.',
  },
  {
    title: 'What we do not collect',
    body: 'Dood does not use tracking SDKs, advertising identifiers, or analytics that follow you across other apps. Notifications are scheduled on your device. We do not sell your data. We do not use your content to train public AI models for other companies’ products.',
  },
  {
    title: 'How we use it',
    body: 'We use your account details to sign you in, reset your password by email, and show your profile. We use your Dood content to run the app: Home, Dreams, Brain, Calendar, Money, the coach, and local reminders. If you ask the coach for a plan, relevant parts of your Dood data are sent to our AI provider (currently Groq) only to produce that reply. Dream photos are stored with our file host (Cloudflare R2) so they can be shown in the app.',
  },
  {
    title: 'Legal bases',
    body: 'We process this information to provide the service you asked for (your account and planner), to keep the service secure, and to meet App Store and other legal duties. You must be at least 13 years old.',
  },
  {
    title: 'Sharing',
    body: 'We share data with processors who run the service for us: hosting and database, email delivery for password reset, file storage for dream photos, and the AI provider when you use Coach. We share data if the law requires it. We do not sell personal information.',
  },
  {
    title: 'Keeping data',
    body: 'We keep your account and content while the account is open. If you delete your account, we delete your profile and the Dood content tied to it from our systems. Backups may linger for a short time, then expire. Store listings and device backups you make yourself are outside Dood.',
  },
  {
    title: 'Your rights',
    body: 'You can view and edit name, phone, and intent in Profile. You can change your password. You can delete your account in the app: Profile → Delete account. That permanently removes your account and related Dood data. You can also email us and ask for a copy or a deletion. If you are in the EEA, UK, or a similar region you may also complain to a data protection authority.',
  },
  {
    title: 'Children',
    body: 'Dood is not directed at children under 13. We do not knowingly create accounts for them.',
  },
  {
    title: 'Changes',
    body: 'If this policy changes in a material way, we will update the date on this page. Continued use after an update means you accept the revised policy.',
  },
];

const privacyContact = () =>
  String(process.env.PRIVACY_CONTACT_EMAIL || 'jarvisnow27@gmail.com').trim();

const privacyUrl = () =>
  String(
    process.env.PRIVACY_POLICY_URL || 'https://api.motivational.fun/privacy',
  ).trim();

const escapeHtml = value =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const privacyHtml = () => {
  const contact = escapeHtml(privacyContact());
  const sections = PRIVACY_SECTIONS.map(
    item =>
      `<h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.body)}</p>`,
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dood Privacy Policy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; color: #0F0F10; line-height: 1.55; background: #FFF5EC; }
    h1 { font-size: 32px; letter-spacing: -0.4px; margin-bottom: 8px; }
    .meta { color: #6B7280; margin-bottom: 28px; }
    h2 { font-size: 18px; margin-top: 28px; }
    p { color: #374151; }
    a { color: #FF5A3D; }
  </style>
</head>
<body>
  <h1>Dood Privacy Policy</h1>
  <p class="meta">Last updated ${PRIVACY_UPDATED}. This page is the policy Apple asks for in App Store Connect.</p>
  ${sections}
  <h2>Contact</h2>
  <p>Questions about privacy: <a href="mailto:${contact}">${contact}</a>. You can also delete your account in the Dood app under Profile.</p>
</body>
</html>`;
};

module.exports = {
  PRIVACY_SECTIONS,
  PRIVACY_UPDATED,
  privacyContact,
  privacyHtml,
  privacyUrl,
};
