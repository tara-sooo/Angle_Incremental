import { runtime, expose } from "../runtime/shared.js";

// Canvas drawing and resize behavior live here so the composition root only schedules frames.

function createCanvasCache() {
  return {
    layer: null,
    layerCtx: null,
    signature: "",
    width: 0,
    height: 0,
    cssHeight: 0,
    geometry: null,
    compact: false,
    buildCount: 0,
  };
}

const angleCache = createCanvasCache();
const infiniteAngleCache = createCanvasCache();

function renderVertexLimit() {
  return runtime.renderVertexLimit ? runtime.renderVertexLimit() : runtime.MAX_DRAW_VERTICES;
}

function ensureCacheLayer(cache) {
  if (cache.layer && cache.layerCtx) return true;
  if (typeof document === "undefined" || typeof document.createElement !== "function") return false;
  const layer = document.createElement("canvas");
  const layerCtx = layer.getContext?.("2d");
  if (!layerCtx) return false;
  cache.layer = layer;
  cache.layerCtx = layerCtx;
  return true;
}

function cacheMetrics(cache, canvas, rect = null, compactThreshold = 260) {
  const cssHeight = Number.isFinite(rect?.height) && rect.height > 0
    ? rect.height
    : cache.cssHeight > 0 ? cache.cssHeight : canvas.height;
  if (
    cache.width !== canvas.width
    || cache.height !== canvas.height
    || !cache.geometry
  ) {
    cache.width = canvas.width;
    cache.height = canvas.height;
    cache.geometry = canvasGeometry(canvas);
  }
  cache.cssHeight = cssHeight;
  cache.compact = cssHeight < compactThreshold;
}

function cacheSignature(cache, canvas, vertices, canDrawJapanese) {
  return [
    canvas.width,
    canvas.height,
    vertices,
    renderVertexLimit(),
    runtime.state.language,
    canDrawJapanese,
    cache.compact,
  ].join("|");
}

function canvasGeometry(canvas = runtime.canvas) {
  const width = canvas.width;
  const height = canvas.height;
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
  const drawCount = Math.min(vertices, renderVertexLimit());
  return Array.from(
    { length: drawCount },
    (_, index) => vertexPoint((index / drawCount) * vertices, vertices, geometry),
  );
}

function pointPosition(
  vertices = runtime.effectiveVertexCount(),
  geometry = canvasGeometry(),
  progress = runtime.state.pointProgress,
) {
  const edgeProgress = progress * vertices;
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

function drawBackgroundFor(ctx, canvas) {
  ctx.fillStyle = "#0b1630";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(150, 174, 231, 0.10)";
  ctx.lineWidth = 1;
  const gap = 36;
  for (let x = -canvas.height; x < canvas.width; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.lineTo(x + canvas.height, 0);
    ctx.stroke();
  }
}

function drawBackground() {
  drawBackgroundFor(runtime.ctx, runtime.canvas);
}

function drawStaticFigure(ctx, vertices, geometry, canDrawJapanese, options) {
  const points = polygonPoints(vertices, geometry);
  const corePoint = vertexPoint(0, vertices, geometry);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach((p, index) => {
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = options.polygonFill;
  ctx.fill();
  ctx.strokeStyle = options.polygonStroke;
  ctx.lineWidth = options.polygonLineWidth;
  ctx.stroke();

  points.forEach((p, index) => {
    if (vertices > renderVertexLimit() && index % 12 !== 0) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, options.vertexRadius, 0, runtime.TAU);
    ctx.fillStyle = options.vertexFill;
    ctx.fill();
  });

  ctx.beginPath();
  ctx.arc(corePoint.x, corePoint.y, options.coreRadius, 0, runtime.TAU);
  ctx.fillStyle = "#ff7659";
  ctx.fill();

  ctx.textAlign = "center";
  if (canDrawJapanese) {
    ctx.font = options.coreFont;
    ctx.fillStyle = "#eef4ff";
    ctx.fillText(runtime.t("core"), corePoint.x, corePoint.y - options.coreLabelOffset);
  }
  ctx.restore();
}

function prepareCanvas(cache, canvas, ctx, vertices, canDrawJapanese, compactThreshold, options) {
  cacheMetrics(cache, canvas, null, compactThreshold);
  const signature = cacheSignature(cache, canvas, vertices, canDrawJapanese);
  const canUseCache = ensureCacheLayer(cache);
  if (canUseCache && cache.signature !== signature) {
    cache.layer.width = canvas.width;
    cache.layer.height = canvas.height;
    cache.layerCtx.setTransform(1, 0, 0, 1, 0, 0);
    drawBackgroundFor(cache.layerCtx, cache.layer);
    drawStaticFigure(cache.layerCtx, vertices, cache.geometry, canDrawJapanese, options);
    cache.signature = signature;
    cache.buildCount += 1;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (canUseCache) {
    ctx.drawImage(cache.layer, 0, 0);
    return true;
  }
  drawBackgroundFor(ctx, canvas);
  drawStaticFigure(ctx, vertices, cache.geometry, canDrawJapanese, options);
  return false;
}

const ANGLE_STATIC_OPTIONS = Object.freeze({
  polygonFill: "rgba(84, 130, 206, 0.16)",
  polygonStroke: "#dbe7ff",
  polygonLineWidth: 5,
  vertexRadius: 5,
  vertexFill: "#55d5ee",
  coreRadius: 11,
  coreFont: "700 16px 'Noto Sans JP', sans-serif",
  coreLabelOffset: 22,
});

const INFINITE_ANGLE_STATIC_OPTIONS = Object.freeze({
  polygonFill: "rgba(124, 91, 206, 0.20)",
  polygonStroke: "#e4d8ff",
  polygonLineWidth: 4,
  vertexRadius: 4,
  vertexFill: "#c4a7ff",
  coreRadius: 10,
  coreFont: "700 14px 'Noto Sans JP', sans-serif",
  coreLabelOffset: 20,
});

function draw() {
  const vertices = runtime.effectiveVertexCount();
  const canDrawJapanese = runtime.japaneseFontReady || !document.fonts;
  prepareCanvas(
    angleCache,
    runtime.canvas,
    runtime.ctx,
    vertices,
    canDrawJapanese,
    260,
    ANGLE_STATIC_OPTIONS,
  );
  const compactCanvas = angleCache.compact;
  const geometry = angleCache.geometry;
  const point = pointPosition(vertices, geometry);

  runtime.ctx.save();
  runtime.ctx.beginPath();
  runtime.ctx.arc(point.x, point.y, 10, 0, runtime.TAU);
  runtime.ctx.fillStyle = "#f2b84b";
  runtime.ctx.fill();
  runtime.ctx.strokeStyle = "#07101f";
  runtime.ctx.lineWidth = 3;
  runtime.ctx.stroke();

  runtime.ctx.textAlign = "center";
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
  const scale = runtime.renderDevicePixelRatio ? runtime.renderDevicePixelRatio() : Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * scale));
  const height = Math.max(1, Math.floor(rect.height * scale));
  cacheMetrics(angleCache, runtime.canvas, rect, 260);
  if (runtime.canvas.width === width && runtime.canvas.height === height) {
    draw();
    return;
  }
  runtime.canvas.width = width;
  runtime.canvas.height = height;
  runtime.ctx.setTransform(1, 0, 0, 1, 0, 0);
  draw();
}

function drawInfiniteAngle() {
  const canvas = runtime.infiniteAngleCanvas;
  const ctx = runtime.infiniteAngleCtx;
  if (
    !canvas
    || !ctx
    || runtime.activeMainTab !== "infinity"
    || runtime.activeInfinitySubtab !== "angle"
  ) return;
  if (!runtime.state.infiniteAngleUnlocked) {
    cacheMetrics(infiniteAngleCache, canvas, null, 180);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackgroundFor(ctx, canvas);
    return;
  }

  const vertices = runtime.infiniteAngleVertexCount();
  const canDrawJapanese = runtime.japaneseFontReady || !document.fonts;
  prepareCanvas(
    infiniteAngleCache,
    canvas,
    ctx,
    vertices,
    canDrawJapanese,
    180,
    INFINITE_ANGLE_STATIC_OPTIONS,
  );
  const compactCanvas = infiniteAngleCache.compact;
  const geometry = infiniteAngleCache.geometry;
  const point = pointPosition(vertices, geometry, runtime.state.infiniteAnglePointProgress);

  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, 9, 0, runtime.TAU);
  ctx.fillStyle = "#f2b84b";
  ctx.fill();
  ctx.strokeStyle = "#07101f";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";

  if (!compactCanvas) {
    ctx.font = "800 24px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#d4bcff";
    ctx.fillText(runtime.formatUiLogNumber(runtime.infiniteAngleScoreGainLog10()), canvas.width / 2, canvas.height - 48);
    if (canDrawJapanese) {
      ctx.font = "700 13px 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#b9c6e4";
      ctx.fillText(runtime.t("infiniteScore"), canvas.width / 2, canvas.height - 24);
    }
  }
  ctx.restore();
}

function resizeInfiniteAngleCanvas() {
  const canvas = runtime.infiniteAngleCanvas;
  const ctx = runtime.infiniteAngleCtx;
  if (!canvas || !ctx) return;
  const rect = canvas.getBoundingClientRect();
  const scale = runtime.renderDevicePixelRatio ? runtime.renderDevicePixelRatio() : Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * scale));
  const height = Math.max(1, Math.floor(rect.height * scale));
  cacheMetrics(infiniteAngleCache, canvas, rect, 180);
  if (canvas.width === width && canvas.height === height) {
    drawInfiniteAngle();
    return;
  }
  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawInfiniteAngle();
}

function canvasCacheStats() {
  return {
    angleBuilds: angleCache.buildCount,
    infiniteAngleBuilds: infiniteAngleCache.buildCount,
  };
}
expose("vertexPoint", () => vertexPoint, (value) => { vertexPoint = value; });
expose("polygonPoints", () => polygonPoints, (value) => { polygonPoints = value; });
expose("pointPosition", () => pointPosition, (value) => { pointPosition = value; });
expose("drawBackground", () => drawBackground, (value) => { drawBackground = value; });
expose("draw", () => draw, (value) => { draw = value; });
expose("resizeCanvas", () => resizeCanvas, (value) => { resizeCanvas = value; });
expose("drawInfiniteAngle", () => drawInfiniteAngle, (value) => { drawInfiniteAngle = value; });
expose("resizeInfiniteAngleCanvas", () => resizeInfiniteAngleCanvas, (value) => { resizeInfiniteAngleCanvas = value; });
expose("canvasCacheStats", () => canvasCacheStats);
