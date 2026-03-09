#!/usr/bin/env node

import { chmod, cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const targets = [
  { id: "macos-aarch64", ext: "" },
  { id: "macos-x86_64", ext: "" },
  { id: "linux-x86_64", ext: "" },
  { id: "windows-x86_64", ext: ".exe" },
];

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} ${args.join(" ")} failed with exit code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

async function ensureZipAvailable() {
  try {
    await run("zip", ["-v"], repoRoot);
  } catch {
    throw new Error("zip command is required to build mock runtime archives");
  }
}

async function main() {
  await ensureZipAvailable();

  const artifactsRoot = path.join(repoRoot, "artifacts", "rapidocr");
  await rm(artifactsRoot, { recursive: true, force: true });
  await mkdir(artifactsRoot, { recursive: true });

  const descriptor = {
    version: "mock-0.1.0",
    artifacts: [],
  };

  for (const target of targets) {
    const runtimeDir = path.join(artifactsRoot, target.id, "runtime");
    const binDir = path.join(runtimeDir, "bin");
    const modelsDir = path.join(runtimeDir, "models");
    await mkdir(binDir, { recursive: true });
    await mkdir(modelsDir, { recursive: true });

    const binName = `alger-rapidocr${target.ext}`;
    const source = path.join(__dirname, "mock-runtime", "bin", "alger-rapidocr.mjs");
    const dest = path.join(binDir, binName);
    await cp(source, dest);
    await chmod(dest, 0o755);
    await writeFile(
      path.join(modelsDir, "README.txt"),
      "Mock runtime placeholder. Replace with actual OCR models in production.\n",
      "utf8",
    );

    const zipName = `rapidocr-${target.id}.zip`;
    const zipPath = path.join(artifactsRoot, target.id, zipName);
    await run("zip", ["-qr", zipPath, "bin", "models"], runtimeDir);

    descriptor.artifacts.push({
      target: target.id,
      file: path.relative(__dirname, zipPath),
      urls: [
        `http://127.0.0.1:9000/${target.id}/${zipName}`,
      ],
      executable_relpath: `bin/${binName}`,
    });
  }

  const descriptorPath = path.join(__dirname, "descriptor.mock.json");
  await writeFile(`${descriptorPath}`, `${JSON.stringify(descriptor, null, 2)}\n`, "utf8");

  console.log(`Mock runtime artifacts written to ${artifactsRoot}`);
  console.log(`Descriptor written to ${descriptorPath}`);
  console.log("Next step:");
  console.log(
    "  node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.mock.json artifacts/rapidocr/rapidocr-manifest.json",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
