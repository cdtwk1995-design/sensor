// ============================================================
// CONFIG – Supabase credentials (embedded from .env)
// ============================================================
const SUPABASE_URL = 'https://xjvgnjdosuswqtgfylxu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqdmduamRvc3Vzd3F0Z2Z5bHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTY0ODgsImV4cCI6MjA5ODk3MjQ4OH0.UCFVG5ag0oVnE8vgDKcvfhj-SDo1mbwPty5SjBJ1uvY';
const TABLE_NAME = 'sensor_logs';
const MAX_CARDS = 50; // Maximum cards to keep per panel

// ============================================================
// STATE
// ============================================================
const state = {
    all: [],
    warning: [],
    risk: [],
};

// ============================================================
// DOM references
// ============================================================
const listAll = document.getElementById('list-all');
const listWarning = document.getElementById('list-warning');
const listRisk = document.getElementById('list-risk');

const badgeAll = document.getElementById('badge-all');
const badgeWarning = document.getElementById('badge-warning');
const badgeRisk = document.getElementById('badge-risk');

const statTotal = document.getElementById('stat-total');
const statWarning = document.getElementById('stat-warning');
const statRisk = document.getElementById('stat-risk');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const headerTime = document.getElementById('header-time');

// ============================================================
// CLOCK
// ============================================================
function updateClock() {
    const now = new Date();
    headerTime.textContent = now.toLocaleTimeString('ko-KR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}
setInterval(updateClock, 1000);
updateClock();

// ============================================================
// AUDIO ALERT (risk_level === 2)
// ============================================================
function playAlertSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const playBeep = (freq, start, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + duration + 0.05);
        };
        playBeep(880, 0, 0.15);
        playBeep(660, 0.2, 0.15);
        playBeep(880, 0.4, 0.3);
    } catch (e) {
        console.warn('Audio alert failed:', e);
    }
}

// ============================================================
// CARD CREATION
// ============================================================
function formatTs(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

function riskLabel(level) {
    if (level === 2) return { text: '위험', cls: 'badge-danger' };
    if (level === 1) return { text: '경고', cls: 'badge-warn' };
    return { text: '정상', cls: 'badge-normal' };
}

function createCard(row, isNew = false) {
    const level = row.risk_level ?? 0;
    const badge = riskLabel(level);
    const isDanger = level === 2;
    const isWarning = level === 1;

    const card = document.createElement('div');
    card.className = [
        'data-card',
        isWarning ? 'card-warning' : '',
        isDanger ? 'card-risk' : '',
        isNew && isDanger ? 'is-new' : '',
    ].filter(Boolean).join(' ');

    const tempVal = row.temperature_c != null ? `${Number(row.temperature_c).toFixed(1)} °C` : '—';
    const humVal = row.humidity_percent != null ? `${Number(row.humidity_percent).toFixed(1)} %` : '—';
    const coVal = row.co_ppm != null ? `${Number(row.co_ppm).toFixed(1)} ppm` : '—';

    card.innerHTML = `
    <div class="card-ts">
      <span>🕐</span>
      <span>${formatTs(row.created_at)}</span>
    </div>
    <div class="card-body">
      <div class="card-row">
        <span class="card-row-label">🌡️ 온도</span>
        <span class="card-row-value ${isDanger ? 'danger' : ''}">${tempVal}</span>
      </div>
      <div class="card-row">
        <span class="card-row-label">💧 습도</span>
        <span class="card-row-value">${humVal}</span>
      </div>
      <div class="card-row">
        <span class="card-row-label">🌫️ CO</span>
        <span class="card-row-value">${coVal}</span>
      </div>
    </div>
    <div class="card-footer">
      <span class="risk-badge ${badge.cls}">${badge.text}</span>
    </div>
  `;
    return card;
}

// ============================================================
// EMPTY STATE
// ============================================================
function emptyEl(msg) {
    const el = document.createElement('div');
    el.className = 'card-empty';
    el.innerHTML = `<span class="card-empty-icon">📭</span><span>${msg}</span>`;
    return el;
}

function renderEmpty(listEl, msg) {
    listEl.innerHTML = '';
    listEl.appendChild(emptyEl(msg));
}

// ============================================================
// PREPEND CARD (newest first, cap at MAX_CARDS)
// ============================================================
function prependCard(listEl, row, isNew = false) {
    // Remove empty state if present
    const empties = listEl.querySelectorAll('.card-empty');
    empties.forEach(e => e.remove());

    const card = createCard(row, isNew);
    listEl.insertBefore(card, listEl.firstChild);

    // Cap cards
    const cards = listEl.querySelectorAll('.data-card');
    if (cards.length > MAX_CARDS) {
        cards[cards.length - 1].remove();
    }
}

// ============================================================
// STATS UPDATE
// ============================================================
function updateStats() {
    const total = state.all.length;
    const warns = state.warning.length;
    const risks = state.risk.length;

    statTotal.textContent = total;
    statWarning.textContent = warns;
    statRisk.textContent = risks;

    badgeAll.textContent = total;
    badgeWarning.textContent = warns;
    badgeRisk.textContent = risks;
}

// ============================================================
// PROCESS INCOMING ROW
// ============================================================
function processRow(row, isNew = false) {
    const level = row.risk_level ?? 0;

    // All logs panel
    state.all.unshift(row);
    if (state.all.length > MAX_CARDS) state.all.pop();
    prependCard(listAll, row, isNew);

    if (level === 1) {
        state.warning.unshift(row);
        if (state.warning.length > MAX_CARDS) state.warning.pop();
        prependCard(listWarning, row, isNew);
    }

    if (level === 2) {
        state.risk.unshift(row);
        if (state.risk.length > MAX_CARDS) state.risk.pop();
        prependCard(listRisk, row, isNew);
        if (isNew) playAlertSound();
    }

    updateStats();
}

// ============================================================
// SET CONNECTION STATUS
// ============================================================
function setStatus(type, text) {
    statusDot.className = `status-dot ${type}`;
    statusText.textContent = text;
}

// ============================================================
// LOAD INITIAL DATA
// ============================================================
async function loadInitialData(client) {
    const { data, error } = await client
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_CARDS);

    if (error) {
        console.error('Initial load error:', error);
        return;
    }

    // Clear empties
    listAll.innerHTML = '';
    listWarning.innerHTML = '';
    listRisk.innerHTML = '';

    if (!data || data.length === 0) {
        renderEmpty(listAll, '데이터 없음');
        renderEmpty(listWarning, '경고 데이터 없음');
        renderEmpty(listRisk, '위험 데이터 없음');
        updateStats();
        return;
    }

    data.forEach(row => processRow(row, false));

    // If still empty after filter
    if (listWarning.children.length === 0) renderEmpty(listWarning, '경고 데이터 없음');
    if (listRisk.children.length === 0) renderEmpty(listRisk, '위험 데이터 없음');
}

// ============================================================
// MAIN – INIT SUPABASE & REALTIME
// ============================================================
(async function init() {
    renderEmpty(listAll, '연결 중...');
    renderEmpty(listWarning, '연결 중...');
    renderEmpty(listRisk, '연결 중...');
    setStatus('', '연결 중...');

    let client;
    try {
        client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        setStatus('error', '클라이언트 오류');
        console.error(e);
        return;
    }

    // Load existing data
    await loadInitialData(client);

    // Subscribe to realtime inserts
    const channel = client
        .channel('sensor_realtime')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: TABLE_NAME },
            (payload) => {
                console.log('New row:', payload.new);
                processRow(payload.new, true);
            }
        )
        .subscribe((status) => {
            console.log('Realtime status:', status);
            if (status === 'SUBSCRIBED') {
                setStatus('connected', 'Live');
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                setStatus('error', '연결 끊김');
            } else {
                setStatus('', '연결 중...');
            }
        });
})();

