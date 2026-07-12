/* ── XSS escape ── */
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Countdown storage ── */
function loadCountdowns() {
  try { return JSON.parse(localStorage.getItem('widget_countdowns') || '[]'); }
  catch { return []; }
}
function saveCountdowns(list) {
  localStorage.setItem('widget_countdowns', JSON.stringify(list));
}

/* ── Daily motivational quotes ── */
const QUOTES = [
  '锲而不舍，金石可镂。',
  '学而不思则罔，思而不学则殆。',
  '千里之行，始于足下。',
  '业精于勤，荒于嬉；行成于思，毁于随。',
  '天下事有难易乎？为之，则难者亦易矣。',
  '读书破万卷，下笔如有神。',
  '少壮不努力，老大徒伤悲。',
  '不积跬步，无以至千里。',
  '知之者不如好之者，好之者不如乐之者。',
  '博学之，审问之，慎思之，明辨之，笃行之。',
  '三人行，必有我师焉。',
  '学海无涯苦作舟，书山有路勤为径。',
  '志当存高远。',
  '宝剑锋从磨砺出，梅花香自苦寒来。',
  '吃得苦中苦，方为人上人。',
  '时间就是生命，效率就是金钱。',
  '成功是留给准备好的人。',
  '没有勤奋，就没有一切。',
  '一份耕耘，一份收获。',
  '勤能补拙是良训，一分辛劳一分才。',
  '今日事，今日毕。',
  '自强不息，厚德载物。',
];

/* ── Clock ── */
function updateClock() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('clock').textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const days = ['日', '一', '二', '三', '四', '五', '六'];
  document.getElementById('date').textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日  周${days[now.getDay()]}`;
}

/* ── Countdowns ── */
function renderCountdowns() {
  const todayMs = new Date(new Date().toDateString()).getTime();
  const list = loadCountdowns()
    .map(c => ({ ...c, diff: Math.round((new Date(c.date) - todayMs) / 86400000) }))
    .filter(c => c.diff >= 0)
    .sort((a, b) => a.diff - b.diff);

  const container = document.getElementById('countdowns');
  if (!list.length) {
    container.innerHTML = '<div class="dim-text">点击 ＋ 添加倒计时</div>';
    return;
  }

  container.innerHTML = list.map(c => {
    const cls  = c.diff <= 3 ? 'urgent' : c.diff <= 7 ? 'near' : 'far';
    const days = c.diff === 0 ? '今天！' : `还有 ${c.diff} 天`;
    return `<div class="exam-row countdown-item" data-id="${c.id}">
      <span class="exam-name">${esc(c.name)}</span>
      <span class="exam-days ${cls}">${days}</span>
      <span class="countdown-del" data-id="${c.id}">✕</span>
    </div>`;
  }).join('');

  container.querySelectorAll('.countdown-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveCountdowns(loadCountdowns().filter(c => c.id !== Number(btn.dataset.id)));
      renderCountdowns();
    });
  });
}

function toggleCdForm() {
  const form = document.getElementById('countdownForm');
  const show = form.style.display !== 'flex';
  form.style.display = show ? 'flex' : 'none';
  if (show) document.getElementById('cdName').focus();
}

function submitCountdown() {
  const name = document.getElementById('cdName').value.trim();
  const date = document.getElementById('cdDate').value;
  if (!name || !date) return;
  const list = loadCountdowns();
  list.push({ id: Date.now(), name, date });
  saveCountdowns(list);
  document.getElementById('cdName').value = '';
  document.getElementById('cdDate').value = '';
  document.getElementById('countdownForm').style.display = 'none';
  renderCountdowns();
}

/* ── Calendar events ── */
async function fetchEvents(token) {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: true,
                          orderBy: 'startTime', maxResults: '12' });
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${r.status}`);
  return (await r.json()).items || [];
}

function pad2(n) { return String(n).padStart(2, '0'); }

const TAG_DOT = {
  '学习': '#5e8bde', '课程': '#70b89a', '科研': '#9580d4',
  '社工': '#e8a84a', '运动': '#4ab8c0', '娱乐': '#e87a9a',
  '工作': '#d4a843', '其他': '#8a8a9a',
};

function getTagColor(summary) {
  const m = (summary || '').match(/^#(\S+)/);
  return m ? (TAG_DOT[m[1]] || null) : null;
}

function renderEvents(events) {
  if (!events.length) {
    document.getElementById('events').innerHTML = '<div class="dim-text">今日无日程</div>';
    return;
  }
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  document.getElementById('events').innerHTML = events.map(ev => {
    let timeStr, startMins = -1, endMins = -1;
    if (ev.start?.dateTime) {
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      timeStr   = `${pad2(s.getHours())}:${pad2(s.getMinutes())}–${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
      startMins = s.getHours() * 60 + s.getMinutes();
      endMins   = e.getHours() * 60 + e.getMinutes();
    } else {
      timeStr = '全天';
    }
    const title = (ev.summary || '无标题').replace(/^#\S+\s*/, '');
    const ongoing = startMins >= 0 && nowMins >= startMins && nowMins < endMins;
    const dotColor = getTagColor(ev.summary || '');
    const dot = dotColor ? `<span class="event-dot" style="background:${dotColor}"></span>` : '';
    return `<div class="event-row${ongoing ? ' ongoing' : ''}" data-start="${startMins}">
      <span class="event-time">${timeStr}</span>
      ${dot}<span class="event-title">${title}</span>
    </div>`;
  }).join('');

  scrollToNow();
}

function scrollToNow() {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const container = document.getElementById('events');
  const rows = Array.from(container.querySelectorAll('.event-row'));

  // Find first event that ends after now (ongoing or upcoming)
  let targetIdx = rows.findIndex(r => {
    const start = parseInt(r.dataset.start ?? '-1');
    return start >= 0 && start >= nowMins;
  });

  // All events are past → scroll to bottom
  if (targetIdx === -1) {
    container.scrollTop = container.scrollHeight;
    return;
  }

  // Show one event before the target for context
  const scrollTo = rows[Math.max(0, targetIdx - 1)];
  container.scrollTop = scrollTo.offsetTop - 4;
}

function setEventsText(msg) {
  document.getElementById('events').innerHTML = `<div class="dim-text">${msg}</div>`;
}

/* ── Load calendar with auto-login ── */
async function loadCalendar() {
  let token = await window.widget.getToken();

  if (!token) {
    setEventsText('正在打开 Google 授权页面…');
    try {
      token = await window.widget.login();
    } catch (e) {
      setEventsText('登录失败，请重启 Widget 重试');
      return;
    }
  }

  try {
    renderEvents(await fetchEvents(token));
  } catch {
    // Token may have been revoked; clear and retry once
    await window.widget.logout();
    setEventsText('Token 已失效，重启 Widget 重新登录');
  }
}

/* ── Pomodoro ── */

let fullscreenOpen        = false;
let lastFullscreenClose   = 0;
const IDLE_SECS           = 30;
const FULLSCREEN_COOLDOWN = 10_000;

const PM = { WORK: 'work', SHORT: 'short', LONG: 'long' };
const PM_LABEL = { work: '专注', short: '短休息', long: '长休息' };
const PM_COLOR = { work: '#e8856a', short: '#f0c070', long: '#a29bfe' };

const ps = {
  mode:       PM.WORK,
  running:    false,
  remaining:  25 * 60,
  rounds:     0,
  todayCount: 0,
  timer:      null,
  cfg: { work: 25, short: 5, long: 15, cycles: 4 },
};

function pomoInit() {
  try {
    const saved = JSON.parse(localStorage.getItem('pomo_today') || '{}');
    if (saved.date === new Date().toDateString()) ps.todayCount = saved.count || 0;
  } catch {}
  try {
    const raw = JSON.parse(localStorage.getItem('pomo_cfg') || '{}');
    const fin = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
    ps.cfg.work   = fin(raw.work,   25);
    ps.cfg.short  = fin(raw.short,  5);
    ps.cfg.long   = fin(raw.long,   15);
    ps.cfg.cycles = fin(raw.cycles, 4);
  } catch {}
  ps.remaining = ps.cfg.work * 60;
  window.widget.onFullscreenClosed(() => {
    fullscreenOpen      = false;
    lastFullscreenClose = Date.now();
  });
  window.widget.onPauseToggle(() => {
    pomoToggle();
    window.widget.sendPauseState(!ps.running);
  });
  renderPomo();
}

function getModeSecs() {
  if (ps.mode === PM.WORK)  return ps.cfg.work  * 60;
  if (ps.mode === PM.SHORT) return ps.cfg.short * 60;
  return ps.cfg.long * 60;
}

function pomoToggle() {
  if (ps.running) {
    clearInterval(ps.timer);
    ps.running = false;
  } else {
    ps.running = true;
    ps.timer = setInterval(pomoTick, 1000);
  }
  renderPomoBtn();
}

function pomoReset() {
  clearInterval(ps.timer);
  ps.running = false;
  ps.remaining = getModeSecs();
  renderPomo();
}

function pomoSkip() {
  clearInterval(ps.timer);
  ps.running = false;
  if (ps.mode === PM.WORK) {
    ps.rounds++;
    ps.mode = ps.rounds % ps.cfg.cycles === 0 ? PM.LONG : PM.SHORT;
  } else {
    ps.mode = PM.WORK;
  }
  ps.remaining = getModeSecs();
  renderPomo();
}

function pomoTick() {
  if (!Number.isFinite(ps.remaining) || ps.remaining < 0) {
    ps.remaining = getModeSecs();
  }
  if (ps.remaining > 0) {
    ps.remaining--;
    renderPomoTimer();
    if (fullscreenOpen) window.widget.sendTick(ps.remaining, ps.mode);
  } else {
    pomoComplete();
  }
}

function pomoComplete() {
  clearInterval(ps.timer);
  ps.running = false;
  if (fullscreenOpen) { window.widget.closeFullscreen(); fullscreenOpen = false; }
  playAlarm();

  let title, body;
  if (ps.mode === PM.WORK) {
    ps.rounds++;
    ps.todayCount++;
    localStorage.setItem('pomo_today', JSON.stringify({
      date: new Date().toDateString(), count: ps.todayCount,
    }));
    saveToHistory(ps.todayCount);
    const isLong = ps.rounds % ps.cfg.cycles === 0;
    ps.mode = isLong ? PM.LONG : PM.SHORT;
    title = '🍅 专注完成！';
    body  = `今日第 ${ps.todayCount} 个番茄 · 休息 ${isLong ? ps.cfg.long : ps.cfg.short} 分钟`;
  } else {
    ps.mode = PM.WORK;
    title = '⏰ 休息结束';
    body  = '准备好开始下一个番茄了吗？';
  }
  ps.remaining = getModeSecs();
  window.widget.notify(title, body);
  renderPomo();
  ps.running = true;
  ps.timer = setInterval(pomoTick, 1000);
  renderPomoBtn();
}

function renderPomo() {
  renderPomoTimer();
  renderPomoBtn();

  const color = PM_COLOR[ps.mode];
  const label = document.getElementById('pomoLabel');
  label.textContent  = PM_LABEL[ps.mode];
  label.style.color  = color;

  const btn = document.getElementById('pomoBtnMain');
  btn.style.color       = color;
  btn.style.background  = `${color}26`;
  btn.style.borderColor = `${color}55`;

  document.getElementById('pomoCount').textContent  = `🍅 ×${ps.todayCount}`;
  document.getElementById('cfgWork').textContent    = ps.cfg.work;
  document.getElementById('cfgShort').textContent   = ps.cfg.short;
  document.getElementById('cfgLong').textContent    = ps.cfg.long;
  document.getElementById('cfgCycles').textContent  = ps.cfg.cycles;
}

function renderPomoTimer() {
  if (!Number.isFinite(ps.remaining)) return;
  const m = Math.floor(ps.remaining / 60);
  const s = ps.remaining % 60;
  document.getElementById('pomoTimer').textContent =
    `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderPomoBtn() {
  document.getElementById('pomoBtnMain').textContent =
    ps.running ? '⏸ 暂停' : '▶ 开始';
}

function togglePomoSettings() {
  const el = document.getElementById('pomoSettings');
  el.style.display = el.style.display === 'grid' ? 'none' : 'grid';
}

function adjPomo(key, delta) {
  const bounds = { work: [1, 90], short: [1, 30], long: [5, 60], cycles: [1, 8] };
  const [min, max] = bounds[key];
  ps.cfg[key] = Math.max(min, Math.min(max, ps.cfg[key] + delta));
  localStorage.setItem('pomo_cfg', JSON.stringify(ps.cfg));
  if (!ps.running) {
    const modeKey = { work: PM.WORK, short: PM.SHORT, long: PM.LONG }[key];
    if (modeKey && modeKey === ps.mode) ps.remaining = getModeSecs();
  }
  renderPomo();
}

function saveToHistory(count) {
  try {
    const history = JSON.parse(localStorage.getItem('pomo_history') || '{}');
    history[new Date().toDateString()] = count;
    const keys = Object.keys(history).sort((a, b) => new Date(a) - new Date(b));
    if (keys.length > 30) delete history[keys[0]];
    localStorage.setItem('pomo_history', JSON.stringify(history));
  } catch {}
}

function renderPomoStats() {
  try {
    const history = JSON.parse(localStorage.getItem('pomo_history') || '{}');
    const dayNames = ['日','一','二','三','四','五','六'];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ label: dayNames[d.getDay()], count: history[d.toDateString()] || 0, isToday: i === 0 });
    }
    const max = Math.max(...days.map(d => d.count), 1);
    document.getElementById('pomoStatsChart').innerHTML = days.map(d => {
      const h = Math.max(Math.round((d.count / max) * 44), d.count ? 4 : 2);
      return `<div class="stat-col${d.isToday ? ' today' : ''}">
        <div class="stat-val">${d.count || ''}</div>
        <div class="stat-bar" style="height:${h}px"></div>
        <div class="stat-day">${d.label}</div>
      </div>`;
    }).join('');
  } catch {}
}

function togglePomoStats() {
  const panel = document.getElementById('pomoStatsPanel');
  const show  = panel.style.display !== 'block';
  panel.style.display = show ? 'block' : 'none';
  if (show) renderPomoStats();
}

function playAlarm() {
  try {
    const ctx = new AudioContext();
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch {}
}

/* ── Idle → fullscreen check (every 5 s, independent of tick) ── */
setInterval(async () => {
  if (!ps.running || fullscreenOpen) return;
  try {
    const idle = await window.widget.getIdleTime();
    if (idle >= IDLE_SECS && Date.now() - lastFullscreenClose > FULLSCREEN_COOLDOWN) {
      fullscreenOpen = true;
      window.widget.openFullscreen({
        remaining:  ps.remaining,
        total:      getModeSecs(),
        mode:       ps.mode,
        todayCount: ps.todayCount,
        quote:      QUOTES[(ps.rounds + ps.todayCount) % QUOTES.length],
      });
    }
  } catch {}
}, 5000);

/* ── Init ── */
const dayIndex = Math.floor(Date.now() / 86400000) % QUOTES.length;
document.getElementById('quote').textContent = QUOTES[dayIndex];

pomoInit();
renderCountdowns();
updateClock();
setInterval(updateClock, 1000);

loadCalendar();
setInterval(loadCalendar, 5 * 60 * 1000);
setInterval(renderCountdowns, 60 * 60 * 1000);

/* ── Countdown form listeners ── */
document.getElementById('cdAddBtn').addEventListener('click', toggleCdForm);
document.getElementById('cdSubmit').addEventListener('click', submitCountdown);
document.getElementById('cdCancel').addEventListener('click', () => {
  document.getElementById('countdownForm').style.display = 'none';
});
document.getElementById('cdName').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitCountdown(); });
document.getElementById('cdDate').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitCountdown(); });

document.getElementById('pomoStatsBtn').addEventListener('click', togglePomoStats);

/* ── Button listeners (avoid inline onclick for Electron sandbox compat) ── */
document.getElementById('pomoBtnMain').addEventListener('click',  pomoToggle);
document.getElementById('pomoBtnReset').addEventListener('click', pomoReset);
document.getElementById('pomoBtnSkip').addEventListener('click',  pomoSkip);
document.getElementById('pomoBtnCfg').addEventListener('click',   togglePomoSettings);
document.getElementById('cfgWorkDec').addEventListener('click',   () => adjPomo('work',   -5));
document.getElementById('cfgWorkInc').addEventListener('click',   () => adjPomo('work',    5));
document.getElementById('cfgShortDec').addEventListener('click',  () => adjPomo('short',  -1));
document.getElementById('cfgShortInc').addEventListener('click',  () => adjPomo('short',   1));
document.getElementById('cfgLongDec').addEventListener('click',   () => adjPomo('long',   -5));
document.getElementById('cfgLongInc').addEventListener('click',   () => adjPomo('long',    5));
document.getElementById('cfgCyclesDec').addEventListener('click', () => adjPomo('cycles', -1));
document.getElementById('cfgCyclesInc').addEventListener('click', () => adjPomo('cycles',  1));
