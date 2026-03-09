#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function usage() {
  console.error(
    "Usage: node scripts/rapidocr/generate-manifest.mjs <descriptor.json> [output.json]",
  );
}

function normalizeUrls(urls) {
  return urls
    .map((url) => String(url).trim())
    .filter(Boolean);
}

async function sha256File(filePath) {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function main() {
  const [, , descriptorPath, outputPathArg] = process.argv;
  if (!descriptorPath) {
    usage();
    process.exit(1);
  }

  const raw = await readFile(descriptorPath, "utf8");
  const descriptor = JSON.parse(raw);
  if (!descriptor.version || !Array.isArray(descriptor.artifacts)) {
    throw new Error("Descriptor must include 'version' and 'artifacts'");
  }

  const baseDir = path.dirname(path.resolve(descriptorPath));
  const artifacts = [];

  for (const artifact of descriptor.artifacts) {
    if (!artifact.target || !artifact.file || !artifact.executable_relpath) {
      throw new Error(
        "Each artifact must include 'target', 'file', and 'executable_relpath'",
      );
    }

    const filePath = path.resolve(baseDir, artifact.file);
    const urls = normalizeUrls(artifact.urls || []);
    if (urls.length === 0) {
      throw new Error(`Artifact '${artifact.target}' must define at least one URL`);
    }

    artifacts.push({
      target: artifact.target,
      urls,
      sha256: await sha256File(filePath),
      executable_relpath: artifact.executable_relpath,
    });
  }

  const manifest = {
    version: String(descriptor.version),
    generated_at: new Date().toISOString(),
    artifacts,
  };

  const outputPath = outputPathArg
    ? path.resolve(outputPathArg)
    : path.resolve(baseDir, "rapidocr-manifest.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
