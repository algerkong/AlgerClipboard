#!/usr/bin/env node

import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const KNOWN_ARTIFACTS = [
  {
    target: "macos-aarch64",
    relativeZip: "macos-aarch64/rapidocr-macos-aarch64.zip",
    executableRelpath: "bin/alger-rapidocr",
  },
  {
    target: "macos-x86_64",
    relativeZip: "macos-x86_64/rapidocr-macos-x86_64.zip",
    executableRelpath: "bin/alger-rapidocr",
  },
  {
    target: "linux-x86_64",
    relativeZip: "linux-x86_64/rapidocr-linux-x86_64.zip",
    executableRelpath: "bin/alger-rapidocr",
  },
  {
    target: "linux-aarch64",
    relativeZip: "linux-aarch64/rapidocr-linux-aarch64.zip",
    executableRelpath: "bin/alger-rapidocr",
  },
  {
    target: "windows-x86_64",
    relativeZip: "windows-x86_64/rapidocr-windows-x86_64.zip",
    executableRelpath: "bin/alger-rapidocr.exe",
  },
  {
    target: "windows-aarch64",
    relativeZip: "windows-aarch64/rapidocr-windows-aarch64.zip",
    executableRelpath: "bin/alger-rapidocr.exe",
  },
];

function usage() {
  console.error(
    "Usage: node scripts/rapidocr/generate-release-descriptor.mjs --version <version> --base-url <url> [--artifacts-root <dir>] [--output <file>]",
  );
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--") || value == null) {
      continue;
    }
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = args.version;
  const baseUrl = args["base-url"];
  const artifactsRoot = path.resolve(args["artifacts-root"] ?? "artifacts/rapidocr-real");
  const outputPath = path.resolve(
    args.output ?? path.join(artifactsRoot, "descriptor.release.json"),
  );

  if (!version || !baseUrl) {
    usage();
    process.exit(1);
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const descriptor = {
    version,
    artifacts: [],
  };

  for (const artifact of KNOWN_ARTIFACTS) {
    const filePath = path.join(artifactsRoot, artifact.relativeZip);
    if (!(await fileExists(filePath))) {
      continue;
    }

    descriptor.artifacts.push({
      target: artifact.target,
      file: filePath,
      urls: [`${normalizedBaseUrl}/${path.basename(filePath)}`],
      executable_relpath: artifact.executableRelpath,
    });
  }

  if (descriptor.artifacts.length === 0) {
    throw new Error(`No RapidOCR artifacts found under ${artifactsRoot}`);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(descriptor, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
