const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const SECRET = process.env.SESSION_SECRET || 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_BEFORE_DEPLOYING';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'Alex7772055').toLowerCase();
const ADMIN_KEY = process.env.ADMIN_KEY || ''; // Set this in your environment before using the admin panel.

const cases = [
  { id: 'street', name: 'STREET PACK', price: 100, icon: '🧢', color: '#a3ff5f', items: [
    { name: 'Стикер «Улица»', value: 45, chance: 50, icon: '🏷️', rarity: 'Обычный' },
    { name: 'Неоновый брелок', value: 100, chance: 30, icon: '🔑', rarity: 'Редкий' },
    { name: 'Кибер-кроссовки', value: 220, chance: 15, icon: '👟', rarity: 'Эпический' },
    { name: 'Золотая маска', value: 700, chance: 5, icon: '🎭', rarity: 'Легендарный' }
  ]},
  { id: 'cyber', name: 'CYBER BOX', price: 300, icon: '🤖', color: '#8b7bff', items: [
    { name: 'Микрочип', value: 100, chance: 45, icon: '💾', rarity: 'Обычный' },
    { name: 'Голографический куб', value: 280, chance: 32, icon: '🧊', rarity: 'Редкий' },
    { name: 'Кибер-крылья', value: 650, chance: 18, icon: '🪽', rarity: 'Эпический' },
    { name: 'Ядро вселенной', value: 1800, chance: 5, icon: '🌌', rarity: 'Легендарный' }
  ]},
  { id: 'gold', name: 'GOLD RUSH', price: 750, icon: '👑', color: '#ffcb55', items: [
    { name: 'Золотая монета', value: 300, chance: 40, icon: '🪙', rarity: 'Обычный' },
    { name: 'Корона новичка', value: 650, chance: 35, icon: '👑', rarity: 'Редкий' },
    { name: 'Золотой дракон', value: 1600, chance: 20, icon: '🐉', rarity: 'Эпический' },
    { name: 'Солнечный артефакт', value: 5000, chance: 5, icon: '☀️', rarity: 'Легендарный' }
  ]}
];

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { users: {}, history: [] }; }
}
let db = loadData();
function saveData() {
  const temp = DATA_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.renameSync(temp, DATA_FILE);
}
function publicUser(u) {
  return { username: u.username, balance: u.balance, inventory: u.inventory, joinedAt: u.joinedAt, lastDaily: u.lastDaily };
}
function logEvent(username, type, details) {
  db.history.unshift({ id: crypto.randomUUID(), username, type, details, at: new Date().toISOString() });
  db.history = db.history.slice(0, 100);
}
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use(session({
  name: 'dropzone.sid', secret: SECRET, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.js') || req.path.endsWith('.css')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  const user = req.session.user && db.users[req.session.user];
  if (!user) return res.status(401).json({ error: 'Войди в аккаунт, чтобы продолжить.' });
  req.user = user; next();
}
function cleanUser(u) {
  const { passwordHash, ...safe } = u;
  return publicUser(safe);
}
app.get('/api/config', (req, res) => res.json({ cases: cases.map(({items, ...c}) => ({...c, preview: items.map(i => ({name:i.name,value:i.value,icon:i.icon,rarity:i.rarity, chance:i.chance}))})), user: req.session.user && db.users[req.session.user] ? cleanUser(db.users[req.session.user]) : null, adminEligible: Boolean(req.session.user && db.users[req.session.user] && db.users[req.session.user].username.toLowerCase() === ADMIN_USERNAME) }));
app.post('/api/register', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_]{3,18}$/.test(username)) return res.status(400).json({ error: 'Имя: 3–18 символов, только латиница, цифры и _.' });
  if (password.length < 8 || password.length > 100) return res.status(400).json({ error: 'Пароль должен содержать от 8 до 100 символов.' });
  const key = username.toLowerCase();
  if (db.users[key]) return res.status(409).json({ error: 'Такой пользователь уже существует.' });
  const user = { username, passwordHash: await bcrypt.hash(password, 12), balance: 1000, inventory: [], joinedAt: new Date().toISOString(), lastDaily: null };
  db.users[key] = user; req.session.user = key; logEvent(username, 'register', 'Создан аккаунт'); saveData();
  res.json({ user: cleanUser(user) });
});
app.post('/api/login', async (req, res) => {
  const key = String(req.body.username || '').trim().toLowerCase();
  const user = db.users[key];
  if (!user || !await bcrypt.compare(String(req.body.password || ''), user.passwordHash)) return res.status(401).json({ error: 'Неверное имя пользователя или пароль.' });
  req.session.user = key; res.json({ user: cleanUser(user) });
});
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', auth, (req, res) => res.json({ user: cleanUser(req.user) }));
app.post('/api/daily', auth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  if (req.user.lastDaily === today) return res.status(409).json({ error: 'Ежедневная награда уже получена. Возвращайся завтра.' });
  req.user.lastDaily = today; req.user.balance += 250; logEvent(req.user.username, 'daily', '+250 монет'); saveData();
  res.json({ user: cleanUser(req.user), message: 'Начислено 250 монет!' });
});
app.post('/api/open', auth, (req, res) => {
  const c = cases.find(x => x.id === req.body.caseId);
  if (!c) return res.status(404).json({ error: 'Кейс не найден.' });
  if (req.user.balance < c.price) return res.status(400).json({ error: 'Недостаточно монет.' });
  req.user.balance -= c.price;
  const roll = Math.random() * 100;
  let acc = 0, item = c.items[c.items.length - 1];
  for (const candidate of c.items) { acc += candidate.chance; if (roll < acc) { item = candidate; break; } }
  const found = { id: crypto.randomUUID(), name: item.name, value: item.value, icon: item.icon, rarity: item.rarity, caseName: c.name, obtainedAt: new Date().toISOString() };
  req.user.inventory.push(found); logEvent(req.user.username, 'drop', `${found.icon} ${found.name}`); saveData();
  res.json({ user: cleanUser(req.user), item: found });
});
app.post('/api/sell/:itemId', auth, (req, res) => {
  const idx = req.user.inventory.findIndex(i => i.id === req.params.itemId);
  if (idx < 0) return res.status(404).json({ error: 'Предмет не найден в инвентаре.' });
  const [item] = req.user.inventory.splice(idx, 1);
  req.user.balance += item.value; logEvent(req.user.username, 'sell', `${item.name}: +${item.value} монет`); saveData();
  res.json({ user: cleanUser(req.user), message: `Предмет продан за ${item.value} монет.` });
});
app.get('/api/leaderboard', (req, res) => res.json({ users: Object.values(db.users).map(u => ({ username: u.username, balance: u.balance, items: u.inventory.length })).sort((a,b) => b.balance-a.balance).slice(0, 10) }));
app.get('/api/activity', (req, res) => res.json({ activity: db.history.slice(0, 15).map(h => ({ username: h.username, type: h.type, details: h.details, at: h.at })) }));
app.post('/api/trade', auth, (req, res) => {
  const targetKey = String(req.body.username || '').trim().toLowerCase();
  const itemId = String(req.body.itemId || '');
  const target = db.users[targetKey];
  if (!target || target === req.user) return res.status(400).json({ error: 'Укажи существующего другого пользователя.' });
  const idx = req.user.inventory.findIndex(i => i.id === itemId);
  if (idx < 0) return res.status(404).json({ error: 'Предмет не найден.' });
  const [item] = req.user.inventory.splice(idx, 1);
  target.inventory.push({ ...item, id: crypto.randomUUID(), tradedFrom: req.user.username });
  logEvent(req.user.username, 'trade', `${item.name} → ${target.username}`); saveData();
  res.json({ user: cleanUser(req.user), message: `Предмет передан пользователю ${target.username}.` });
});
function adminAuth(req, res, next) {
  if (!req.user || req.user.username.toLowerCase() !== ADMIN_USERNAME || req.session.isAdmin !== true) {
    return res.status(403).json({ error: 'Нет доступа к панели администратора.' });
  }
  next();
}
app.post('/api/admin/verify', auth, (req, res) => {
  const supplied = String(req.body.key || '');
  if (req.user.username.toLowerCase() !== ADMIN_USERNAME) return res.status(403).json({ error: 'Админ-панель доступна только аккаунту Alex7772055.' });
  if (!ADMIN_KEY) return res.status(503).json({ error: 'Админ-панель пока отключена. Установи переменную окружения ADMIN_KEY и перезапусти сервер.' });
  const a = Buffer.from(supplied); const b = Buffer.from(ADMIN_KEY);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: 'Неверный ключ администратора.' });
  req.session.isAdmin = true;
  res.json({ ok: true });
});
app.post('/api/admin/logout', auth, adminAuth, (req, res) => { req.session.isAdmin = false; res.json({ ok: true }); });
app.get('/api/admin/users', auth, adminAuth, (req, res) => {
  const users = Object.values(db.users).map(u => ({ username: u.username, balance: u.balance, items: u.inventory.length, joinedAt: u.joinedAt }));
  res.json({ users, totalUsers: users.length, totalCoins: users.reduce((sum, u) => sum + u.balance, 0) });
});
app.post('/api/admin/balance', auth, adminAuth, (req, res) => {
  const key = String(req.body.username || '').trim().toLowerCase();
  const amount = Number(req.body.amount);
  const target = db.users[key];
  if (!target) return res.status(404).json({ error: 'Игрок не найден.' });
  if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1000000) return res.status(400).json({ error: 'Укажи целое число от -1000000 до 1000000, кроме нуля.' });
  if (target.balance + amount < 0) return res.status(400).json({ error: 'Баланс не может быть отрицательным.' });
  target.balance += amount;
  logEvent(req.user.username, 'admin', `${amount > 0 ? '+' : ''}${amount} монет игроку ${target.username}`);
  saveData();
  res.json({ ok: true, username: target.username, balance: target.balance });
});
app.listen(PORT, () => console.log(`DROPZONE запущен: http://localhost:${PORT}`));
