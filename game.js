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
const logoutButton = document.querySelector("#logoutButton");
const userName = document.querySelector("#userName");
const userAvatar = document.querySelector("#userAvatar");
const loginModal = document.querySelector("#loginModal");
const closeLoginButton = document.querySelector("#closeLoginButton");
const loginMethods = document.querySelector("#loginMethods");
const googleLoginButton = document.querySelector("#googleLoginButton");
const manualLoginButton = document.querySelector("#manualLoginButton");
const manualLoginForm = document.querySelector("#manualLoginForm");
const loginBackButton = document.querySelector("#loginBackButton");
const guestNameInput = document.querySelector("#guestNameInput");
const loginFormError = document.querySelector("#loginFormError");
const shareButton = document.querySelector("#shareButton");
const posterModal = document.querySelector("#posterModal");
const closePosterButton = document.querySelector("#closePosterButton");
const sharePosterCanvas = document.querySelector("#sharePosterCanvas");
const nativeSharePosterButton = document.querySelector("#nativeSharePosterButton");
const downloadPosterButton = document.querySelector("#downloadPosterButton");

const SIZE = 8;
const TYPES = 6;
const START_MOVES = 24;
const TARGET_SCORE = 6000;
const MOVE_BONUS_POINTS = 250;
const CELL_COUNT = SIZE * SIZE;
const API_BASE = window.TANGDOU_API_BASE || localStorage.getItem("tangdouApiBase") || "";
const PLAYER_NAME_KEY = "tangdouGuestName";
const AUTH_TOKEN_KEY = "tangdouAuthToken";
const LOCAL_PROFILE_KEY = "tangdouLocalProfile";
const LOCAL_CLIENT_ID_KEY = "tangdouLocalClientId";

let board = [];
let score = 0;
let moves = START_MOVES;
let moveBonusAwarded = 0;
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
let lastRankItem = null;
let lastGameSummary = null;
let lastPosterBlob = null;
let currentUser = null;
let ignoreNextClick = false;

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

function getLocalProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem(LOCAL_PROFILE_KEY) || "null");
    if (!profile?.displayName || !profile?.avatarUrl) return null;
    return { id: "local", provider: "local", displayName: profile.displayName, avatarUrl: profile.avatarUrl };
  } catch {
    return null;
  }
}

function saveLocalProfile(displayName, avatarUrl) {
  const profile = { displayName, avatarUrl };
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(PLAYER_NAME_KEY, displayName);
  return profile;
}

function getLocalClientId() {
  let clientId = localStorage.getItem(LOCAL_CLIENT_ID_KEY) || "";
  if (!clientId) {
    clientId = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
          const random = Math.floor(Math.random() * 16);
          const value = char === "x" ? random : (random & 0x3) | 0x8;
          return value.toString(16);
        });
    localStorage.setItem(LOCAL_CLIENT_ID_KEY, clientId);
  }
  return clientId;
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
  if (!API_BASE || !getAuthToken()) {
    currentUser = null;
    updateUserUI(null);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/me`, { headers: authHeaders() });
    if (!res.ok) { currentUser = null; updateUserUI(null); return; }
    const data = await res.json();
    currentUser = data.user;
    if (!currentUser) setAuthToken("");
    updateUserUI(currentUser);
  } catch {
    currentUser = null;
    updateUserUI(null);
  }
}

function updateUserUI(user) {
  if (!loginButton || !logoutButton || !userName || !userAvatar) return;

  if (user) {
    loginButton.classList.add("hidden");
    logoutButton.classList.remove("hidden");
    userName.classList.remove("hidden");
    userAvatar.classList.toggle("hidden", !user.avatarUrl);
    userAvatar.src = user.avatarUrl || "";
    userAvatar.alt = `${user.displayName || "玩家"}的头像`;
    userName.textContent = user.displayName || "玩家";
  } else {
    loginButton.classList.remove("hidden");
    logoutButton.classList.add("hidden");
    userName.classList.remove("hidden");
    userAvatar.classList.add("hidden");
    userAvatar.removeAttribute("src");
    userAvatar.alt = "";
    userName.textContent = "匿名玩家";
  }
}

function showLoginMethods() {
  loginMethods?.classList.remove("hidden");
  manualLoginForm?.classList.add("hidden");
  loginFormError?.classList.add("hidden");
}

function openLoginModal() {
  showLoginMethods();
  loginModal?.classList.remove("hidden");
}

function closeLoginModal() {
  loginModal?.classList.add("hidden");
}

function showManualLogin() {
  loginMethods?.classList.add("hidden");
  manualLoginForm?.classList.remove("hidden");
  const saved = getLocalProfile();
  if (guestNameInput) guestNameInput.value = saved?.displayName || "";
  guestNameInput?.focus();
}

function startGoogleLogin() {
  if (!API_BASE) {
    alert("登录服务暂时不可用，请稍后再试。");
    return;
  }
  const redirect = `${window.location.origin}${window.location.pathname}`;
  window.location.href = `${API_BASE}/api/auth/google/start?redirect=${encodeURIComponent(redirect)}`;
}

async function submitManualLogin(event) {
  event.preventDefault();
  const displayName = guestNameInput?.value.trim() || "";
  const avatarInput = manualLoginForm?.querySelector('input[name="guestAvatar"]:checked');
  const avatarUrl = avatarInput?.value || "assets/avatars/peach-cat.svg";

  if (!displayName) {
    if (loginFormError) {
      loginFormError.textContent = "请输入用户名。";
      loginFormError.classList.remove("hidden");
    }
    guestNameInput?.focus();
    return;
  }

  if (!API_BASE) {
    if (loginFormError) {
      loginFormError.textContent = "登录服务暂时不可用，请稍后再试。";
      loginFormError.classList.remove("hidden");
    }
    return;
  }

  const submitButton = manualLoginForm?.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  if (loginFormError) loginFormError.classList.add("hidden");

  try {
    const response = await fetch(`${API_BASE}/api/auth/guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: getLocalClientId(),
        displayName: displayName.slice(0, 16),
        avatarUrl,
      }),
    });
    if (!response.ok) throw new Error("guest_login_failed");
    const data = await response.json();
    if (!data.token || !data.user) throw new Error("invalid_login_response");

    setAuthToken(data.token);
    saveLocalProfile(data.user.displayName, data.user.avatarUrl || avatarUrl);
    currentUser = data.user;
    updateUserUI(currentUser);
    closeLoginModal();
    setCatMood("happy", `你好，${currentUser.displayName}`);
  } catch {
    if (loginFormError) {
      loginFormError.textContent = "登录失败，请检查网络后重试。";
      loginFormError.classList.remove("hidden");
    }
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function doLogout() {
  setAuthToken("");
  localStorage.removeItem(LOCAL_PROFILE_KEY);
  localStorage.removeItem(PLAYER_NAME_KEY);
  currentUser = null;
  updateUserUI(null);
  if (API_BASE) {
    fetch(`${API_BASE}/api/auth/logout`, { method: "POST", headers: authHeaders() }).catch(() => {});
  }
}

// ── Share ─────────────────────────────────────────────

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function loadPosterImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawCandyBean(ctx, x, y, width, height, color, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.shadowColor = "rgba(84, 34, 91, 0.2)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 7;
  const gradient = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(0.12, color);
  gradient.addColorStop(1, color);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawQrCode(ctx, text, x, y, size) {
  if (typeof window.qrcode !== "function") throw new Error("qrcode_library_missing");
  const qr = window.qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const modules = qr.getModuleCount();
  const quietZone = 4;
  const cell = Math.floor(size / (modules + quietZone * 2));
  const renderedSize = cell * (modules + quietZone * 2);
  const offsetX = x + Math.floor((size - renderedSize) / 2);
  const offsetY = y + Math.floor((size - renderedSize) / 2);

  fillRoundedRect(ctx, x, y, size, size, 28, "#fff");
  ctx.fillStyle = "#3f234d";
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(
          offsetX + (col + quietZone) * cell,
          offsetY + (row + quietZone) * cell,
          cell,
          cell,
        );
      }
    }
  }
}

async function canvasToPngBlob(canvas) {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("poster_blob_failed")), "image/png", 1);
  });
}

async function drawSharePoster(shareUrl) {
  if (!sharePosterCanvas || !currentUser || !lastGameSummary) {
    throw new Error("poster_data_missing");
  }

  const ctx = sharePosterCanvas.getContext("2d");
  const width = sharePosterCanvas.width;
  const height = sharePosterCanvas.height;
  const [coverImage, avatarImage] = await Promise.all([
    loadPosterImage("assets/tangdou-cover.png"),
    loadPosterImage(currentUser.avatarUrl || "assets/avatars/peach-cat.svg"),
  ]);

  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#73cdf6");
  background.addColorStop(0.3, "#ffc3df");
  background.addColorStop(1, "#fff0c7");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  drawImageCover(ctx, coverImage, 0, 0, width, 390);
  const coverFade = ctx.createLinearGradient(0, 170, 0, 430);
  coverFade.addColorStop(0, "rgba(255,255,255,0)");
  coverFade.addColorStop(1, "#ffc9e1");
  ctx.fillStyle = coverFade;
  ctx.fillRect(0, 160, width, 280);

  drawCandyBean(ctx, 86, 468, 96, 58, "#ff4f96", -0.55);
  drawCandyBean(ctx, 998, 504, 102, 60, "#7d5bea", 0.65);
  drawCandyBean(ctx, 78, 994, 92, 56, "#39c879", 0.5);
  drawCandyBean(ctx, 1008, 950, 96, 58, "#ffb323", -0.45);

  fillRoundedRect(ctx, 66, 350, 948, 184, 42, "rgba(255,255,255,0.92)");
  ctx.save();
  ctx.shadowColor = "rgba(88, 36, 85, 0.18)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  roundedRectPath(ctx, 66, 350, 948, 184, 42);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(166, 442, 68, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatarImage, 98, 374, 136, 136);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(166, 442, 70, 0, Math.PI * 2);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.fillStyle = "#6a315e";
  ctx.font = "900 30px system-ui, sans-serif";
  ctx.fillText("糖豆玩家", 264, 414);
  ctx.fillStyle = "#3f234d";
  ctx.font = "900 50px system-ui, sans-serif";
  ctx.fillText(currentUser.displayName || "糖豆玩家", 264, 478, 440);

  const rankText = lastRankItem?.rank ? `第 ${lastRankItem.rank} 名` : "排名计算中";
  fillRoundedRect(ctx, 766, 394, 200, 94, 30, "#ffec79");
  ctx.fillStyle = "#a45121";
  ctx.textAlign = "center";
  ctx.font = "900 36px system-ui, sans-serif";
  ctx.fillText(rankText, 866, 453, 176);
  ctx.textAlign = "left";

  fillRoundedRect(ctx, 104, 580, 872, 382, 54, "#fffafc");
  ctx.strokeStyle = "#ff98c3";
  ctx.lineWidth = 6;
  roundedRectPath(ctx, 104, 580, 872, 382, 54);
  ctx.stroke();
  ctx.fillStyle = "#a85b85";
  ctx.textAlign = "center";
  ctx.font = "900 30px system-ui, sans-serif";
  ctx.fillText("本局得分截图", 540, 646);
  ctx.fillStyle = "#ee3d8d";
  ctx.font = "900 122px system-ui, sans-serif";
  ctx.fillText(lastGameSummary.finalScore.toLocaleString(), 540, 790);
  ctx.fillStyle = "#5c2e57";
  ctx.font = "900 34px system-ui, sans-serif";
  ctx.fillText("最终得分", 540, 840);
  ctx.font = "800 26px system-ui, sans-serif";
  ctx.fillStyle = "#8b6581";
  const bonusLine = lastGameSummary.won
    ? `基础 ${lastGameSummary.baseScore.toLocaleString()}  +  剩余 ${lastGameSummary.remainingMoves} 步 × ${MOVE_BONUS_POINTS}  =  奖励 ${lastGameSummary.moveBonus.toLocaleString()}`
    : `本局基础得分 ${lastGameSummary.baseScore.toLocaleString()} · 未获得通关步数奖励`;
  ctx.fillText(bonusLine, 540, 906, 760);

  drawQrCode(ctx, shareUrl, 130, 1030, 286);
  ctx.textAlign = "left";
  ctx.fillStyle = "#4d2b52";
  ctx.font = "900 44px system-ui, sans-serif";
  ctx.fillText("扫码来挑战糖豆乐园", 464, 1110);
  ctx.fillStyle = "#8f6687";
  ctx.font = "800 28px system-ui, sans-serif";
  ctx.fillText("看看你能不能超过我的排名！", 464, 1160);
  ctx.font = "700 23px system-ui, sans-serif";
  ctx.fillText("www.gzywl.cn/tangdou/", 464, 1220);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(79, 41, 77, 0.66)";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText("糖豆乐园 · 甜甜消除，快乐排行", 540, 1380);
  ctx.textAlign = "left";

  lastPosterBlob = await canvasToPngBlob(sharePosterCanvas);
}

function closePosterModal() {
  posterModal?.classList.add("hidden");
}

function downloadPoster() {
  if (!lastPosterBlob) return;
  const url = URL.createObjectURL(lastPosterBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `糖豆乐园-${currentUser?.displayName || "玩家"}-${score}分.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function nativeSharePoster() {
  if (!lastPosterBlob) return;
  const file = new File([lastPosterBlob], `糖豆乐园-${score}分.png`, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: "我的糖豆乐园战绩",
        text: `我在糖豆乐园获得 ${score} 分，排名第 ${lastRankItem?.rank || "?"}！`,
        files: [file],
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  downloadPoster();
}

async function shareScore() {
  if (!API_BASE || !lastScoreId || !currentUser || !lastRankItem) {
    alert("成绩和排名还在同步，请稍后再试。");
    return;
  }
  if (shareButton) shareButton.disabled = true;
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
    await drawSharePoster(shareUrl);
    posterModal?.classList.remove("hidden");
  } catch {
    alert("海报生成失败，请检查网络后重试。");
  } finally {
    if (shareButton) shareButton.disabled = false;
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

function toggleAudio() {
  if (audioEnabled && !audioStarted) {
    unlockAudio();
    playSfx("select");
    updateAudioButton();
    return;
  }

  audioEnabled = !audioEnabled;

  if (audioEnabled) {
    unlockAudio();
    if (masterGain && audioContext) {
      masterGain.gain.setTargetAtTime(0.85, audioContext.currentTime, 0.02);
    }
    playSfx("select");
  } else {
    stopMusic();
    if (masterGain && audioContext) {
      masterGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.02);
    }
  }

  updateAudioButton();
}

function setCatMood(mood, message) {
  if (!catCompanion || !catBubble) return;
  catCompanion.className = `cat-companion mood-${mood}`;
  catCompanion.setAttribute("aria-label", `陪玩猫猫：${message}`);
  catBubble.textContent = message;
}

function updateCatMood() {
  if (gameOver) return;

  const progress = score / TARGET_SCORE;
  if (moves <= 5 && progress < 0.9) {
    setCatMood("worried", "步数紧张");
    return;
  }

  if (progress >= 0.85) {
    setCatMood("excited", "快成功啦");
    return;
  }

  if (score > 0) {
    setCatMood("happy", "甜甜加分");
    return;
  }

  setCatMood("ready", "喵，开局！");
}

function makeCandy(type = randomType(), special = null) {
  return { id: nextId++, type, special };
}

function randomType() {
  return Math.floor(Math.random() * TYPES);
}

function keyOf(row, col) {
  return `${row},${col}`;
}

function parseKey(key) {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

function getCandy(row, col) {
  return board[row]?.[col] ?? null;
}

function areAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function createBoard() {
  do {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        let type = randomType();
        while (wouldCreateStartingMatch(row, col, type)) {
          type = randomType();
        }
        board[row][col] = makeCandy(type);
      }
    }
  } while (!hasAvailableMove());
}

function wouldCreateStartingMatch(row, col, type) {
  const leftMatch = col >= 2 && board[row][col - 1]?.type === type && board[row][col - 2]?.type === type;
  const upMatch = row >= 2 && board[row - 1][col]?.type === type && board[row - 2][col]?.type === type;
  return leftMatch || upMatch;
}

function hasAvailableMove() {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const current = { row, col };
      const right = { row, col: col + 1 };
      const down = { row: row + 1, col };

      if (right.col < SIZE && createsMatchAfterSwap(current, right)) return true;
      if (down.row < SIZE && createsMatchAfterSwap(current, down)) return true;
    }
  }

  return false;
}

function createsMatchAfterSwap(a, b) {
  swapCells(a, b);
  const hasMatch = findMatches().length > 0;
  swapCells(a, b);
  return hasMatch;
}

function render(dropKeys = new Set(), popKeys = new Set()) {
  const fragment = document.createDocumentFragment();

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const candy = board[row][col];
      const tile = document.createElement("button");
      tile.className = "tile";
      tile.type = "button";
      tile.dataset.row = row;
      tile.dataset.col = col;
      tile.setAttribute("aria-label", `第 ${row + 1} 行，第 ${col + 1} 列糖果`);

      if (selected?.row === row && selected?.col === col) {
        tile.classList.add("selected");
      }
      if (dropKeys.has(keyOf(row, col))) {
        tile.classList.add("drop");
      }
      if (popKeys.has(keyOf(row, col))) {
        tile.classList.add("pop");
      }

      if (candy) {
        const candyElement = document.createElement("span");
        const specialClass = candy.special === "stripeH" ? "stripe-h" : candy.special === "stripeV" ? "stripe-v" : candy.special;
        candyElement.className = ["candy", `type-${candy.type}`, specialClass].filter(Boolean).join(" ");
        tile.append(candyElement);
      }

      fragment.append(tile);
    }
  }

  boardElement.replaceChildren(fragment);
  scoreElement.textContent = score;
  targetElement.textContent = TARGET_SCORE;
  movesElement.textContent = moves;
  updateCatMood();
}

function swapCells(a, b) {
  const temp = board[a.row][a.col];
  board[a.row][a.col] = board[b.row][b.col];
  board[b.row][b.col] = temp;
}

function findMatches() {
  const matches = [];

  for (let row = 0; row < SIZE; row++) {
    let start = 0;
    for (let col = 1; col <= SIZE; col++) {
      const same = col < SIZE && board[row][col]?.type === board[row][start]?.type && board[row][col]?.special !== "rainbow" && board[row][start]?.special !== "rainbow";
      if (!same) {
        const length = col - start;
        if (length >= 3) {
          matches.push({
            orientation: "horizontal",
            cells: Array.from({ length }, (_, index) => ({ row, col: start + index })),
          });
        }
        start = col;
      }
    }
  }

  for (let col = 0; col < SIZE; col++) {
    let start = 0;
    for (let row = 1; row <= SIZE; row++) {
      const same = row < SIZE && board[row][col]?.type === board[start][col]?.type && board[row][col]?.special !== "rainbow" && board[start][col]?.special !== "rainbow";
      if (!same) {
        const length = row - start;
        if (length >= 3) {
          matches.push({
            orientation: "vertical",
            cells: Array.from({ length }, (_, index) => ({ row: start + index, col })),
          });
        }
        start = row;
      }
    }
  }

  return matches;
}

function chooseCreationCell(match, moveCells) {
  if (moveCells) {
    const moveMatch = match.cells.find((cell) => moveCells.some((moved) => moved.row === cell.row && moved.col === cell.col));
    if (moveMatch) return moveMatch;
  }
  return match.cells[Math.floor(match.cells.length / 2)];
}

function buildClearPlan(matches, moveCells = null) {
  const clearKeys = new Set();
  const creations = new Map();

  for (const match of matches) {
    let creation = null;
    if (match.cells.length >= 4) {
      const creationCell = chooseCreationCell(match, moveCells);
      creation = {
        cell: creationCell,
        special: match.cells.length >= 5 ? "rainbow" : match.orientation === "horizontal" ? "stripeH" : "stripeV",
      };
      creations.set(keyOf(creationCell.row, creationCell.col), creation.special);
    }

    for (const cell of match.cells) {
      const key = keyOf(cell.row, cell.col);
      if (!creation || key !== keyOf(creation.cell.row, creation.cell.col)) {
        clearKeys.add(key);
      }
    }
  }

  expandSpecialClears(clearKeys, creations);
  return { clearKeys, creations };
}

function expandSpecialClears(clearKeys, creations) {
  let changed = true;

  while (changed) {
    changed = false;
    for (const key of Array.from(clearKeys)) {
      if (creations.has(key)) continue;
      const { row, col } = parseKey(key);
      const candy = getCandy(row, col);
      if (!candy) continue;

      if (candy.special === "stripeH") {
        for (let c = 0; c < SIZE; c++) {
          const nextKey = keyOf(row, c);
          if (!clearKeys.has(nextKey)) {
            clearKeys.add(nextKey);
            changed = true;
          }
        }
      }

      if (candy.special === "stripeV") {
        for (let r = 0; r < SIZE; r++) {
          const nextKey = keyOf(r, col);
          if (!clearKeys.has(nextKey)) {
            clearKeys.add(nextKey);
            changed = true;
          }
        }
      }

      if (candy.special === "rainbow") {
        const targetType = board.flat().find((candidate) => candidate && candidate.special !== "rainbow")?.type ?? randomType();
        addTypeToClear(clearKeys, targetType);
        changed = true;
      }
    }
  }
}

function addTypeToClear(clearKeys, type) {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (board[row][col]?.type === type) {
        clearKeys.add(keyOf(row, col));
      }
    }
  }
}

function buildRainbowPlan(a, b) {
  const candyA = getCandy(a.row, a.col);
  const candyB = getCandy(b.row, b.col);
  const clearKeys = new Set([keyOf(a.row, a.col), keyOf(b.row, b.col)]);

  if (candyA.special === "rainbow" && candyB.special === "rainbow") {
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        clearKeys.add(keyOf(row, col));
      }
    }
  } else {
    const target = candyA.special === "rainbow" ? candyB : candyA;
    addTypeToClear(clearKeys, target.type);
  }

  expandSpecialClears(clearKeys, new Map());
  return { clearKeys, creations: new Map() };
}

function applyClearPlan({ clearKeys, creations }) {
  let removed = 0;

  for (const key of clearKeys) {
    if (creations.has(key)) continue;
    const { row, col } = parseKey(key);
    if (board[row][col]) {
      board[row][col] = null;
      removed++;
    }
  }

  for (const [key, special] of creations) {
    const { row, col } = parseKey(key);
    const oldType = board[row][col]?.type ?? randomType();
    board[row][col] = makeCandy(oldType, special);
  }

  score += removed * 120 + Math.max(0, removed - 3) * 45;
}

function collapseBoard() {
  const dropKeys = new Set();

  for (let col = 0; col < SIZE; col++) {
    const survivors = [];
    for (let row = SIZE - 1; row >= 0; row--) {
      if (board[row][col]) survivors.push(board[row][col]);
    }

    for (let row = SIZE - 1; row >= 0; row--) {
      const nextCandy = survivors[SIZE - 1 - row] ?? makeCandy();
      if (board[row][col]?.id !== nextCandy.id) {
        dropKeys.add(keyOf(row, col));
      }
      board[row][col] = nextCandy;
    }
  }

  return dropKeys;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveBoard(firstMatches, moveCells = null, initialPlan = null) {
  let matches = firstMatches;
  let plan = initialPlan;
  let chain = 0;

  while ((matches && matches.length) || plan) {
    chain++;
    if (!plan) {
      plan = buildClearPlan(matches, moveCells);
    }

    const popKeys = new Set([...plan.clearKeys].filter((key) => !plan.creations.has(key)));
    render(new Set(), popKeys);
    await delay(210);
    applyClearPlan(plan);
    const dropKeys = collapseBoard();
    statusText.textContent = chain > 1 ? `连锁 x${chain}！糖果自己排成甜甜的队伍。` : "漂亮！继续找下一组甜蜜组合。";
    render(dropKeys);
    setCatMood(chain > 1 ? "excited" : "happy", chain > 1 ? "连锁好棒" : "消掉啦");
    playSfx(chain > 1 ? "chain" : "clear");
    await delay(260);

    matches = findMatches();
    plan = null;
    moveCells = null;
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
  if (!hasAvailableMove()) {
    statusText.textContent = "糖果重新洗牌，继续找甜甜组合。";
    createBoard();
  }
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
  if (gameOver) return;
  gameOver = true;
  const baseScore = score;
  moveBonusAwarded = won ? moves * MOVE_BONUS_POINTS : 0;
  score += moveBonusAwarded;
  lastGameSummary = {
    won,
    baseScore,
    remainingMoves: moves,
    moveBonus: moveBonusAwarded,
    finalScore: score,
  };
  scoreElement.textContent = score;
  setCatMood(won ? "win" : "lose", won ? "赢啦赢啦" : "再来一次");
  playSfx(won ? "win" : "lose");
  resultKicker.textContent = won ? "目标达成" : "步数用完";
  resultTitle.textContent = won ? "太甜了！" : "差一点点";
  resultMessage.textContent = won
    ? `基础得分 ${baseScore.toLocaleString()} + 剩余 ${moves} 步奖励 ${moveBonusAwarded.toLocaleString()} = 最终 ${score.toLocaleString()} 分！`
    : `这次拿到 ${score.toLocaleString()} 分，再来一局会更顺。`;
  renderLeaderboardMessage("准备同步排行榜...");
  resultModal.classList.remove("hidden");
  if (shareButton) {
    shareButton.style.display = API_BASE && currentUser && getAuthToken() ? "" : "none";
    shareButton.disabled = true;
  }
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
    if (entry.userId && entry.userId === currentUser?.id) {
      item.classList.add("current-player-score");
    }
    const identity = document.createElement("span");
    identity.className = "score-identity";
    if (entry.avatarUrl) {
      const avatar = document.createElement("img");
      avatar.className = "score-avatar";
      avatar.src = entry.avatarUrl;
      avatar.alt = "";
      identity.append(avatar);
    }
    const name = document.createElement("span");
    name.className = "score-name";
    name.textContent = entry.displayName || "糖豆玩家";
    identity.append(name);
    if (entry.userId && entry.userId === currentUser?.id) {
      const me = document.createElement("em");
      me.className = "me-badge";
      me.textContent = "我";
      identity.append(me);
    }
    const value = document.createElement("span");
    value.className = "score-value";
    value.textContent = `${entry.score} 分`;

    line.append(identity, value);
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

function appendLeaderboardNotice(message) {
  if (!leaderboardList) return;
  const item = document.createElement("li");
  item.className = "leaderboard-notice";
  item.textContent = message;
  leaderboardList.append(item);
}

async function syncLeaderboard() {
  if (!API_BASE) {
    renderLeaderboardMessage("排行榜接口部署后显示线上排名。");
    return;
  }

  renderLeaderboardMessage("正在同步排行榜...");
  lastRankItem = null;

  try {
    if (!currentUser || !getAuthToken()) {
      const leaderboardResponse = await fetch(`${API_BASE}/api/leaderboard?level=classic&limit=8`);
      if (!leaderboardResponse.ok) throw new Error("leaderboard_load_failed");
      const leaderboardData = await leaderboardResponse.json();
      renderLeaderboard(leaderboardData.items || []);
      appendLeaderboardNotice("匿名玩家的成绩不会记录，登录后即可参与排行。");
      lastScoreId = null;
      return;
    }

    const scoreResponse = await fetch(`${API_BASE}/api/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        score,
        movesLeft: moves,
        level: "classic",
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
    lastRankItem = rankData.item || null;
    renderLeaderboard(rankData.items || leaderboardData.items || [], lastRankItem);
    if (shareButton) shareButton.disabled = !lastRankItem;
  } catch {
    renderLeaderboardMessage("排行榜暂时连不上，稍后再试。");
    if (shareButton) shareButton.disabled = true;
  }
}

// ── Events ───────────────────────────────────────────

function handleTileClick(event) {
  if (ignoreNextClick) {
    ignoreNextClick = false;
    return;
  }
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
      ignoreNextClick = true;
      tryMove({ row: dragStart.row, col: dragStart.col }, target);
    }
  }

  dragStart = null;
}

function restartGame() {
  score = 0;
  moves = START_MOVES;
  moveBonusAwarded = 0;
  selected = null;
  locked = false;
  gameOver = false;
  dragStart = null;
  lastScoreId = null;
  lastRankItem = null;
  lastGameSummary = null;
  lastPosterBlob = null;
  statusText.textContent = "交换相邻糖果，凑齐 3 个同色就会消除。";
  renderLeaderboardMessage("部署排行榜接口后显示成绩。");
  resultModal.classList.add("hidden");
  posterModal?.classList.add("hidden");
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
loginButton?.addEventListener("click", openLoginModal);
closeLoginButton?.addEventListener("click", closeLoginModal);
googleLoginButton?.addEventListener("click", startGoogleLogin);
manualLoginButton?.addEventListener("click", showManualLogin);
loginBackButton?.addEventListener("click", showLoginMethods);
manualLoginForm?.addEventListener("submit", submitManualLogin);
loginModal?.addEventListener("click", (event) => {
  if (event.target === loginModal) closeLoginModal();
});
logoutButton?.addEventListener("click", doLogout);
shareButton?.addEventListener("click", shareScore);
closePosterButton?.addEventListener("click", closePosterModal);
nativeSharePosterButton?.addEventListener("click", nativeSharePoster);
downloadPosterButton?.addEventListener("click", downloadPoster);
posterModal?.addEventListener("click", (event) => {
  if (event.target === posterModal) closePosterModal();
});

restartGame();
checkLoginFromUrl().then(() => refreshUser());
