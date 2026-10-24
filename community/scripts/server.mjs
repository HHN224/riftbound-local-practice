import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import readline from "node:readline";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.FUXUAN_PORT || 4174);
const sessions = new Map();
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "mobile/app.manifest"), "utf8"),
);
const assetPaths = new Map(
  manifest.assets.map((asset) => {
    const folder = asset.subdirectory.includes("card-images-compressed")
      ? "card-images"
      : asset.subdirectory.includes("cardbacks")
        ? "cardbacks"
        : "media";
    return [
      `${asset.name}.${asset.packagerHash}.${asset.type}`,
      `/${folder}/${asset.name}.${asset.type}`,
    ];
  }),
);
const allowed = new Set([
  "initGame",
  "clientMessage",
  "turnBannerComplete",
  "initSandbox",
  "validateSandboxDraft",
  "reviewControl",
  "stopLocalSession",
  "leaveMatch",
  "catalog",
]);
function session() {
  const id = crypto.randomUUID();
  const subscribers = new Set();
  let seq = 0;
  const child = spawn(
    path.join(root, "engine/bin/hermes-fuxuan.exe"),
    ["engine/bootstrap.js", "generated/rules.hbc", "engine/session.js"],
    { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  const pending = new Map();
  let resolveReady, rejectReady;
  const ready = new Promise((r, j) => {
    resolveReady = r;
    rejectReady = j;
  });
  const started = setTimeout(() => {
    rejectReady(Error("Local engine startup timed out"));
    child.kill();
  }, 15000);
  // A navigation can cancel session creation before the event stream connects.
  const abandoned = setTimeout(() => {
    if (!subscribers.size) child.kill();
  }, 30000);
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.kind === "ready") {
      clearTimeout(started);
      resolveReady();
    }
    if (msg.kind === "event") {
      for (const res of subscribers)
        res.write("data: " + JSON.stringify(msg.message) + "\n\n");
    }
    if (msg.kind === "reply") {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        clearTimeout(p.timer);
        msg.ok ? p.resolve(msg.result) : p.reject(Error(msg.error));
      }
    }
  });
  child.stderr.on("data", (data) =>
    console.error("[engine]", data.toString().slice(0, 2000)),
  );
  const tick = setInterval(() => {
    if (!child.killed && child.stdin.writable)
      child.stdin.write('{"event":"tick"}\n');
  }, 30);
  const fail = (error) => {
    clearInterval(tick);
    clearTimeout(started);
    clearTimeout(abandoned);
    rejectReady(error);
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    pending.clear();
    for (const res of subscribers) {
      res.write(
        "event: engineError\ndata: " +
          JSON.stringify({ error: error.message }) +
          "\n\n",
      );
      res.end();
    }
    sessions.delete(id);
  };
  child.on("error", fail);
  child.on("exit", (code) => fail(Error("Engine stopped: " + code)));
  child.stdin.on("error", () => {});
  const value = {
    id,
    ready,
    subscribers,
    child,
    command: async (event, payload) => {
      await ready;
      return new Promise((resolve, reject) => {
        const n = ++seq;
        const timer = setTimeout(() => {
          pending.delete(n);
          reject(Error("Engine response timed out"));
        }, 60000);
        pending.set(n, { resolve, reject, timer });
        child.stdin.write(JSON.stringify({ id: n, event, payload }) + "\n");
      });
    },
  };
  sessions.set(id, value);
  return value;
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".webmanifest": "application/manifest+json",
};
function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:" + port);
    if (
      req.headers.origin &&
      !["http://127.0.0.1:" + port, "http://localhost:" + port].includes(
        req.headers.origin,
      )
    )
      return json(res, 403, { error: "Local origin required" });
    if (url.pathname === "/local-api/status")
      return json(res, 200, { source: "Fuxuan APK local Hermes engine", port });
    if (url.pathname === "/api/mobile-release")
      return json(res, 200, {
        schemaVersion: 1,
        accountSystemEnabled: false,
        android: { retiredRuntimeVersions: [], message: "本地 APK 规则版本" },
      });
    if (url.pathname === "/local-api/session" && req.method === "POST") {
      const s = session();
      await s.ready;
      return json(res, 200, { id: s.id });
    }
    if (url.pathname.startsWith("/local-api/")) {
      const s = sessions.get(url.searchParams.get("session"));
      if (!s) return json(res, 404, { error: "Unknown session" });
      if (url.pathname === "/local-api/events" && req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(": connected\n\n");
        s.subscribers.add(res);
        req.on("close", () => {
          s.subscribers.delete(res);
          setTimeout(() => {
            if (!s.subscribers.size) s.child.kill();
          }, 5000);
        });
        return;
      }
      if (url.pathname === "/local-api/command" && req.method === "POST") {
        let body = "";
        for await (const part of req) {
          body += part;
          if (body.length > 1024 * 1024) throw Error("Request too large");
        }
        const { event, payload } = JSON.parse(body);
        if (!allowed.has(event))
          return json(res, 400, { error: "Unsupported command" });
        const result = await s.command(event, payload);
        return json(res, 200, { ok: true, result });
      }
      return json(res, 404, { error: "Unknown endpoint" });
    }
    if (url.pathname === "/") {
      res.writeHead(302, { Location: "/fuxuan/" });
      return res.end();
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith("/fuxuan/assets/")) {
      pathname = assetPaths.get(path.posix.basename(pathname)) || pathname;
    }
    const base = pathname.startsWith("/fuxuan/")
      ? path.join(root, "upstream")
      : path.join(root, "public");
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.resolve(base, "." + pathname);
    if (!file.startsWith(base + path.sep))
      return json(res, 403, { error: "Invalid path" });
    let data = await fs.readFile(file);
    if (pathname === "/fuxuan/index.html") {
      let html = data.toString();
      const match = html.match(
        /<script src="[^"]*__expo-metro-runtime[^\"]*" defer><\/script>/,
      );
      if (!match) throw Error("Upstream runtime anchor changed");
      html = html.replace(
        match[0],
        match[0] + '<script src="/local/bridge.js" defer></script>',
      );
      data = Buffer.from(html);
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Content-Security-Policy":
        "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:",
    });
    res.end(data);
  } catch (e) {
    json(res, e.code === "ENOENT" ? 404 : 500, { error: e.message });
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log("Fuxuan local: http://127.0.0.1:" + port),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    for (const s of sessions.values()) s.child.kill();
    server.close(() => process.exit());
  });
