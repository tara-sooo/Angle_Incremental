import { runtime, expose } from "../runtime/shared.js";

// Canvas drawing and resize behavior live here so the composition root only schedules frames.

function canvasGeometry() {
  const width = runtime.canvas.width;
  const height = runtime.canvas.height;
  const size = Math.min(width, height);
  return {
    radius: size * 0.31,
    cx: width / 2,
    cy: height * 0.54,
  };
}

function vertexPoint(index, total = runtime.effectiveVertexCount(), geometry = canvasGeometry()) {
  const angle = -Math.PI / 2 + (index / total) * runtime.TAU;
  return {
    x: geometry.cx + Math.cos(angle) * geometry.radius,
    y: geometry.cy + Math.sin(angle) * geometry.radius,
    angle,
  };
}

function polygonPoints(vertices = runtime.effectiveVertexCount(), geometry = canvasGeometry()) {
  const drawCount = Math.min(vertices, runtime.MAX_DRAW_VERTICES);
  return Array.from(
    { length: drawCount },
    (_, index) => vertexPoint((index / drawCount) * vertices, vertices, geometry),
  );
}

function pointPosition(vertices = runtime.effectiveVertexCount(), geometry = canvasGeometry()) {
  const edgeProgress = runtime.state.pointProgress * vertices;
  const fromIndex = Math.floor(edgeProgress) % vertices;
  const toIndex = (fromIndex + 1) % vertices;
  const local = edgeProgress - Math.floor(edgeProgress);
  const from = vertexPoint(fromIndex, vertices, geometry);
  const to = vertexPoint(toIndex, vertices, geometry);
  return {
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local,
  };
}

function drawBackground() {
  runtime.ctx.fillStyle = "#0b1630";
  runtime.ctx.fillRect(0, 0, runtime.canvas.width, runtime.canvas.height);

  runtime.ctx.strokeStyle = "rgba(150, 174, 231, 0.10)";
  runtime.ctx.lineWidth = 1;
  const gap = 36;
  for (let x = -runtime.canvas.height; x < runtime.canvas.width; x += gap) {
    runtime.ctx.beginPath();
    runtime.ctx.moveTo(x, runtime.canvas.height);
    runtime.ctx.lineTo(x + runtime.canvas.height, 0);
    runtime.ctx.stroke();
  }
}

function draw() {
  drawBackground();
  const vertices = runtime.effectiveVertexCount();
  const geometry = canvasGeometry();
  const points = polygonPoints(vertices, geometry);
  const point = pointPosition(vertices, geometry);
  const corePoint = vertexPoint(0, vertices, geometry);
  const canDrawJapanese = runtime.japaneseFontReady || !document.fonts;
  const compactCanvas = runtime.canvas.getBoundingClientRect().height < 260;

  runtime.ctx.save();
  runtime.ctx.lineJoin = "round";
  runtime.ctx.lineCap = "round";
  runtime.ctx.beginPath();
  points.forEach((p, index) => {
    if (index === 0) runtime.ctx.moveTo(p.x, p.y);
    else runtime.ctx.lineTo(p.x, p.y);
  });
  runtime.ctx.closePath();
  runtime.ctx.fillStyle = "rgba(84, 130, 206, 0.16)";
  runtime.ctx.fill();
  runtime.ctx.strokeStyle = "#dbe7ff";
  runtime.ctx.lineWidth = 5;
  runtime.ctx.stroke();

  points.forEach((p, index) => {
    if (vertices > runtime.MAX_DRAW_VERTICES && index % 12 !== 0) return;
    runtime.ctx.beginPath();
    runtime.ctx.arc(p.x, p.y, 5, 0, runtime.TAU);
    runtime.ctx.fillStyle = "#55d5ee";
    runtime.ctx.fill();
  });

  runtime.ctx.beginPath();
  runtime.ctx.arc(corePoint.x, corePoint.y, 11, 0, runtime.TAU);
  runtime.ctx.fillStyle = "#ff7659";
  runtime.ctx.fill();

  runtime.ctx.beginPath();
  runtime.ctx.arc(point.x, point.y, 10, 0, runtime.TAU);
  runtime.ctx.fillStyle = "#f2b84b";
  runtime.ctx.fill();
  runtime.ctx.strokeStyle = "#07101f";
  runtime.ctx.lineWidth = 3;
  runtime.ctx.stroke();

  runtime.ctx.textAlign = "center";
  if (canDrawJapanese) {
    runtime.ctx.font = "700 16px 'Noto Sans JP', sans-serif";
    runtime.ctx.fillStyle = "#eef4ff";
    runtime.ctx.fillText(runtime.t("core"), corePoint.x, corePoint.y - 22);
  }

  if (!compactCanvas) {
    runtime.ctx.font = "800 28px 'Noto Sans JP', sans-serif";
    runtime.ctx.fillStyle = "#f2b84b";
    runtime.ctx.fillText(runtime.formatUiLogNumber(runtime.finalScoreGainLog10()), runtime.canvas.width / 2, runtime.canvas.height - 68);

    if (canDrawJapanese) {
      runtime.ctx.font = "700 15px 'Noto Sans JP', sans-serif";
      runtime.ctx.fillStyle = "#b9c6e4";
      runtime.ctx.fillText(runtime.t("currentGain"), runtime.canvas.width / 2, runtime.canvas.height - 42);
      if (runtime.hasMultiplicativeGainExpression()) {
        runtime.ctx.font = "700 13px 'Noto Sans JP', sans-serif";
        runtime.ctx.fillText(`${runtime.t("baseExpression")}: ${runtime.formatGainExpressionSummary()}`, runtime.canvas.width / 2, runtime.canvas.height - 20);
      }
    }
  }

  runtime.state.floatingTexts.forEach((item) => {
    runtime.ctx.globalAlpha = Math.max(item.life, 0);
    runtime.ctx.font = "900 24px 'Noto Sans JP', sans-serif";
    runtime.ctx.fillStyle = "#ff7659";
    runtime.ctx.fillText(item.text, item.x, item.y);
    runtime.ctx.globalAlpha = 1;
  });

  runtime.ctx.restore();
}

function resizeCanvas() {
  const rect = runtime.canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * scale));
  const height = Math.max(1, Math.floor(rect.height * scale));
  if (runtime.canvas.width === width && runtime.canvas.height === height) {
    draw();
    return;
  }
  runtime.canvas.width = width;
  runtime.canvas.height = height;
  runtime.ctx.setTransform(1, 0, 0, 1, 0, 0);
  draw();
}
expose("vertexPoint", () => vertexPoint, (value) => { vertexPoint = value; });
expose("polygonPoints", () => polygonPoints, (value) => { polygonPoints = value; });
expose("pointPosition", () => pointPosition, (value) => { pointPosition = value; });
expose("drawBackground", () => drawBackground, (value) => { drawBackground = value; });
expose("draw", () => draw, (value) => { draw = value; });
expose("resizeCanvas", () => resizeCanvas, (value) => { resizeCanvas = value; });
