const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

function safeFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const relative = clean === "/" ? "index.html" : clean.replace(/^\/+/, "");
  const file = path.normalize(path.join(PUBLIC, relative));
  return file.startsWith(PUBLIC + path.sep) || file === path.join(PUBLIC, "index.html") ? file : null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // These routes prevent the front end from receiving a 404.
  // Connect your real OTP/payment provider here before production use.
  if (req.method === "POST" && url.pathname === "/api/otp/request") {
    return sendJson(res, 503, {
      ok: false,
      message: "OTP service is not configured yet. Add your OTP provider credentials to the server before using phone verification."
    });
  }

  if (req.method === "POST" && url.pathname === "/api/otp/verify") {
    return sendJson(res, 503, {
      ok: false,
      message: "OTP verification service is not configured yet."
    });
  }

  if (req.method === "POST" && url.pathname === "/api/payment/status") {
    return sendJson(res, 503, {
      ok: false,
      paid: false,
      message: "Payment verification is not configured yet. Connect your payment provider before enabling automatic unlocking."
    });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { ok: false, message: "Method not allowed." });
  }

  let file = safeFile(url.pathname);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    file = path.join(PUBLIC, "index.html");
  }

  try {
    const stat = fs.statSync(file);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "X-Content-Type-Options": "nosniff"
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  } catch {
    sendJson(res, 500, { ok: false, message: "Unable to serve the website." });
  }
});

server.listen(PORT, () => {
  console.log(`ICEMAN Website Hub running on port ${PORT}`);
});
