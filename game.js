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

const SIZE = 8;
const TYPES = 6;
const START_MOVES = 24;
const TARGET_SCORE = 6000;
const CELL_COUNT = SIZE * SIZE;

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

const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 659.25, 783.99, 987.77, 783.99, 698.46, 659.25, 587.33, 659.25];
const bassLine = [261.63, 261.63, 349.23, 349.23, 392, 392, 329.63, 329.63];

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
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  source.start(now);
  source.stop(now + duration);
}

function playMusicStep() {
  if (!audioEnabled || !audioContext || !musicGain) return;
  const note = melody[musicStep % melody.length];
  const bass = bassLine[Math.floor(musicStep / 2) % bassLine.length];
  const beat = musicStep % 4;

  scheduleTone(note, 0.16, {
    destination: musicGain,
    type: beat === 0 ? "triangle" : "sine",
    volume: beat === 0 ? 0.16 : 0.11,
  });

  if (beat === 0 || beat === 2) {
    scheduleTone(bass, 0.22, {
      destination: musicGain,
      type: "triangle",
      volume: 0.07,
    });
  }

  musicStep++;
}

function startMusic() {
  if (musicTimer) return;
  playMusicStep();
  musicTimer = window.setInterval(playMusicStep, 230);
}

function stopMusic() {
  if (!musicTimer) return;
  window.clearInterval(musicTimer);
  musicTimer = null;
}

function playSfx(name) {
  if (!audioEnabled) return;
  unlockAudio();
  if (!audioContext) return;

  if (name === "select") {
    scheduleTone(1046.5, 0.08, { type: "sine", volume: 0.12 });
  }

  if (name === "swap") {
    scheduleTone(659.25, 0.07, { type: "triangle", volume: 0.13 });
    scheduleTone(880, 0.08, { type: "triangle", volume: 0.13, delay: 0.055 });
  }

  if (name === "invalid") {
    scheduleTone(392, 0.13, { type: "sine", volume: 0.11, endFrequency: 293.66 });
  }

  if (name === "clear") {
    [987.77, 1174.66, 1567.98].forEach((note, index) => {
      scheduleTone(note, 0.09, { type: "sine", volume: 0.13, delay: index * 0.045 });
    });
    scheduleNoise(0.09, { volume: 0.035, frequency: 2600, delay: 0.02 });
  }

  if (name === "chain") {
    [1174.66, 1567.98, 2093, 2637.02].forEach((note, index) => {
      scheduleTone(note, 0.08, { type: "triangle", volume: 0.14, delay: index * 0.04 });
    });
    scheduleNoise(0.13, { volume: 0.06, frequency: 3200, delay: 0.05 });
  }

  if (name === "win") {
    [783.99, 987.77, 1174.66, 1567.98, 2093].forEach((note, index) => {
      scheduleTone(note, 0.16, { type: "triangle", volume: 0.16, delay: index * 0.08 });
    });
  }

  if (name === "lose") {
    [659.25, 523.25, 392].forEach((note, index) => {
      scheduleTone(note, 0.18, { type: "sine", volume: 0.11, delay: index * 0.09 });
    });
  }

  if (name === "restart") {
    [783.99, 1046.5, 1318.51].forEach((note, index) => {
      scheduleTone(note, 0.08, { type: "sine", volume: 0.12, delay: index * 0.04 });
    });
  }
}

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
}

function wouldCreateStartingMatch(row, col, type) {
  const leftMatch = col >= 2 && board[row][col - 1]?.type === type && board[row][col - 2]?.type === type;
  const upMatch = row >= 2 && board[row - 1][col]?.type === type && board[row - 2][col]?.type === type;
  return leftMatch || upMatch;
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
  resultMessage.textContent = won ? `你拿到了 ${score} 分，糖豆乐园亮晶晶。` : `这次拿到 ${score} 分，再来一局会更顺。`;
  resultModal.classList.remove("hidden");
}

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
  statusText.textContent = "交换相邻糖果，凑齐 3 个同色就会消除。";
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

restartGame();
