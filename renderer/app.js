// ==================== 数据管理 ====================
// 通过 Electron IPC 读写 JSON 文件（替代 localStorage）

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

// ==================== 日期工具 ====================
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(key) {
  const [y, m, d] = key.split('-');
  return `${y}年${m}月${d}日`;
}

function getWeekday(date) {
  const days = ['周日','周一','周二','周三','周四','周五','周六'];
  return days[date.getDay()];
}

// ==================== 打卡逻辑 ====================
async function doCheckin() {
  const key = todayKey();
  if (appData.records[key]) return; // 今天已打卡

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  appData.records[key] = timeStr;
  await saveData(appData);

  // 粒子动画
  spawnParticles();

  // Toast
  showToast('✅ 打卡成功！今天真棒！');

  // 更新UI
  updateCheckinUI();
  updateStats();
  renderHistory();
}

function spawnParticles() {
  const btn = document.getElementById('checkinBtn');
  const rect = btn.getBoundingClientRect();
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
      document.body.appendChild(particle);

      setTimeout(() => particle.remove(), 1500);
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
  document.getElementById('hours').textContent = String(now.getHours()).padStart(2,'0');
  document.getElementById('minutes').textContent = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('seconds').textContent = String(now.getSeconds()).padStart(2,'0');
  document.getElementById('dateText').textContent = `${now.getFullYear()}年${String(now.getMonth()+1).padStart(2,'0')}月${String(now.getDate()).padStart(2,'0')}日`;
  document.getElementById('weekday').textContent = getWeekday(now);
}

function updateCheckinUI() {
  const key = todayKey();
  const btn = document.getElementById('checkinBtn');
  const status = document.getElementById('checkinStatus');
  const timeEl = document.getElementById('checkinTime');

  if (appData.records[key]) {
    btn.disabled = true;
    btn.querySelector('.checkin-icon').textContent = '✅';
    status.innerHTML = '<span class="done">🎊 今日已完成打卡</span>';
    timeEl.textContent = `打卡时间：${appData.records[key]}`;
  } else {
    btn.disabled = false;
    btn.querySelector('.checkin-icon').textContent = '📌';
    status.textContent = '今天还没有打卡哦～';
    timeEl.textContent = '';
  }
}

function updateStats() {
  const today = new Date();
  const todayKeyStr = todayKey();
  const records = appData.records;
  const keys = Object.keys(records).sort();

  // 累计打卡
  const total = keys.length;

  // 连续天数
  let streak = 0;
  const checkDate = new Date(today);
  // 如果今天还没打卡，从昨天开始检查
  if (!records[todayKeyStr]) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (true) {
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;
    if (records[key]) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // 本月打卡
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const monthDays = keys.filter(k => k.startsWith(thisMonth)).length;

  document.getElementById('totalDays').textContent = total;
  document.getElementById('streakDays').textContent = streak;
  document.getElementById('monthDays').textContent = monthDays;
}

function renderHistory() {
  const container = document.getElementById('historyList');
  const keys = Object.keys(appData.records).sort().reverse();

  if (keys.length === 0) {
    container.innerHTML = '<div class="empty-history">还没有打卡记录<br>点击按钮开始吧！</div>';
    return;
  }

  container.innerHTML = keys.slice(0, 50).map(key => `
    <div class="history-item">
      <span class="history-date">
        <span class="dot"></span>
        ${formatDate(key)}
      </span>
      <span class="history-time">${appData.records[key]}</span>
    </div>
  `).join('');
}

// ==================== 初始化 ====================
async function init() {
  appData = await loadData();

  updateClock();
  updateCheckinUI();
  updateStats();
  renderHistory();

  // 每秒更新时钟
  setInterval(updateClock, 1000);

  // 每分钟检查日期是否变化（跨天重置）
  setInterval(() => {
    updateCheckinUI();
    updateStats();
    renderHistory();
  }, 60000);
}

// 页面切回前台时刷新
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateCheckinUI();
    updateStats();
    renderHistory();
  }
});

init();
