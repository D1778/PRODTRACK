// Vite plugin: starting the frontend (vite / vite preview) also starts the Go
// backend in ./backend, and stopping the frontend stops it again.
//  - If a backend already answers on BACKEND_URL, it is reused (nothing started).
//  - The backend is compiled first (go build), then the binary is run directly so
//    it can be stopped reliably on every OS.
//  - Set PRODTRACK_NO_BACKEND=1 to start only the frontend.
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = join(root, "backend");
const exe = join(backendDir, process.platform === "win32" ? "prodtrack-backend.exe" : "prodtrack-backend");

const color = (s) => `\x1b[34m${s}\x1b[0m`;
const tag = color("[api]");

function pipe(stream, out) {
  let buf = "";
  stream.on("data", (chunk) => {
    buf += chunk;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) if (line.trim()) out.write(`${tag} ${line}\n`);
  });
}

async function isUp(url) {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.status < 500 || res.status === 503; // 503 = server up, DB unreachable
  } catch {
    return false;
  }
}

function run(cmd, args, opts) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    pipe(child.stdout, process.stdout);
    pipe(child.stderr, process.stderr);
    child.on("error", (err) => {
      process.stderr.write(`${tag} ${err.message}\n`);
      resolve(1);
    });
    child.on("close", resolve);
  });
}

export default function backendPlugin({ url = "http://localhost:8080" } = {}) {
  let child = null;
  let stopping = false;

  const stop = () => {
    stopping = true;
    if (child && child.exitCode === null) child.kill();
    child = null;
  };

  const start = async () => {
    if (process.env.PRODTRACK_NO_BACKEND === "1") return;
    if (await isUp(url)) {
      console.log(`${tag} Using the backend already running at ${url}`);
      return;
    }

    console.log(`${tag} Building the Go backend…`);
    const code = await run(process.execPath, [join(root, "scripts", "backend.mjs"), "build", "-o", exe, "."], { cwd: root });
    if (code !== 0) {
      console.error(`${tag} Backend build failed - the frontend will run without it. Fix the error above and restart.`);
      return;
    }
    if (stopping) return;

    const port = new URL(url).port || "8080";
    child = spawn(exe, [], {
      cwd: backendDir, // so backend/.env is picked up
      env: { ...process.env, PORT: port, PRODTRACK_EXIT_WITH_PARENT: "1" },
      stdio: ["pipe", "pipe", "pipe"], // backend exits when this stdin pipe closes
    });
    pipe(child.stdout, process.stdout);
    pipe(child.stderr, process.stderr);
    child.on("exit", (code) => {
      if (!stopping) console.error(`${tag} Backend stopped (exit code ${code}). Restart the dev server to start it again.`);
    });

    for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(sig, () => { stop(); process.exit(0); });
    process.once("exit", stop);
  };

  const attach = (server) => {
    start();
    server.httpServer?.once("close", stop);
  };

  return {
    name: "prodtrack-backend",
    apply: (_config, env) => env.command === "serve", // never during `vite build`
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
