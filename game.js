const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const targetElement = document.querySelector("#target");
const movesElement = document.querySelector("#moves");
const statusText = document.querySelector("#statusText");
const restartButton = document.querySelector("#restartButton");
const playAgainButton = document.querySelector("#playAgainButton");
const audioButton = document.querySelector("#audioButton");
const resultModal = document.querySelector("#resultModal");
const resultTitle = document.querySelector("#resultTitle");
const resultMessage = document.querySelector("#resultMessage");
const resultKicker = document.querySelector("#resultKicker");
const catCompanion = document.querySelector("#catCompanion");
const catBubble = document.querySelector("#catBubble");
const coverScreen = document.querySelector("#coverScreen");
const startButton = document.querySelector("#startButton");
const leaderboardList = document.querySelector("#leaderboardList");
const loginButton = document.querySelector("#loginButton");
const wechatLoginButton = document.querySelector("#wechatLoginButton");
const logoutButton = document.querySelector("#logoutButton");
const userName = document.querySelector("#userName");
const shareButton = document.querySelector("#shareButton");

const SIZE = 8;
const TYPES = 6;
const START_MOVES = 24;
const TARGET_SCORE = 6000;
const CELL_COUNT = SIZE * SIZE;
const API_BASE = window.TANGDOU_API_BASE || localStorage.getItem("tangdouApiBase") || "";
const PLAYER_NAME_KEY = "tangdouGuestName";
const AUTH_TOKEN_KEY = "tangdouAuthToken";

let board = [];
let score = 0;
let moves = START_MOVES;
let selected = null;
let locked = false;
let gameOver = false;
let dragStart = null;
let nextId = 1;
let audioContext = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let musicTimer = null;
let musicStep = 0;
let audioEnabled = true;
let audioStarted = false;
let lastScoreId = null;
let currentUser = null;

const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 659.25, 783.99, 987.77, 783.99, 698.46, 659.25, 587.33, 659.25];
const bassLine = [261.63, 261.63, 349.23, 349.23, 392, 392, 329.63, 329.63];

// ── Auth ──────────────────────────────────────────────

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

function setAuthToken(token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function checkLoginFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("login") === "ok") {
    const token = params.get("token");
    if (token) {
      setAuthToken(token);
      window.history.replaceState({}, "", window.location.pathname);
      await refreshUser();
    }
  }
}

async function refreshUser() {
  if (!API_BASE) {
    updateUserUI(null);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/me`, { headers: authHeaders() });
    if (!res.ok) { currentUser = null; updateUserUI(null); return; }
    const data = await res.json();
    currentUser = data.user;
    updateUserUI(currentUser);
  } catch {
    currentUser = null;
    updateUserUI(null);
  }
}

function updateUserUI(user) {
  if (!loginButton || !logoutButton || !userName) return;
  if (user) {
    loginButton.classList.add("hidden");
    if (wechatLoginButton) wechatLoginButton.classList.add("hidden");
    logoutButton.classList.remove("hidden");
    userName.classList.remove("hidden");
    userName.textContent = user.displayName || "玩家";
  } else {
    loginButton.classList.remove("hidden");
    if (wechatLoginButton) wechatLoginButton.classList.remove("hidden");
    logoutButton.classList.add("hidden");
    userName.classList.add("hidden");
    userName.textContent = "";
  }
}

function startLogin(provider) {
  if (!API_BASE) {
    alert("请先配置排行榜接口地址。");
    return;
  }
  window.location.href = `${API_BASE}/api/auth/${provider}/start?redirect=${encodeURIComponent(window.location.href)}`;
}

function doLogout() {
  setAuthToken("");
  currentUser = null;
  updateUserUI(null);
  if (API_BASE) {
    fetch(`${API_BASE}/api/auth/logout`, { method: "POST", headers: authHeaders() }).catch(() => {});
  }
}

// ── Share ─────────────────────────────────────────────

async function shareScore() {
  if (!API_BASE || !lastScoreId) {
    alert("排行榜接口未配置，无法分享。");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ scoreId: lastScoreId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert("分享失败：" + (err.error || "请重试"));
      return;
    }
    const data = await res.json();
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${data.shareToken}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("分享链接已复制到剪贴板！\n" + shareUrl);
    } catch {
      prompt("分享链接（请复制）：", shareUrl);
    }
  } catch {
    alert("分享失败，请检查网络。");
  }
}

// ── Audio ─────────────────────────────────────────────

function updateAudioButton() {
  if (!audioButton) return;
  audioButton.classList.toggle("audio-off", !audioEnabled);
  audioButton.classList.toggle("audio-on", audioEnabled);
  audioButton.setAttribute("aria-label", audioEnabled && audioStarted ? "关闭声音" : "开启声音");
  audioButton.title = audioEnabled ? "声音已开" : "声音已关";
}

function createAudioContext() {
  if (audioContext) return;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) {
    audioEnabled = false;
    updateAudioButton();
    return;
  }

  audioContext = new AudioEngine();
  masterGain = audioContext.createGain();
  musicGain = audioContext.createGain();
  sfxGain = audioContext.createGain();
  const compressor = audioContext.createDynamicsCompressor();

  masterGain.gain.value = 0.85;
  musicGain.gain.value = 0.16;
  sfxGain.gain.value = 0.55;
  musicGain.connect(masterGain);
  sfxGain.connect(masterGain);
  masterGain.connect(compressor);
  compressor.connect(audioContext.destination);
}

function unlockAudio() {
  if (!audioEnabled) return;
  createAudioContext();
  if (!audioContext) return;

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  if (!audioStarted) {
    audioStarted = true;
    startMusic();
    updateAudioButton();
  } else if (!musicTimer) {
    startMusic();
  }
}

function scheduleTone(frequency, duration, options = {}) {
  if (!audioEnabled || !audioContext || !sfxGain) return;
  const now = audioContext.currentTime + (options.delay || 0);
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(frequency, now);
  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, now + duration);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(options.volume || 0.18, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(options.destination || sfxGain);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function scheduleNoise(duration, options = {}) {
  if (!audioEnabled || !audioContext || !sfxGain) return;
  const bufferSize = Math.max(1, Math.floor(audioContext.sampleRate * duration));
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < bufferSize; index++) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / bufferSize);
  }

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime + (options.delay || 0);

  filter.type = "highpass";
  filter.frequency.value = options.frequency || 1800;
  gain.gain.setValueAtTime(options.volume || 0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.7);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(options.destination || sfxGain);
  source.start(now);
}

function startMusic() {
  if (!audioEnabled || !audioContext || !musicGain) return;
  musicStep = 0;
  function tick() {
    if (!audioEnabled || !audioContext || !musicGain) return;
    const bpm = 118;
    const beat = 60 / bpm;

    scheduleTone(melody[musicStep % melody.length], beat * 1.1, { volume: 0.14, type: "triangle", destination: musicGain });
    if (musicStep % 2 === 0 && bassLine.length) {
      scheduleTone(bassLine[Math.floor(musicStep / 2) % bassLine.length], beat * 2.1, { volume: 0.10, type: "sine", destination: musicGain });
    }

    musicStep++;
    musicTimer = setTimeout(tick, beat * 1000);
  }
  tick();
}

function playSfx(name) {
  if (!audioEnabled || !audioContext || !sfxGain) return;
  switch (name) {
    case "swap":
      scheduleTone(620, 0.09, { volume: 0.16 });
      break;
    case "clear":
      scheduleTone(880, 0.13, { volume: 0.20 });
      break;
    case "chain":
      scheduleTone(1100, 0.13, { volume: 0.20, type: "triangle" });
      setTimeout(() => scheduleTone(1400, 0.13, { volume: 0.18, type: "triangle" }), 70);
      break;
    case "select":
      scheduleTone(530, 0.06, { volume: 0.12 });
      break;
    case "invalid":
      scheduleNoise(0.1, { volume: 0.06, frequency: 600 });
      break;
    case "win":
      scheduleTone(523, 0.15, { volume: 0.22, type: "triangle" });
      setTimeout(() => scheduleTone(659, 0.15, { volume: 0.22, type: "triangle" }), 150);
      setTimeout(() => scheduleTone(784, 0.25, { volume: 0.24, type: "triangle" }), 300);
      break;
    case "lose":
      scheduleTone(330, 0.18, { volume: 0.16, type: "triangle" });
      setTimeout(() => scheduleTone(262, 0.3, { volume: 0.14, type: "triangle" }), 200);
      break;
    case "restart":
      scheduleTone(440, 0.08, { volume: 0.14 });
      setTimeout(() => scheduleTone(554, 0.08, { volume: 0.14 }), 80);
      break;
  }
}

// ── Board Logic ───────────────────────────────────────

function getCandy(row, col) {
  return board[row * SIZE + col];
}

function setCandy(row, col, candy) {
  board[row * SIZE + col] = candy;
}

function randomType() {
  return Math.floor(Math.random() * TYPES);
}

function createCandy(row, col) {
  return { row, col, type: randomType(), id: nextId++, special: null };
}

function toggleAudio() {
  if (!audioEnabled) {
    audioEnabled = true;
    unlockAudio();
    return;
  }

  if (!audioStarted) {
    audioEnabled = false;
    updateAudioButton();
    return;
  }

  audioEnabled = false;
  const wasMusic = !!musicTimer;
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
  if (masterGain) {
    masterGain.gain.value = 0;
  }
  updateAudioButton();

  if (wasMusic) {
    setTimeout(() => {
      audioEnabled = true;
      if (masterGain) masterGain.gain.value = 0.85;
      startMusic();
      updateAudioButton();
    }, 300);
  }
}

function setCatMood(mood, text) {
  if (!catCompanion || !catBubble) return;
  catCompanion.className = `cat-companion mood-${mood}`;
  catBubble.textContent = text;
}

function createBoard() {
  board = [];
  nextId = 1;
  score = 0;
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      board.push(createCandy(row, col));
    }
  }
  let initialMatches = findMatches();
  while (initialMatches.length > 0) {
    for (const pos of initialMatches) {
      const candy = getCandy(pos.row, pos.col);
      if (candy) candy.type = randomType();
    }
    initialMatches = findMatches();
  }
}

function areAdjacent(a, b) {
  return (Math.abs(a.row - b.row) + Math.abs(a.col - b.col)) === 1;
}

function swapCells(a, b) {
  const candyA = getCandy(a.row, a.col);
  const candyB = getCandy(b.row, b.col);
  if (!candyA || !candyB) return;
  candyA.row = b.row;
  candyA.col = b.col;
  candyB.row = a.row;
  candyB.col = a.col;
  setCandy(a.row, a.col, candyB);
  setCandy(b.row, b.col, candyA);
}

function findMatches() {
  const matched = new Set();
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col <= SIZE - 3; col++) {
      const a = getCandy(row, col);
      const b = getCandy(row, col + 1);
      const c = getCandy(row, col + 2);
      if (a && b && c && a.type === b.type && b.type === c.type) {
        for (let k = col; k < SIZE; k++) {
          const candy = getCandy(row, k);
          if (!candy || candy.type !== a.type) break;
          matched.add(`${row},${k}`);
        }
        col += 2;
      }
    }
  }
  for (let col = 0; col < SIZE; col++) {
    for (let row = 0; row <= SIZE - 3; row++) {
      const a = getCandy(row, col);
      const b = getCandy(row + 1, col);
      const c = getCandy(row + 2, col);
      if (a && b && c && a.type === b.type && b.type === c.type) {
        for (let k = row; k < SIZE; k++) {
          const candy = getCandy(k, col);
          if (!candy || candy.type !== a.type) break;
          matched.add(`${k},${col}`);
        }
        row += 2;
      }
    }
  }
  return Array.from(matched).map((key) => {
    const [row, col] = key.split(",").map(Number);
    return { row, col };
  });
}

// ── Render ────────────────────────────────────────────

const COLOR_MAP = [
  "candy-red",
  "candy-blue",
  "candy-green",
  "candy-yellow",
  "candy-purple",
  "candy-orange",
];

function renderTile(candy) {
  const tile = document.createElement("div");
  tile.className = `tile ${COLOR_MAP[candy.type] || ""}`;
  tile.dataset.row = candy.row;
  tile.dataset.col = candy.col;
  if (selected && selected.row === candy.row && selected.col === candy.col) {
    tile.classList.add("selected");
  }
  if (candy.special) {
    tile.classList.add(`special-${candy.special}`);
  }
  return tile;
}

function render() {
  if (!boardElement) return;
  boardElement.innerHTML = "";
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const candy = getCandy(row, col);
      if (candy) {
        boardElement.appendChild(renderTile(candy));
      }
    }
  }
  scoreElement.textContent = score;
  targetElement.textContent = TARGET_SCORE;
  movesElement.textContent = moves;
}

// ── Board Update ─────────────────────────────────────

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gravity() {
  let moved = false;
  for (let col = 0; col < SIZE; col++) {
    let writeRow = SIZE - 1;
    for (let row = SIZE - 1; row >= 0; row--) {
      const candy = getCandy(row, col);
      if (candy) {
        if (row !== writeRow) {
          candy.row = writeRow;
          candy.col = col;
          setCandy(writeRow, col, candy);
          setCandy(row, col, null);
          moved = true;
        }
        writeRow--;
      }
    }
    for (let row = writeRow; row >= 0; row--) {
      const newCandy = createCandy(row, col);
      setCandy(row, col, newCandy);
      moved = true;
    }
  }
  return moved;
}

function buildRainbowPlan(a, b) {
  const candyA = getCandy(a.row, a.col);
  const candyB = getCandy(b.row, b.col);
  const rainbow = candyA?.special === "rainbow" ? candyA : candyB;
  const other = rainbow === candyA ? candyB : candyA;
  if (!rainbow || !other) return null;

  const targetType = other.type;
  const targets = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const candy = getCandy(row, col);
      if (candy && candy.type === targetType) {
        targets.push({ row, col });
      }
    }
  }
  return { rainbow, targetType, targets };
}

async function resolveBoard(initialMatches, moveCells, rainbowPlan) {
  let matches = initialMatches;
  let chain = 0;

  while (matches.length > 0) {
    chain++;
    let removed = 0;

    if (rainbowPlan && chain === 1) {
      removed += rainbowPlan.targets.length;
      for (const pos of rainbowPlan.targets) {
        setCandy(pos.row, pos.col, null);
      }
      setCandy(rainbowPlan.rainbow.row, rainbowPlan.rainbow.col, null);
      removed++;
      rainbowPlan = null;
    } else {
      const groups = {};
      for (const pos of matches) {
        const candy = getCandy(pos.row, pos.col);
        if (!candy) continue;
        const key = `${candy.type}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(pos);
      }
      for (const group of Object.values(groups)) {
        if (group.length >= 5) {
          const mid = group[Math.floor(group.length / 2)];
          const candy = getCandy(mid.row, mid.col);
          if (candy) candy.special = "rainbow";
        } else if (group.length >= 4 && moveCells) {
          const involved = group.some((p) =>
            moveCells.some((m) => m.row === p.row && m.col === p.col)
          );
          if (involved) {
            const mid = group[Math.floor(group.length / 2)];
            const candy = getCandy(mid.row, mid.col);
            if (candy) candy.special = "rainbow";
          }
        }
      }

      for (const pos of matches) {
        const candy = getCandy(pos.row, pos.col);
        if (candy) {
          setCandy(pos.row, pos.col, null);
          removed++;
        }
      }
    }

    render();
    score += removed * 120 + Math.max(0, removed - 3) * 45;
    statusText.textContent = chain > 1 ? `连消 ×${chain}！` : "消掉啦！";
    playSfx(chain > 1 ? "chain" : "clear");
    await delay(260);

    gravity();
    render();
    await delay(200);

    matches = findMatches();
    for (const pos of matches) {
      const candy = getCandy(pos.row, pos.col);
      if (candy?.special === "rainbow") {
        const typeCount = {};
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            const c2 = getCandy(r, c);
            if (c2 && c2 !== candy) {
              typeCount[c2.type] = (typeCount[c2.type] || 0) + 1;
            }
          }
        }
        let bestType = 0;
        let bestCount = 0;
        for (const [type, count] of Object.entries(typeCount)) {
          if (count > bestCount) {
            bestCount = count;
            bestType = Number(type);
          }
        }
        if (bestCount > 0) {
          const targets = [];
          for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
              const c2 = getCandy(r, c);
              if (c2 && c2.type === bestType) targets.push({ row: r, col: c });
            }
          }
          setCandy(candy.row, candy.col, null);
          for (const t of targets) setCandy(t.row, t.col, null);
          score += targets.length * 120 + Math.max(0, targets.length - 3) * 45;
          statusText.textContent = "🌈 彩虹糖！";
          render();
          await delay(300);
          gravity();
          render();
          await delay(200);
          matches = findMatches();
        }
        break;
      }
    }
  }
}

async function tryMove(a, b) {
  unlockAudio();
  if (locked || gameOver || !areAdjacent(a, b)) return;

  const candyA = getCandy(a.row, a.col);
  const candyB = getCandy(b.row, b.col);
  if (!candyA || !candyB) return;

  locked = true;
  selected = null;
  swapCells(a, b);
  playSfx("swap");
  render();
  await delay(130);

  const hasRainbow = candyA.special === "rainbow" || candyB.special === "rainbow";
  const matches = findMatches();

  if (!hasRainbow && matches.length === 0) {
    swapCells(a, b);
    statusText.textContent = "这次没有凑成 3 个，糖果弹回去了。";
    render();
    setCatMood("puzzled", "换个方向");
    playSfx("invalid");
    await delay(120);
    locked = false;
    return;
  }

  moves--;
  const plan = hasRainbow ? buildRainbowPlan(a, b) : null;
  await resolveBoard(matches, [a, b], plan);
  render();
  checkResult();
  locked = false;
}

function checkResult() {
  if (score >= TARGET_SCORE) {
    endGame(true);
    return;
  }

  if (moves <= 0) {
    endGame(false);
  }
}

function endGame(won) {
  gameOver = true;
  setCatMood(won ? "win" : "lose", won ? "赢啦赢啦" : "再来一次");
  playSfx(won ? "win" : "lose");
  resultKicker.textContent = won ? "目标达成" : "步数用完";
  resultTitle.textContent = won ? "太甜了！" : "差一点点";
  resultMessage.textContent = won ? `你拿到了 ${score} 分，糖霜乐园亮晶晶。` : `这次拿到 ${score} 分，再来一局会更顺。`;
  renderLeaderboardMessage("准备同步排行榜...");
  resultModal.classList.remove("hidden");
  if (shareButton) shareButton.style.display = API_BASE ? "" : "none";
  syncLeaderboard();
}

// ── Leaderboard ──────────────────────────────────────

function renderLeaderboardMessage(message) {
  if (!leaderboardList) return;
  leaderboardList.innerHTML = "";
  const item = document.createElement("li");
  item.textContent = message;
  leaderboardList.append(item);
}

function renderLeaderboard(items, myRank = null) {
  if (!leaderboardList) return;
  leaderboardList.innerHTML = "";

  if (!items || items.length === 0) {
    renderLeaderboardMessage("还没有成绩，来当第一名。");
    return;
  }

  for (const entry of items) {
    const item = document.createElement("li");

    const line = document.createElement("div");
    line.className = "score-line";
    const name = document.createElement("span");
    name.className = "score-name";
    name.textContent = entry.displayName || "糖豆玩家";
    const value = document.createElement("span");
    value.className = "score-value";
    value.textContent = `${entry.score} 分`;

    line.append(name, value);
    item.append(line);
    leaderboardList.append(item);
  }

  if (myRank && !items.some((i) => i.id === myRank.id)) {
    const item = document.createElement("li");
    item.className = "my-rank";
    item.textContent = `你的排名：第 ${myRank.rank} 名 (${myRank.score} 分)`;
    leaderboardList.append(item);
  }
}

async function syncLeaderboard() {
  if (!API_BASE) {
    renderLeaderboardMessage("排行榜接口部署后显示线上排名。");
    return;
  }

  renderLeaderboardMessage("正在同步排行榜...");

  try {
    const scoreResponse = await fetch(`${API_BASE}/api/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        score,
        movesLeft: moves,
        level: "classic",
        guestName: currentUser?.displayName || localStorage.getItem(PLAYER_NAME_KEY) || "",
      }),
    });

    if (!scoreResponse.ok) {
      throw new Error("score_submit_failed");
    }

    const scoreData = await scoreResponse.json();
    lastScoreId = scoreData.id;

    const [leaderboardResponse, rankResponse] = await Promise.all([
      fetch(`${API_BASE}/api/leaderboard?level=classic&limit=8`),
      fetch(`${API_BASE}/api/leaderboard/me?scoreId=${encodeURIComponent(scoreData.id)}`),
    ]);

    if (!leaderboardResponse.ok || !rankResponse.ok) {
      throw new Error("leaderboard_load_failed");
    }

    const leaderboardData = await leaderboardResponse.json();
    const rankData = await rankResponse.json();
    renderLeaderboard(leaderboardData.items || [], rankData.item || null);
  } catch {
    renderLeaderboardMessage("排行榜暂时连不上，稍后再试。");
  }
}

// ── Events ───────────────────────────────────────────

function handleTileClick(event) {
  unlockAudio();
  const tile = event.target.closest(".tile");
  if (!tile || locked || gameOver) return;

  const current = { row: Number(tile.dataset.row), col: Number(tile.dataset.col) };
  if (!selected) {
    selected = current;
    playSfx("select");
    render();
    return;
  }

  if (selected.row === current.row && selected.col === current.col) {
    selected = null;
    render();
    return;
  }

  if (areAdjacent(selected, current)) {
    tryMove(selected, current);
    return;
  }

  selected = current;
  statusText.textContent = "只能交换相邻的糖果。";
  render();
  setCatMood("puzzled", "要挨着哦");
  playSfx("invalid");
}

function handlePointerDown(event) {
  unlockAudio();
  const tile = event.target.closest(".tile");
  if (!tile || locked || gameOver) return;
  dragStart = {
    row: Number(tile.dataset.row),
    col: Number(tile.dataset.col),
    x: event.clientX,
    y: event.clientY,
  };
}

function handlePointerUp(event) {
  if (!dragStart || locked || gameOver) {
    dragStart = null;
    return;
  }

  const deltaX = event.clientX - dragStart.x;
  const deltaY = event.clientY - dragStart.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance > 24) {
    const target = { row: dragStart.row, col: dragStart.col };
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      target.col += deltaX > 0 ? 1 : -1;
    } else {
      target.row += deltaY > 0 ? 1 : -1;
    }

    if (target.row >= 0 && target.row < SIZE && target.col >= 0 && target.col < SIZE) {
      selected = null;
      tryMove({ row: dragStart.row, col: dragStart.col }, target);
    }
  }

  dragStart = null;
}

function restartGame() {
  score = 0;
  moves = START_MOVES;
  selected = null;
  locked = false;
  gameOver = false;
  dragStart = null;
  lastScoreId = null;
  statusText.textContent = "交换相邻糖果，凑齐 3 个同色就会消除。";
  renderLeaderboardMessage("部署排行榜接口后显示成绩。");
  resultModal.classList.add("hidden");
  createBoard();
  render();
  setCatMood("ready", "喵，开局！");
  updateAudioButton();
}

function enterGame() {
  document.body.classList.remove("cover-active");
  coverScreen?.classList.add("hidden");
  unlockAudio();
  playSfx("restart");
}

// ── Init ─────────────────────────────────────────────

boardElement.addEventListener("click", handleTileClick);
boardElement.addEventListener("pointerdown", handlePointerDown);
boardElement.addEventListener("pointerup", handlePointerUp);
boardElement.addEventListener("pointercancel", () => {
  dragStart = null;
});
restartButton.addEventListener("click", () => {
  unlockAudio();
  playSfx("restart");
  restartGame();
});
playAgainButton.addEventListener("click", () => {
  unlockAudio();
  playSfx("restart");
  restartGame();
});
audioButton.addEventListener("click", toggleAudio);
startButton?.addEventListener("click", enterGame);
loginButton?.addEventListener("click", () => startLogin("google"));
wechatLoginButton?.addEventListener("click", () => startLogin("wechat"));
logoutButton?.addEventListener("click", doLogout);
shareButton?.addEventListener("click", shareScore);

restartGame();
checkLoginFromUrl().then(() => refreshUser());
