const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const elements = {
  scoreValue: document.getElementById("scoreValue"),
  gainValue: document.getElementById("gainValue"),
  vertexGainValue: document.getElementById("vertexGainValue"),
  lapValue: document.getElementById("lapValue"),
  generationStatus: document.getElementById("generationStatus"),
  generationCount: document.getElementById("generationCount"),
  generationMultiplier: document.getElementById("generationMultiplier"),
  generationCostFactor: document.getElementById("generationCostFactor"),
  generationButton: document.getElementById("generationButton"),
  speedUpgrade: document.getElementById("speedUpgrade"),
  vertexUpgrade: document.getElementById("vertexUpgrade"),
  gainUpgrade: document.getElementById("gainUpgrade"),
  speedLevel: document.getElementById("speedLevel"),
  vertexCount: document.getElementById("vertexCount"),
  gainLevel: document.getElementById("gainLevel"),
  speedCost: document.getElementById("speedCost"),
  vertexCost: document.getElementById("vertexCost"),
  gainCost: document.getElementById("gainCost"),
};

const BASE_LAP_SECONDS = 6;
const GENERATION_UNLOCK_SCORE = 1_000_000;
const TAU = Math.PI * 2;

const state = {
  score: 0,
  totalScore: 0,
  generationScore: 0,
  vertices: 3,
  speedLevel: 0,
  gainLevel: 0,
  currentGain: 1,
  pointProgress: 0,
  lastVertexIndex: 0,
  generationCount: 0,
  generationScoreMultiplier: 1,
  generationCostFactor: 1,
  floatingTexts: [],
  lastEarned: 0,
};

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  if (value < 1000) return value.toFixed(value < 10 ? 2 : 0).replace(/\.00$/, "");
  if (value < 1_000_000) return Math.floor(value).toLocaleString("en-US");
  const units = ["M", "B", "T", "Qa", "Qi", "Sx"];
  let scaled = value;
  let unitIndex = -1;
  while (scaled >= 1000 && unitIndex < units.length - 1) {
    scaled /= 1000;
    unitIndex += 1;
  }
  return `${scaled.toFixed(scaled >= 100 ? 1 : 2)}${units[unitIndex]}`;
}

function formatGainExpression(value) {
  const parts = Math.min(Math.floor(Math.sqrt(state.vertices)), 10);
  if (parts <= 1) return formatNumber(value);
  const factor = Math.pow(Math.max(value, 1), 1 / parts);
  return Array.from({ length: parts }, () => formatNumber(factor)).join(" x ");
}

function lapSpeedMultiplier() {
  return Math.pow(1.22, state.speedLevel);
}

function lapDuration() {
  return BASE_LAP_SECONDS / lapSpeedMultiplier();
}

function vertexGainIncrease() {
  return 0.01 + state.gainLevel * 0.01;
}

function cost(base, level, growth) {
  return Math.ceil(base * Math.pow(growth, level) * state.generationCostFactor);
}

function costs() {
  return {
    speed: cost(5, state.speedLevel, 1.55),
    vertex: cost(12, state.vertices - 3, 1.72),
    gain: cost(18, state.gainLevel, 1.68),
  };
}

function addScore(amount) {
  state.score += amount;
  state.totalScore += amount;
  state.generationScore += amount;
  state.lastEarned = amount;
}

function passVertex(index) {
  state.currentGain += vertexGainIncrease();
  if (index === 0) {
    const earned = state.currentGain * state.generationScoreMultiplier;
    addScore(earned);
    state.floatingTexts.push({
      text: `+${formatNumber(earned)}`,
      life: 1,
      x: canvas.width / 2,
      y: canvas.height * 0.16,
    });
  }
}

function update(dt) {
  const previousProgress = state.pointProgress;
  state.pointProgress = (state.pointProgress + dt / lapDuration()) % 1;

  const previousAbsolute = previousProgress * state.vertices;
  let currentAbsolute = state.pointProgress * state.vertices;
  if (state.pointProgress < previousProgress) currentAbsolute += state.vertices;

  const start = Math.floor(previousAbsolute) + 1;
  const end = Math.floor(currentAbsolute);
  for (let vertex = start; vertex <= end; vertex += 1) {
    passVertex(vertex % state.vertices);
  }

  state.lastVertexIndex = Math.floor(state.pointProgress * state.vertices) % state.vertices;
  state.floatingTexts = state.floatingTexts
    .map((item) => ({ ...item, life: item.life - dt, y: item.y - dt * 26 }))
    .filter((item) => item.life > 0);
}

function polygonPoints() {
  const size = Math.min(canvas.width, canvas.height);
  const radius = size * 0.31;
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.54;
  return Array.from({ length: state.vertices }, (_, index) => {
    const angle = -Math.PI / 2 + (index / state.vertices) * TAU;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      angle,
    };
  });
}

function pointPosition(points) {
  const edgeProgress = state.pointProgress * state.vertices;
  const fromIndex = Math.floor(edgeProgress) % state.vertices;
  const toIndex = (fromIndex + 1) % state.vertices;
  const local = edgeProgress - Math.floor(edgeProgress);
  const from = points[fromIndex];
  const to = points[toIndex];
  return {
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local,
  };
}

function drawBackground() {
  ctx.fillStyle = "#fbfaf5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(24, 33, 31, 0.08)";
  ctx.lineWidth = 1;
  const gap = 36;
  for (let x = -canvas.height; x < canvas.width; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.lineTo(x + canvas.height, 0);
    ctx.stroke();
  }
}

function draw() {
  drawBackground();
  const points = polygonPoints();
  const point = pointPosition(points);

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach((p, index) => {
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(46, 111, 143, 0.07)";
  ctx.fill();
  ctx.strokeStyle = "#18211f";
  ctx.lineWidth = 5;
  ctx.stroke();

  points.forEach((p, index) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, index === 0 ? 11 : 7, 0, TAU);
    ctx.fillStyle = index === 0 ? "#d64f38" : "#2e6f8f";
    ctx.fill();
  });

  ctx.beginPath();
  ctx.arc(point.x, point.y, 10, 0, TAU);
  ctx.fillStyle = "#f2b84b";
  ctx.fill();
  ctx.strokeStyle = "#18211f";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = "700 16px Inter, sans-serif";
  ctx.fillStyle = "#18211f";
  ctx.textAlign = "center";
  ctx.fillText("CORE", points[0].x, points[0].y - 22);

  ctx.font = "800 28px Inter, sans-serif";
  ctx.fillStyle = "#b73527";
  ctx.fillText(formatGainExpression(state.currentGain), canvas.width / 2, canvas.height - 58);

  ctx.font = "700 15px Inter, sans-serif";
  ctx.fillStyle = "#66716d";
  ctx.fillText("current gain expression", canvas.width / 2, canvas.height - 32);

  state.floatingTexts.forEach((item) => {
    ctx.globalAlpha = Math.max(item.life, 0);
    ctx.font = "900 24px Inter, sans-serif";
    ctx.fillStyle = "#d64f38";
    ctx.fillText(item.text, item.x, item.y);
    ctx.globalAlpha = 1;
  });

  ctx.restore();
}

function updateUi() {
  const currentCosts = costs();
  elements.scoreValue.textContent = formatNumber(state.score);
  elements.gainValue.textContent = formatGainExpression(state.currentGain * state.generationScoreMultiplier);
  elements.vertexGainValue.textContent = `+${vertexGainIncrease().toFixed(2)}`;
  elements.lapValue.textContent = `${lapDuration().toFixed(2)}s`;
  elements.speedLevel.textContent = `Lv.${state.speedLevel}`;
  elements.vertexCount.textContent = `${state.vertices} vertices`;
  elements.gainLevel.textContent = `Lv.${state.gainLevel}`;
  elements.speedCost.textContent = `Cost ${formatNumber(currentCosts.speed)}`;
  elements.vertexCost.textContent = `Cost ${formatNumber(currentCosts.vertex)}`;
  elements.gainCost.textContent = `Cost ${formatNumber(currentCosts.gain)}`;
  elements.speedUpgrade.disabled = state.score < currentCosts.speed;
  elements.vertexUpgrade.disabled = state.score < currentCosts.vertex;
  elements.gainUpgrade.disabled = state.score < currentCosts.gain;

  const unlocked = state.totalScore >= GENERATION_UNLOCK_SCORE;
  elements.generationStatus.textContent = unlocked ? "Generation ready" : "Generation locked";
  elements.generationButton.disabled = !unlocked || state.generationScore < GENERATION_UNLOCK_SCORE;
  elements.generationCount.textContent = String(state.generationCount);
  elements.generationMultiplier.textContent = `x${state.generationScoreMultiplier.toFixed(2)}`;
  elements.generationCostFactor.textContent = `x${state.generationCostFactor.toFixed(2)}`;
}

function spend(amount) {
  if (state.score < amount) return false;
  state.score -= amount;
  return true;
}

function buySpeed() {
  const price = costs().speed;
  if (!spend(price)) return;
  state.speedLevel += 1;
  updateUi();
}

function buyVertex() {
  const price = costs().vertex;
  if (!spend(price)) return;
  state.vertices += 1;
  state.pointProgress = 0;
  state.lastVertexIndex = 0;
  updateUi();
}

function buyGain() {
  const price = costs().gain;
  if (!spend(price)) return;
  state.gainLevel += 1;
  updateUi();
}

function runGeneration() {
  if (state.generationScore < GENERATION_UNLOCK_SCORE) return;

  const earnedPower = Math.sqrt(state.generationScore / GENERATION_UNLOCK_SCORE);
  state.generationCount += 1;
  state.generationScoreMultiplier += earnedPower * 0.5;
  state.generationCostFactor = Math.max(0.25, state.generationCostFactor * (1 - Math.min(0.35, earnedPower * 0.08)));

  state.score = 0;
  state.generationScore = 0;
  state.vertices = 3;
  state.speedLevel = 0;
  state.gainLevel = 0;
  state.currentGain = 1;
  state.pointProgress = 0;
  state.lastVertexIndex = 0;
  state.floatingTexts = [];
  updateUi();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(640, Math.floor(rect.width * scale));
  canvas.height = Math.max(420, Math.floor(rect.height * scale));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  draw();
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.08);
  lastTime = now;
  update(dt);
  updateUi();
  draw();
  requestAnimationFrame(frame);
}

function renderGameToText() {
  const points = polygonPoints();
  const point = pointPosition(points);
  return JSON.stringify({
    coordinateSystem: "canvas pixels, origin top-left, x right, y down",
    score: Number(state.score.toFixed(2)),
    totalScore: Number(state.totalScore.toFixed(2)),
    generationScore: Number(state.generationScore.toFixed(2)),
    currentGain: Number(state.currentGain.toFixed(2)),
    finalGainOnCore: Number((state.currentGain * state.generationScoreMultiplier).toFixed(2)),
    vertices: state.vertices,
    lapSeconds: Number(lapDuration().toFixed(2)),
    point: { x: Number(point.x.toFixed(1)), y: Number(point.y.toFixed(1)), progress: Number(state.pointProgress.toFixed(3)) },
    core: { x: Number(points[0].x.toFixed(1)), y: Number(points[0].y.toFixed(1)) },
    upgrades: {
      speedLevel: state.speedLevel,
      gainLevel: state.gainLevel,
      costs: costs(),
    },
    generation: {
      unlocked: state.totalScore >= GENERATION_UNLOCK_SCORE,
      canGenerate: state.generationScore >= GENERATION_UNLOCK_SCORE,
      count: state.generationCount,
      scoreMultiplier: Number(state.generationScoreMultiplier.toFixed(2)),
      costFactor: Number(state.generationCostFactor.toFixed(2)),
    },
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  updateUi();
  draw();
};
window.__angleDebug = {
  state,
  addScore,
  runGeneration,
};

elements.speedUpgrade.addEventListener("click", buySpeed);
elements.vertexUpgrade.addEventListener("click", buyVertex);
elements.gainUpgrade.addEventListener("click", buyGain);
elements.generationButton.addEventListener("click", runGeneration);
window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "f") {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
});

resizeCanvas();
updateUi();
requestAnimationFrame(frame);
