// 雑なテトリス風ゲームロジック。本格的なバランスは求めない。
let canvas;
let ctx;
const scale = 24;
const cols = 10;
const rows = 20;

let scoreEl;
let linesEl;
let levelEl;
let moodEl;
let modeEl;
let logEl;
let startBtn;
let pauseBtn;
let body;
let kusogeLayer;
let flashTimer = null;
let modeTimer = null;

const Mode = {
  NORMAL: "normal",
  KUSOGE: "kusoge",
};

let currentMode = Mode.NORMAL;

const KusogeEffects = {
  LASER: "laser",
  DANMAKU: "danmaku",
  TETROMINO: "tetromino",
  FRACTAL: "fractal",
  EMOJI: "emoji",
};

const kusogeEffectPool = Object.values(KusogeEffects);

let currentKusogeEffects = [];

const shapes = [
  [[1, 1, 1, 1]],
  [
    [0, 2, 0],
    [2, 2, 2],
  ],
  [
    [3, 0, 0],
    [3, 3, 3],
  ],
  [
    [0, 0, 4],
    [4, 4, 4],
  ],
  [
    [5, 5],
    [5, 5],
  ],
  [
    [6, 6, 0],
    [0, 6, 6],
  ],
  [
    [0, 7, 7],
    [7, 7, 0],
  ],
];

const colors = {
  0: "#000",
  1: "#53a2ff",
  2: "#ff4f6d",
  3: "#ffbf69",
  4: "#8c6ff7",
  5: "#ffe066",
  6: "#4fd1c5",
  7: "#c56cf0",
};

const moods = ["😑", "😠", "🤢", "😵", "🤯"];
const normalMoods = ["🙂", "😌", "😎", "😄", "🤩"];

function cloneShape(shape) {
  return shape.map((row) => [...row]);
}

function getPieceId(piece) {
  for (const row of piece) {
    for (const value of row) {
      if (value !== 0) {
        return value;
      }
    }
  }
  return 0;
}

function getRandomShape(excludeId) {
  const pool = shapes.filter((shape) => getPieceId(shape) !== excludeId);
  const candidates = pool.length > 0 ? pool : shapes;
  const index = (Math.random() * candidates.length) | 0;
  return candidates[index];
}

function isNormalMode() {
  return currentMode === Mode.NORMAL;
}

function createMatrix() {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function rotate(matrix, dir) {
  // 新しい行列を生成して回転後の形状を作る
  const height = matrix.length;
  const width = matrix[0].length;
  const rotated = Array.from({ length: width }, (_, x) =>
    matrix.map((row) => (row[x] !== undefined ? row[x] : 0))
  );
  if (dir > 0) {
    return rotated.map((row) => row.reverse());
  }
  return rotated.reverse();
}

function logEvent(message) {
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
  logEl.prepend(li);
  while (logEl.children.length > 12) {
    logEl.removeChild(logEl.lastChild);
  }
}

class TeteGame {
  constructor() {
    this.board = createMatrix();
    this.piece = null;
    this.pos = { x: 0, y: 0 };
    this.dropCounter = 0;
    this.dropInterval = 800;
    this.lastTime = 0;
    this.running = false;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.controlInverted = false;
    this.invertTimer = null;
    this.animationId = null;
    this.bindInputs();
  }

  bindInputs() {
    document.addEventListener("keydown", (event) => {
      if (!this.running) return;
      const key = this.controlInverted ? this.invertKey(event.code) : event.code;
      switch (key) {
        case "ArrowLeft":
          this.move(-1);
          break;
        case "ArrowRight":
          this.move(1);
          break;
        case "ArrowDown":
          this.softDrop();
          break;
        case "ArrowUp":
          this.rotatePiece();
          break;
        case "Space":
          this.hardDrop();
          break;
        default:
          break;
      }
    });
  }

  invertKey(code) {
    // 意図的に左右だけでなく上下も逆転させて理不尽さを演出
    const map = {
      ArrowLeft: "ArrowRight",
      ArrowRight: "ArrowLeft",
      ArrowDown: "ArrowUp",
      ArrowUp: "ArrowDown",
    };
    return map[code] || code;
  }

  start() {
    this.reset();
    this.running = true;
    this.lastTime = 0;
    this.dropCounter = 0;
    logEvent("新しい地獄が始まった。");
    this.update();
  }

  pause() {
    if (!this.running) return;
    cancelAnimationFrame(this.animationId);
    this.running = false;
    logEvent("一時停止。逃げても状況は良くならない。");
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    this.dropCounter = 0;
    this.update();
    logEvent("再開。覚悟しろ。");
  }

  reset() {
    this.board = createMatrix();
    this.spawnPiece();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = 800;
    this.controlInverted = false;
    clearTimeout(this.invertTimer);
    updateScoreboard(this);
    clearBoardBackground();
    logEvent("ボード初期化。");
  }

  spawnPiece() {
    const index = (Math.random() * shapes.length) | 0;
    this.piece = cloneShape(shapes[index]);
    this.pos.y = 0;
    this.pos.x = ((cols / 2) | 0) - ((this.piece[0].length / 2) | 0);
    if (this.collide()) {
      this.gameOver();
    }
  }

  gameOver() {
    this.running = false;
    cancelAnimationFrame(this.animationId);
    logEvent("ハードロック！ゲームオーバー。");
    alert("雑に終了しました。スタートで再挑戦。");
  }

  update(time = 0) {
    if (!this.running) return;
    const delta = time - this.lastTime;
    this.lastTime = time;
    this.dropCounter += delta;
    if (this.dropCounter > this.dropInterval) {
      this.drop();
    }
    this.draw();
    this.animationId = requestAnimationFrame((t) => this.update(t));
  }

  draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawMatrix(this.board, { x: 0, y: 0 });
    drawMatrix(this.piece, this.pos);
  }

  move(dir) {
    this.pos.x += dir;
    if (this.collide()) {
      this.pos.x -= dir;
    }
  }

  rotatePiece() {
    if (!isNormalMode()) {
      const originalPiece = cloneShape(this.piece);
      const originalPos = { x: this.pos.x, y: this.pos.y };
      const currentId = getPieceId(this.piece);
      const newShape = cloneShape(getRandomShape(currentId));
      this.piece = newShape;
      const centerX = originalPos.x + Math.floor(originalPiece[0].length / 2);
      this.pos.x = centerX - Math.floor(this.piece[0].length / 2);
      this.pos.x = Math.max(0, Math.min(cols - this.piece[0].length, this.pos.x));
      if (this.collide()) {
        const offsets = [0, -1, 1, -2, 2];
        for (const shift of offsets) {
          this.pos.x += shift;
          if (!this.collide()) {
            logEvent("回転ボタンでブロック種類が変わった。混乱必至。");
            return;
          }
          this.pos.x -= shift;
        }
        this.piece = originalPiece;
        this.pos.x = originalPos.x;
        this.pos.y = originalPos.y;
      } else {
        logEvent("回転ボタンでブロック種類が変わった。混乱必至。");
      }
      return;
    }
    const original = this.piece.map((row) => [...row]);
    this.piece = rotate(this.piece, 1);
    const offset = [0, -1, 1];
    for (const shift of offset) {
      this.pos.x += shift;
      if (!this.collide()) {
        return;
      }
      this.pos.x -= shift;
    }
    this.piece = original;
  }

  drop() {
    this.pos.y++;
    if (this.collide()) {
      this.pos.y--;
      this.merge();
      this.clearLines();
      this.spawnPiece();
      this.rollInvertEvent();
      updateScoreboard(this);
    }
    this.dropCounter = 0;
  }

  softDrop() {
    this.score += 1;
    this.drop();
    updateScoreboard(this);
  }

  hardDrop() {
    // 強制落下は落ちるほど理不尽な減点
    let distance = 0;
    while (true) {
      this.pos.y++;
      if (this.collide()) {
        this.pos.y--;
        break;
      }
      distance++;
    }
    this.merge();
    if (isNormalMode()) {
      this.score += distance * 2;
    } else {
      this.score -= distance * 2;
      if (distance > 0) {
        logEvent(`勢い余って減点 ${distance * 2} 点。`);
      }
    }
    this.clearLines();
    this.spawnPiece();
    this.rollInvertEvent();
    this.dropCounter = 0;
    updateScoreboard(this);
  }

  collide() {
    for (let y = 0; y < this.piece.length; y++) {
      for (let x = 0; x < this.piece[y].length; x++) {
        if (this.piece[y][x] === 0) continue;
        const boardY = y + this.pos.y;
        const boardX = x + this.pos.x;
        if (
          boardY < 0 ||
          boardX < 0 ||
          boardY >= rows ||
          boardX >= cols ||
          this.board[boardY][boardX] !== 0
        ) {
          return true;
        }
      }
    }
    return false;
  }

  merge() {
    this.piece.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          this.board[y + this.pos.y][x + this.pos.x] = value;
        }
      });
    });
  }

  clearLines() {
    let linesCleared = 0;
    outer: for (let y = this.board.length - 1; y >= 0; y--) {
      for (let x = 0; x < this.board[y].length; x++) {
        if (this.board[y][x] === 0) {
          continue outer;
        }
      }
      const row = this.board.splice(y, 1)[0].fill(0);
      this.board.unshift(row);
      linesCleared++;
      y++;
    }
    if (linesCleared > 0) {
      this.lines += linesCleared;
      this.applyWeirdScoring(linesCleared);
      this.bumpLevel();
      triggerFlash();
      logEvent(`${linesCleared} ライン消去。何か嫌な感じ。`);
    }
    updateScoreboard(this);
  }

  applyWeirdScoring(linesCleared) {
    if (isNormalMode()) {
      const standard = [0, 100, 300, 500, 800];
      const gain = standard[linesCleared] || linesCleared * 200;
      this.score += gain;
    } else {
      // 連続消しすると逆に損する理不尽スコア
      const base = 60;
      const penalty = (linesCleared - 1) * 80;
      const gain = Math.max(5, base - penalty);
      this.score += gain;
    }
  }

  bumpLevel() {
    const newLevel = 1 + Math.floor(this.lines / 5);
    if (newLevel !== this.level) {
      this.level = newLevel;
      this.dropInterval = Math.max(200, 800 - this.level * 60);
      moodEl.textContent = moods[this.level % moods.length];
      logEvent(`レベル ${this.level}。誰も望んでいない高速化。`);
    }
  }

  rollInvertEvent() {
    const chance = isNormalMode() ? 0 : 0.25;
    if (Math.random() < chance) {
      // 操作逆転イベントは5秒継続
      this.controlInverted = true;
      clearTimeout(this.invertTimer);
      this.invertTimer = setTimeout(() => {
        this.controlInverted = false;
      }, 5000);
      logEvent("操作が逆になった。心の準備はしていない。");
    }
  }
}

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = colors[value] || "#fff";
        ctx.fillRect((x + offset.x) * scale, (y + offset.y) * scale, scale, scale);
        ctx.strokeStyle = "#111";
        ctx.strokeRect(
          (x + offset.x) * scale,
          (y + offset.y) * scale,
          scale,
          scale
        );
      }
    });
  });
}

function triggerFlash() {
  if (!body) return;
  const color = `rgba(${rand255()}, ${rand255()}, ${rand255()}, 0.3)`;
  const positionX = (Math.random() * 100).toFixed(1);
  const positionY = (Math.random() * 100).toFixed(1);
  const overlay = `radial-gradient(circle at ${positionX}% ${positionY}%, ${color} 0%, transparent 70%)`;
  body.style.setProperty("--flash-overlay", overlay);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(clearBoardBackground, 250);
}

function clearBoardBackground() {
  if (!body) return;
  body.style.setProperty("--flash-overlay", "transparent");
}

function rand255() {
  return (Math.random() * 255) | 0;
}

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function createBulletPath() {
  const orientation = Math.random();
  let startX;
  let startY;
  let endX;
  let endY;
  if (orientation < 0.33) {
    startX = -15;
    endX = 115;
    startY = randRange(-20, 120);
    endY = startY + randRange(-30, 30);
  } else if (orientation < 0.66) {
    startX = 115;
    endX = -15;
    startY = randRange(-20, 120);
    endY = startY + randRange(-30, 30);
  } else {
    startX = randRange(-10, 110);
    endX = startX + randRange(-30, 30);
    if (Math.random() > 0.5) {
      startY = 120;
      endY = -20;
    } else {
      startY = -20;
      endY = 120;
    }
  }
  const midX = (startX + endX) / 2 + randRange(-20, 20);
  const midY = (startY + endY) / 2 + randRange(-20, 20);
  const twist = randRange(240, 540);
  return {
    startX,
    startY,
    midX,
    midY,
    endX,
    endY,
    twist,
    halfTwist: twist / 2,
  };
}

function pickKusogeEffects() {
  const selection = kusogeEffectPool.filter(() => Math.random() < 0.6);
  if (selection.length === 0) {
    const fallback = kusogeEffectPool[(Math.random() * kusogeEffectPool.length) | 0];
    return [fallback];
  }
  return selection;
}

function applyKusogeEffects(effects, active) {
  const effectSet = new Set(active ? effects : []);
  currentKusogeEffects = active ? [...effectSet] : [];
  if (body) {
    body.classList.toggle("has-laser", effectSet.has(KusogeEffects.LASER));
  }
  if (!kusogeLayer) {
    return;
  }
  const classMap = [
    ["with-tetromino", KusogeEffects.TETROMINO],
    ["with-danmaku", KusogeEffects.DANMAKU],
    ["with-emoji", KusogeEffects.EMOJI],
    ["with-fractal", KusogeEffects.FRACTAL],
  ];
  classMap.forEach(([className, effect]) => {
    kusogeLayer.classList.toggle(className, effectSet.has(effect));
  });
}

function setupKusogeBackground() {
  kusogeLayer = document.getElementById("kusoge-background");
  if (!kusogeLayer) {
    return;
  }
  kusogeLayer.setAttribute("aria-hidden", "true");
  const tetLayer = kusogeLayer.querySelector(".tetromino-swarm");
  const bulletLayer = kusogeLayer.querySelector(".danmaku-field");
  const emojiLayer = kusogeLayer.querySelector(".emoji-stream");
  if (!tetLayer || !bulletLayer || !emojiLayer) {
    return;
  }

  if (tetLayer.childElementCount === 0) {
    const tetrominoClasses = [
      "piece-i",
      "piece-t",
      "piece-l",
      "piece-j",
      "piece-o",
      "piece-s",
      "piece-z",
    ];
    const tetColors = Object.values(colors).filter((value) => value !== colors[0]);
    const tetrominoCount = 22;
    for (let i = 0; i < tetrominoCount; i += 1) {
      const element = document.createElement("span");
      const pieceClass = tetrominoClasses[(Math.random() * tetrominoClasses.length) | 0];
      const color = tetColors[(Math.random() * tetColors.length) | 0];
      element.className = `tetromino ${pieceClass}`;
      element.style.setProperty("--tet-color", color);
      element.style.setProperty("--start-x", `${randRange(-25, 125).toFixed(1)}vw`);
      element.style.setProperty("--end-x", `${randRange(-25, 125).toFixed(1)}vw`);
      element.style.setProperty("--start-y", `${randRange(-20, 120).toFixed(1)}vh`);
      element.style.setProperty("--end-y", `${randRange(-20, 140).toFixed(1)}vh`);
      element.style.setProperty("--spin", `${Math.round(randRange(2, 5)) * 180}deg`);
      element.style.animationDuration = `${randRange(10, 20).toFixed(1)}s`;
      element.style.animationDelay = `${randRange(-20, 0).toFixed(1)}s`;
      tetLayer.appendChild(element);
    }
  }

  if (bulletLayer.childElementCount === 0) {
    const bulletColors = [
      "255, 40, 160",
      "80, 240, 255",
      "255, 200, 40",
      "200, 120, 255",
    ];
    const bulletCount = 38;
    for (let i = 0; i < bulletCount; i += 1) {
      const element = document.createElement("span");
      element.className = "bullet";
      element.style.setProperty(
        "--bullet-rgb",
        bulletColors[(Math.random() * bulletColors.length) | 0]
      );
      const path = createBulletPath();
      element.style.setProperty("--start-x", `${path.startX.toFixed(1)}vw`);
      element.style.setProperty("--start-y", `${path.startY.toFixed(1)}vh`);
      element.style.setProperty("--mid-x", `${path.midX.toFixed(1)}vw`);
      element.style.setProperty("--mid-y", `${path.midY.toFixed(1)}vh`);
      element.style.setProperty("--end-x", `${path.endX.toFixed(1)}vw`);
      element.style.setProperty("--end-y", `${path.endY.toFixed(1)}vh`);
      element.style.setProperty("--half-twist", `${path.halfTwist.toFixed(0)}deg`);
      element.style.setProperty("--twist", `${path.twist.toFixed(0)}deg`);
      element.style.animationDuration = `${randRange(2.8, 6.2).toFixed(1)}s`;
      element.style.animationDelay = `${randRange(-6.2, 0).toFixed(1)}s`;
      bulletLayer.appendChild(element);
    }
  }

  if (emojiLayer.childElementCount === 0) {
    const emojiChoices = [
      "💥",
      "🔥",
      "💣",
      "👾",
      "🤡",
      "🧠",
      "🚨",
      "🥴",
      "😵‍💫",
      "🍅",
      "🐙",
      "🧨",
      "☢️",
      "🌀",
      "⚡",
      "🎲",
    ];
    const emojiCount = 24;
    for (let i = 0; i < emojiCount; i += 1) {
      const element = document.createElement("span");
      const glyph = emojiChoices[(Math.random() * emojiChoices.length) | 0];
      const startY = randRange(-10, 110);
      const endY = startY + randRange(-15, 15);
      element.className = "emoji";
      element.textContent = glyph;
      element.style.setProperty("--start-y", `${startY.toFixed(1)}vh`);
      element.style.setProperty("--end-y", `${Math.max(-15, Math.min(115, endY)).toFixed(1)}vh`);
      element.style.setProperty("--emoji-scale", randRange(0.65, 1.8).toFixed(2));
      element.style.setProperty(
        "--emoji-spin",
        `${(Math.random() < 0.5 ? -1 : 1) * Math.round(randRange(90, 540))}deg`
      );
      element.style.animationDuration = `${randRange(8, 16).toFixed(1)}s`;
      element.style.animationDelay = `${randRange(-16, 0).toFixed(1)}s`;
      emojiLayer.appendChild(element);
    }
  }
}

function toggleKusogeBackground(active) {
  if (!kusogeLayer) {
    return;
  }
  const effects = active ? pickKusogeEffects() : [];
  applyKusogeEffects(effects, active);
  kusogeLayer.classList.toggle("is-active", active);
  kusogeLayer.setAttribute("aria-hidden", active ? "false" : "true");
}

function updateScoreboard(game) {
  scoreEl.textContent = game.score;
  linesEl.textContent = game.lines;
  levelEl.textContent = game.level;
  if (modeEl) {
    modeEl.textContent = isNormalMode() ? "NORMAL" : "クソゲー";
  }
  // だいたい悪くなる顔文字を回す
  if (!game.controlInverted) {
    if (isNormalMode()) {
      moodEl.textContent = normalMoods[game.level % normalMoods.length];
    } else {
      moodEl.textContent = moods[(game.level + game.lines) % moods.length];
    }
  } else {
    moodEl.textContent = "🙃";
  }
}

function applyMode(game, mode) {
  if (!body) return;
  const previous = currentMode;
  currentMode = mode;
  body.classList.remove("mode-normal", "mode-kusoge");
  body.classList.add(mode === Mode.NORMAL ? "mode-normal" : "mode-kusoge");
  toggleKusogeBackground(mode === Mode.KUSOGE);
  if (modeEl) {
    modeEl.textContent = mode === Mode.NORMAL ? "NORMAL" : "クソゲー";
  }
  if (game) {
    if (mode === Mode.NORMAL) {
      game.controlInverted = false;
      clearTimeout(game.invertTimer);
      game.invertTimer = null;
    }
    updateScoreboard(game);
  }
  if (previous !== mode && logEl) {
    if (mode === Mode.NORMAL) {
      logEvent("突然まともな雰囲気になった。今のうちに稼げ。");
    } else {
      logEvent("クソゲーモード突入。目が痛い。");
    }
  }
}

function startModeCycle(game) {
  if (modeTimer) {
    clearInterval(modeTimer);
  }
  applyMode(game, currentMode);
  modeTimer = setInterval(() => {
    const next = currentMode === Mode.NORMAL ? Mode.KUSOGE : Mode.NORMAL;
    applyMode(game, next);
  }, 5000);
}

function initGame() {
  canvas = document.getElementById("board");
  ctx = canvas ? canvas.getContext("2d") : null;
  scoreEl = document.getElementById("score");
  linesEl = document.getElementById("lines");
  levelEl = document.getElementById("level");
  moodEl = document.getElementById("mood");
  modeEl = document.getElementById("mode");
  logEl = document.getElementById("event-log");
  startBtn = document.getElementById("start-btn");
  pauseBtn = document.getElementById("pause-btn");
  body = document.body;
  setupKusogeBackground();
  toggleKusogeBackground(currentMode === Mode.KUSOGE);

  if (!canvas || !ctx || !scoreEl || !linesEl || !levelEl || !moodEl || !logEl) {
    console.error("必要な要素が見つからずゲーム初期化に失敗しました。");
    return;
  }
  if (!startBtn || !pauseBtn) {
    console.error("操作ボタンが見つからずゲーム初期化に失敗しました。");
    return;
  }

  clearBoardBackground();

  const game = new TeteGame();

  startBtn.addEventListener("click", () => {
    game.start();
    pauseBtn.textContent = "ポーズ";
    defocusActiveButton(startBtn);
  });

  pauseBtn.addEventListener("click", () => {
    if (game.running) {
      game.pause();
      pauseBtn.textContent = "再開";
    } else {
      game.resume();
      pauseBtn.textContent = "ポーズ";
    }
    defocusActiveButton(pauseBtn);
  });

  startModeCycle(game);
}

function defocusActiveButton(button) {
  if (!button) return;
  // クリック後にフォーカスが残ると Space キーでボタンが再度押されてしまう。
  // ゲーム操作を優先させるため、フォーカスを外しておく。
  if (document.activeElement === button) {
    button.blur();
  }
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initGame);
} else {
  initGame();
}
