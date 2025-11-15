// 雑なテトリス風ゲームロジック。本格的なバランスは求めない。
let canvas;
let ctx;
const scale = 24;
const cols = 10;
const rows = 20;
const BASE_DROP_INTERVAL = 800;
const MIN_DROP_INTERVAL = 200;
const DROP_INTERVAL_STEP = 60;
const LINES_PER_LEVEL = 5;

let scoreEl;
let linesEl;
let levelEl;
let highScoreEl;
let moodEl;
let modeEl;
let logEl;
let startBtn;
let pauseBtn;
let body;
let kusogeLayer;
let flashTimer = null;
let modeTimer = null;

// クソゲーモードの滞在時間をノーマルの倍にする。
const NORMAL_MODE_DURATION = 5000;
const KUSOGE_MODE_DURATION = NORMAL_MODE_DURATION * 2;

const Mode = {
  NORMAL: "normal",
  KUSOGE: "kusoge",
};

const HIGH_SCORE_KEY = "tetetetetorisu_high_score";

const ControlMode = {
  NONE: "none",
  INVERTED: "inverted",
  REROLL: "reroll",
  DOUBLE: "double",
};

const controlModePool = [
  ControlMode.INVERTED,
  ControlMode.REROLL,
  ControlMode.DOUBLE,
];

const controlModeMessages = {
  [ControlMode.INVERTED]: "操作が逆さになる",
  [ControlMode.REROLL]: "回転するたびに別ピースへ変化する",
  [ControlMode.DOUBLE]: "ボタンを押すと2回分暴発する",
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
let highScore = 0;

const startLogMessages = [
  "新しい地獄が始まった。",
  "開幕から嫌な予感しかしない。",
  "スタートボタンを押したことを後悔する時間です。",
  "雑な舞台の幕が上がった。",
  "誰も望まぬ開戦。",
  "落下の宴が始まる。",
  "トラウマ生成モード、起動。",
  "被害報告の受付を開始。",
  "操作者の理性、現在減少中。",
  "スタート処理完了。覚悟を捨てろ。",
];

const pauseLogMessages = [
  "一時停止。逃げても状況は良くならない。",
  "ゲームを止めたつもり？現実は止まらない。",
  "休憩タイム（メンタルは休まらない）。",
  "操作放棄を検出。しばらく待機。",
  "一旦中断。後で泣く。",
  "ポーズ。ここで諦め癖がつく。",
  "休んでもブロックは夢に出る。",
  "一時停止を宣言。地獄は保留中。",
  "中断。とりあえず深呼吸でも。",
  "ポーズ処理完了。逃げ場はないけど。",
];

const resumeLogMessages = [
  "再開。覚悟しろ。",
  "地獄タイム延長戦スタート。",
  "再開ボタンが火遊びの合図。",
  "休憩終了。悪夢が再装填。",
  "戻ってきたな。盤面も絶望も準備万端。",
  "再開処理完了。反省は無駄。",
  "ゲーム再開。反撃の余地は少ない。",
  "プレイ再開。さっきより酷い気がする。",
  "再開通知：理性のHPはもうゼロだ。",
  "地獄が目を覚ました。続行。",
];

const resetLogMessages = [
  "ボード初期化。",
  "記録をリセット。記憶は残る。",
  "盤面清掃。ついでに希望も削除。",
  "状態を初期化。つらさは初期値以下。",
  "ボードをリセット。悪夢は再利用可能。",
  "初期化完了。徒労のやり直し。",
  "盤面を真っさらに。心は真っ黒に。",
  "リセット動作成功。やり直し地獄をどうぞ。",
  "余計なものを全消去。虚無だけ残った。",
  "初期化完了通知：幸せのデータは見当たらない。",
];

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

function getRandomMessage(messages, fallback) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return fallback || "";
  }
  const index = (Math.random() * messages.length) | 0;
  return messages[index];
}

function loadHighScore() {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const stored = window.localStorage.getItem(HIGH_SCORE_KEY);
    const value = parseInt(stored, 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (error) {
    console.warn("ハイスコアの読み込みに失敗したので 0 扱い。", error);
    return 0;
  }
}

function saveHighScore(value) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch (error) {
    console.warn("ハイスコアの保存に失敗した。ブラウザの設定を疑え。", error);
  }
}

function rollControlMode(game, trigger = "抽選") {
  if (!game) return;
  const index = (Math.random() * controlModePool.length) | 0;
  const nextMode = controlModePool[index];
  applyControlMode(game, nextMode, trigger);
}

const controlModeTriggerLabels = {
  "mode-start": "クソゲー突入抽選",
  "mode-resume": "クソゲー再開抽選",
  lock: "着地抽選",
};

function applyControlMode(game, mode, trigger = "") {
  if (!game) return;
  const previous = game.controlMode || ControlMode.NONE;
  game.controlMode = mode;
  game.controlInverted = mode === ControlMode.INVERTED;
  game.forceRerollOnRotate = mode === ControlMode.REROLL;
  game.doubleAction = mode === ControlMode.DOUBLE;
  if (mode === ControlMode.NONE) {
    if (previous !== ControlMode.NONE) {
      logEvent("理不尽操作モードがうやむやに終了した。");
    }
  } else {
    const suffix = controlModeTriggerLabels[trigger] || trigger;
    const description = controlModeMessages[mode] || "訳の分からない不具合";
    logEvent(`理不尽操作モード: ${description}（${suffix}）`);
  }
  updateScoreboard(game);
}

class TeteGame {
  constructor() {
    this.board = createMatrix();
    this.piece = null;
    this.pos = { x: 0, y: 0 };
    this.dropCounter = 0;
    this.dropInterval = BASE_DROP_INTERVAL;
    this.lastTime = 0;
    this.running = false;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.controlInverted = false;
    this.forceRerollOnRotate = false;
    this.doubleAction = false;
    this.controlMode = ControlMode.NONE;
    this.animationId = null;
    this.bindInputs();
  }

  bindInputs() {
    document.addEventListener("keydown", (event) => {
      if (!this.running) return;
      const key = this.controlInverted ? this.invertKey(event.code) : event.code;
      switch (key) {
        case "ArrowLeft":
          this.applyAction(() => this.move(-1));
          break;
        case "ArrowRight":
          this.applyAction(() => this.move(1));
          break;
        case "ArrowDown":
          this.applyAction(() => this.softDrop());
          break;
        case "ArrowUp":
          this.applyAction(() => this.rotatePiece());
          break;
        case "Space":
          this.applyAction(() => this.hardDrop());
          break;
        default:
          break;
      }
    });
  }

  applyAction(action) {
    if (typeof action !== "function") {
      return;
    }
    action();
    if (this.doubleAction && currentMode === Mode.KUSOGE) {
      action();
    }
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
    logEvent(getRandomMessage(startLogMessages, "新しい地獄が始まった。"));
    this.update();
    startModeCycle(this);
  }

  pause() {
    if (!this.running) return;
    cancelAnimationFrame(this.animationId);
    this.running = false;
    logEvent(
      getRandomMessage(
        pauseLogMessages,
        "一時停止。逃げても状況は良くならない。"
      )
    );
    stopModeCycle();
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    this.dropCounter = 0;
    this.update();
    logEvent(getRandomMessage(resumeLogMessages, "再開。覚悟しろ。"));
    startModeCycle(this);
  }

  reset() {
    this.board = createMatrix();
    this.spawnPiece();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = BASE_DROP_INTERVAL;
    this.controlInverted = false;
    this.forceRerollOnRotate = false;
    this.doubleAction = false;
    this.controlMode = ControlMode.NONE;
    updateScoreboard(this, { skipHighScoreUpdate: true });
    clearBoardBackground();
    logEvent(getRandomMessage(resetLogMessages, "ボード初期化。"));
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
    stopModeCycle();
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
    if (this.forceRerollOnRotate && currentMode === Mode.KUSOGE) {
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
            return;
          }
          this.pos.x -= shift;
        }
        this.piece = originalPiece;
        this.pos.x = originalPos.x;
        this.pos.y = originalPos.y;
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
      if (isNormalMode()) {
        updateScoreboard(this);
      } else {
        rollControlMode(this, "lock");
      }
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
    if (isNormalMode()) {
      updateScoreboard(this);
    } else {
      rollControlMode(this, "lock");
    }
    this.dropCounter = 0;
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
    const newLevel = 1 + Math.floor(this.lines / LINES_PER_LEVEL);
    if (newLevel !== this.level) {
      this.level = newLevel;
      this.dropInterval = Math.max(
        MIN_DROP_INTERVAL,
        BASE_DROP_INTERVAL - this.level * DROP_INTERVAL_STEP
      );
      moodEl.textContent = moods[this.level % moods.length];
      const multiplier = this.getDropSpeedMultiplier();
      const linesToNext = this.getLinesToNextLevel();
      const speedNote =
        this.dropInterval === MIN_DROP_INTERVAL
          ? "落下速度が限界に到達した。"
          : `さらに ${linesToNext} ラインで加速予定。`;
      logEvent(
        `レベル ${this.level}。落下速度 ${multiplier.toFixed(1)} 倍。${speedNote}`
      );
    }
  }

  getLinesToNextLevel() {
    const nextTarget = this.level * LINES_PER_LEVEL;
    return Math.max(0, nextTarget - this.lines);
  }

  getDropSpeedMultiplier() {
    const multiplier = BASE_DROP_INTERVAL / this.dropInterval;
    return Number.isFinite(multiplier) ? Math.max(1, multiplier) : 1;
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

function updateScoreboard(game, options = {}) {
  const { skipHighScoreUpdate = false } = options;

  scoreEl.textContent = game.score;
  linesEl.textContent = game.lines;

  // レベル表示はフォーマット済みの表示を採用
  levelEl.textContent = formatLevelDisplay(game);

  // ハイスコア更新ロジックは main 側の変更を取り込む
  if (!skipHighScoreUpdate && game && game.score > highScore) {
    highScore = game.score;
    saveHighScore(highScore);
  }
  if (highScoreEl) {
    highScoreEl.textContent = highScore;
  }

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

function formatLevelDisplay(game) {
  if (!game) {
    return "?";
  }
  if (typeof game.getLinesToNextLevel !== "function") {
    return String(game.level);
  }
  if (game.dropInterval <= MIN_DROP_INTERVAL) {
    return `${game.level}（速度限界）`;
  }
  const linesToNext = game.getLinesToNextLevel();
  return `${game.level}（あと${linesToNext}ライン）`;
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
      applyControlMode(game, ControlMode.NONE);
    } else {
      const trigger = previous === Mode.KUSOGE ? "mode-resume" : "mode-start";
      rollControlMode(game, trigger);
    }
  }
  if (previous !== mode && logEl) {
    if (mode === Mode.NORMAL) {
      logEvent("突然まともな雰囲気になった。今のうちに稼げ。");
    } else {
      logEvent("クソゲーモード突入。操作も即座に捻じ曲げられる予感。");
    }
  }
}

function scheduleNextMode(game) {
  if (!game || !game.running) {
    return;
  }
  const duration =
    currentMode === Mode.KUSOGE ? KUSOGE_MODE_DURATION : NORMAL_MODE_DURATION;
  modeTimer = setTimeout(() => {
    if (!game.running) {
      return;
    }
    const next = currentMode === Mode.NORMAL ? Mode.KUSOGE : Mode.NORMAL;
    applyMode(game, next);
    scheduleNextMode(game);
  }, duration);
}

function startModeCycle(game) {
  if (!game || !game.running) {
    return;
  }
  if (modeTimer) {
    clearTimeout(modeTimer);
    modeTimer = null;
  }
  applyMode(game, currentMode);
  scheduleNextMode(game);
}

function stopModeCycle() {
  if (modeTimer) {
    clearTimeout(modeTimer);
    modeTimer = null;
  }
}

function initGame() {
  canvas = document.getElementById("board");
  ctx = canvas ? canvas.getContext("2d") : null;
  scoreEl = document.getElementById("score");
  linesEl = document.getElementById("lines");
  levelEl = document.getElementById("level");
  highScoreEl = document.getElementById("high-score");
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

  highScore = loadHighScore();
  if (highScoreEl) {
    highScoreEl.textContent = highScore;
  }

  clearBoardBackground();

  const game = new TeteGame();
  applyMode(game, Mode.NORMAL);

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

  setupTouchControls(game);
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

function setupTouchControls(game) {
  const buttons = document.querySelectorAll("[data-control]");
  if (!buttons.length) {
    return;
  }

  const actionMap = {
    left: () => game.applyAction(() => game.move(-1)),
    right: () => game.applyAction(() => game.move(1)),
    down: () => game.applyAction(() => game.softDrop()),
    rotate: () => game.applyAction(() => game.rotatePiece()),
    drop: () => game.applyAction(() => game.hardDrop()),
  };

  const invoke = (event, control) => {
    if (event) {
      event.preventDefault();
    }
    if (!game.running) {
      return;
    }
    const action = actionMap[control];
    if (action) {
      action();
    }
  };

  buttons.forEach((button) => {
    const control = button.dataset.control;
    if (!actionMap[control]) {
      return;
    }

    button.addEventListener("click", (event) => invoke(event, control));
    button.addEventListener(
      "touchstart",
      (event) => invoke(event, control),
      { passive: false }
    );
  });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initGame);
} else {
  initGame();
}
