// ==================== 工具函数 ====================
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const todayKey = () => dateKey(new Date());

function formatDate(key) {
  const [y, m, d] = key.split('-');
  return `${y}年${m}月${d}日`;
}

function getWeekday(date) {
  const days = ['周日','周一','周二','周三','周四','周五','周六'];
  return days[date.getDay()];
}

// ==================== 数据管理 ====================
async function loadData() {
  try {
    const data = await window.electronAPI.loadData();
    return data || { records: {} };
  } catch (e) {
    console.error('加载数据失败:', e);
    return { records: {} };
  }
}

async function saveData(data) {
  try {
    await window.electronAPI.saveData(data);
  } catch (e) {
    console.error('保存数据失败:', e);
  }
}

let appData = { records: {} };

// ==================== DOM 缓存（一次查询，各处复用） ====================
const $ = (id) => document.getElementById(id);
let els = {};

function cacheElements() {
  els = {
    hours: $('hours'),
    minutes: $('minutes'),
    seconds: $('seconds'),
    dateText: $('dateText'),
    weekday: $('weekday'),
    checkinBtn: $('checkinBtn'),
    checkinIcon: $('checkinBtn').querySelector('.checkin-icon'),
    checkinStatus: $('checkinStatus'),
    checkinTime: $('checkinTime'),
    totalDays: $('totalDays'),
    streakDays: $('streakDays'),
    monthDays: $('monthDays'),
    historyList: $('historyList'),
  };
}

// ==================== 打卡逻辑 ====================
async function doCheckin() {
  const key = todayKey();
  if (appData.records[key]) return;

  const now = new Date();
  appData.records[key] = formatTime(now);
  await saveData(appData);

  spawnParticles();
  showToast('✅ 打卡成功！今天真棒！');
  refreshUI();
}

function spawnParticles() {
  const rect = els.checkinBtn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const emojis = ['✨','🎉','🌟','💪','🔥','⭐','🎯','💎'];

  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      const particle = document.createElement('span');
      particle.className = 'particle';
      particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      particle.style.left = (cx + (Math.random() - 0.5) * 160) + 'px';
      particle.style.top = (cy + (Math.random() - 0.5) * 60) + 'px';
      particle.style.animationDuration = (0.8 + Math.random() * 1.0) + 's';

      // 用 animationend 事件自动清理，替代硬编码的 setTimeout
      particle.addEventListener('animationend', () => particle.remove(), { once: true });

      document.body.appendChild(particle);
    }, i * 40);
  }
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2200);
}

// ==================== UI 更新 ====================
function updateClock() {
  const now = new Date();

  // 时间部分：每秒更新
  els.hours.textContent = pad(now.getHours());
  els.minutes.textContent = pad(now.getMinutes());
  els.seconds.textContent = pad(now.getSeconds());

  // 日期部分：仅在变化时更新（减少 ~86K 次/天冗余 DOM 写入）
  const dateStr = `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日`;
  if (els.dateText.textContent !== dateStr) {
    els.dateText.textContent = dateStr;
  }
  const wd = getWeekday(now);
  if (els.weekday.textContent !== wd) {
    els.weekday.textContent = wd;
  }
}

function updateCheckinUI(key) {
  if (appData.records[key]) {
    els.checkinBtn.disabled = true;
    els.checkinIcon.textContent = '✅';
    els.checkinStatus.innerHTML = '<span class="done">🎊 今日已完成打卡</span>';
    els.checkinTime.textContent = `打卡时间：${appData.records[key]}`;
  } else {
    els.checkinBtn.disabled = false;
    els.checkinIcon.textContent = '📌';
    els.checkinStatus.textContent = '今天还没有打卡哦～';
    els.checkinTime.textContent = '';
  }
}

function updateStats(key, sortedKeys) {
  const records = appData.records;
  const total = sortedKeys.length;

  // 连续天数
  let streak = 0;
  const checkDate = new Date();
  if (!records[key]) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (records[dateKey(checkDate)]) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // 本月打卡（直接取 key 前 7 位作为 "YYYY-MM" 前缀）
  const monthPrefix = key.slice(0, 7);
  const monthDays = sortedKeys.filter(k => k.startsWith(monthPrefix)).length;

  els.totalDays.textContent = total;
  els.streakDays.textContent = streak;
  els.monthDays.textContent = monthDays;
}

function renderHistory(sortedKeys) {
  if (sortedKeys.length === 0) {
    els.historyList.innerHTML = '<div class="empty-history">还没有打卡记录<br>点击按钮开始吧！</div>';
    return;
  }

  // 取最近 50 条，倒序渲染
  els.historyList.innerHTML = sortedKeys.slice(-50).reverse().map(key => `
    <div class="history-item">
      <span class="history-date">
        <span class="dot"></span>
        ${formatDate(key)}
      </span>
      <span class="history-time">${appData.records[key]}</span>
    </div>
  `).join('');
}

// ==================== 统一刷新入口 ====================
function refreshUI() {
  const key = todayKey();
  const sortedKeys = Object.keys(appData.records).sort(); // 排序一次，共用
  updateCheckinUI(key);
  updateStats(key, sortedKeys);
  renderHistory(sortedKeys);
}

// ==================== 初始化 ====================
async function init() {
  cacheElements();
  appData = await loadData();

  updateClock();
  refreshUI();

  // 每秒更新时钟
  setInterval(updateClock, 1000);

  // 每分钟检查日期是否变化（跨天重置）
  setInterval(refreshUI, 60000);

  // 按钮事件绑定（替代 HTML 内联 onclick）
  els.checkinBtn.addEventListener('click', doCheckin);
}

// 页面切回前台时刷新
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshUI();
});

init();
