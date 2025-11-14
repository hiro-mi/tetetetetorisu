// 雑なテトリス風ゲームロジック。本格的なバランスは求めない。
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scale = 24;
const cols = 10;
const rows = 20;

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const moodEl = document.getElementById("mood");
const logEl = document.getElementById("event-log");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");

const body = document.body;
let flashTimer = null;

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

function createMatrix() {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function rotate(matrix, dir) {
  // 転置してから左右または上下を反転
  const clone = matrix.map((row) => [...row]);
  for (let y = 0; y < clone.length; y++) {
    for (let x = 0; x < y; x++) {
      [clone[x][y], clone[y][x]] = [clone[y][x], clone[x][y]];
    }
  }
  return dir > 0
    ? clone.map((row) => row.reverse())
    : clone.reverse();
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
    this.piece = shapes[index].map((row) => [...row]);
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
    this.score -= distance * 2;
    logEvent(`勢い余って減点 ${distance * 2} 点。`);
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
    // 連続消しすると逆に損する理不尽スコア
    const base = 60;
    const penalty = (linesCleared - 1) * 80;
    const gain = Math.max(5, base - penalty);
    this.score += gain;
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
    if (Math.random() < 0.25) {
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
  const color = `rgba(${rand255()}, ${rand255()}, ${rand255()}, 0.2)`;
  body.style.background = `radial-gradient(circle, ${color}, #0d0d0d 70%)`;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(clearBoardBackground, 250);
}

function clearBoardBackground() {
  body.style.background = "#1a1a1a";
}

function rand255() {
  return (Math.random() * 255) | 0;
}

function updateScoreboard(game) {
  scoreEl.textContent = game.score;
  linesEl.textContent = game.lines;
  levelEl.textContent = game.level;
  // だいたい悪くなる顔文字を回す
  if (!game.controlInverted) {
    moodEl.textContent = moods[(game.level + game.lines) % moods.length];
  } else {
    moodEl.textContent = "🙃";
  }
}

const game = new TeteGame();

startBtn.addEventListener("click", () => {
  game.start();
  pauseBtn.textContent = "ポーズ";
});

pauseBtn.addEventListener("click", () => {
  if (game.running) {
    game.pause();
    pauseBtn.textContent = "再開";
  } else {
    game.resume();
    pauseBtn.textContent = "ポーズ";
  }
});
