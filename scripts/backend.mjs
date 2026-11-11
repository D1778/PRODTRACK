// Runs a Go command inside ./backend (default: `go run .`).
// Finds Go even if it isn't on PATH yet (e.g. VS Code opened before Go was installed).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = join(dirname(fileURLToPath(import.meta.url)), "..", "backend");
const args = process.argv.slice(2).length ? process.argv.slice(2) : ["run", "."];

function findGo() {
  const onPath = spawnSync("go", ["version"], { stdio: "ignore", shell: false });
  if (!onPath.error && onPath.status === 0) return "go";
  const candidates = [
    process.env.GOROOT && join(process.env.GOROOT, "bin", "go.exe"),
    "C:\\Program Files\\Go\\bin\\go.exe",
    "C:\\Go\\bin\\go.exe",
    "/usr/local/go/bin/go",
    "/opt/homebrew/bin/go",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

const go = findGo();
if (!go) {
  console.error("Go was not found. Install it from https://go.dev/dl and restart your terminal/VS Code.");
  process.exit(1);
}

const result = spawnSync(go, args, { cwd: backendDir, stdio: "inherit" });
if (result.error) {
  console.error(`Failed to start Go: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
