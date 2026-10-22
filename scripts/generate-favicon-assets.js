// Requires ImageMagick. The supplied source has a bad IDAT checksum; only normalize it in memory.
const { spawnSync } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { inflateRawSync } = require("node:zlib");

const root = path.resolve(__dirname, "..");
const assetDirectory = path.join(root, "assets");
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function normalizeIdatChecksum(source) {
  const png = Buffer.from(source);
  if (!png.subarray(0, 8).equals(pngSignature) || png.toString("ascii", 12, 16) !== "IHDR") throw new Error("source is not a valid PNG");
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 2 || png[28] !== 0) throw new Error("source must be a non-interlaced 8-bit RGB PNG");

  let position = 8;
  let idatStart = -1;
  let idatLength = 0;
  let idatCount = 0;
  let idatEnded = false;
  let foundEnd = false;
  while (position < png.length) {
    if (position + 12 > png.length) throw new Error("truncated PNG chunk");
    const dataLength = png.readUInt32BE(position);
    const dataStart = position + 8;
    const dataEnd = dataStart + dataLength;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > png.length) throw new Error("truncated PNG data");
    const type = png.toString("ascii", position + 4, position + 8);
    if (type === "IDAT") {
      if (idatEnded) throw new Error("PNG IDAT chunks are not consecutive");
      if (idatCount++ === 0) idatStart = dataStart;
      idatLength += dataLength;
    } else {
      if (idatCount) idatEnded = true;
      const storedCrc = png.readUInt32BE(dataEnd);
      const expectedCrc = crc32(png.subarray(position + 4, dataEnd));
      if (storedCrc !== expectedCrc) throw new Error("invalid PNG " + type + " chunk checksum");
    }
    position = chunkEnd;
    if (type === "IEND") {
      if (position !== png.length) throw new Error("unexpected bytes after PNG IEND");
      foundEnd = true;
      break;
    }
  }

  if (!foundEnd || idatCount !== 1) throw new Error("source must contain exactly one IDAT chunk and an IEND chunk");
  const zlibData = png.subarray(idatStart, idatStart + idatLength);
  if (zlibData.length < 6) throw new Error("PNG IDAT stream is too short");
  const scanlines = inflateRawSync(zlibData.subarray(2, zlibData.length - 4));
  if (scanlines.length !== height * (width * 3 + 1)) throw new Error("PNG scanline data does not match its dimensions");

  let low = 1;
  let high = 0;
  for (const byte of scanlines) {
    low = (low + byte) % 65521;
    high = (high + low) % 65521;
  }
  png.writeUInt32BE(((high << 16) | low) >>> 0, idatStart + idatLength - 4);
  return png;
}

const sourcePath = path.join(assetDirectory, "angle-incremental-icon.png");
const normalizedSource = normalizeIdatChecksum(readFileSync(sourcePath));
for (const size of [32, 64, 180]) {
  const dimension = size + "x" + size;
  const result = spawnSync("magick", [
    "-define", "png:ignore-crc=true", "png:-",
    "-resize", dimension, "-background", "none", "-gravity", "center", "-extent", dimension,
    "-define", "png:exclude-chunk=date,tIME,tEXt,zTXt", "png:-",
  ], { input: normalizedSource });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.toString("utf8") || "ImageMagick favicon generation failed");
  if (!result.stdout.subarray(0, 8).equals(pngSignature)) throw new Error("ImageMagick did not return a PNG");
  writeFileSync(path.join(assetDirectory, "angle-incremental-icon-" + size + ".png"), result.stdout);
}
