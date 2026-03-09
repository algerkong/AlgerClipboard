#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = [...argv];
  const inputIndex = args.indexOf("--input");
  if (inputIndex === -1 || !args[inputIndex + 1]) {
    fail("usage: alger-rapidocr --input <image_path>");
  }
  return {
    input: args[inputIndex + 1],
  };
}

function readPngSize(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegSize(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }

  return null;
}

async function readImageSize(filePath) {
  const data = await readFile(filePath);
  return readPngSize(data) ?? readJpegSize(data) ?? { width: 0, height: 0 };
}

async function main() {
  const { input } = parseArgs(process.argv.slice(2));
  const { width, height } = await readImageSize(input);
  const base = path.basename(input);

  const result = {
    lines: [
      {
        text: `Mock OCR result for ${base}`,
        x: 0.08,
        y: 0.1,
        width: 0.72,
        height: 0.08,
      },
      {
        text: "Replace this runtime with a real RapidOCR build for production.",
        x: 0.08,
        y: 0.22,
        width: 0.84,
        height: 0.08,
      },
    ],
    image_width: width,
    image_height: height,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
