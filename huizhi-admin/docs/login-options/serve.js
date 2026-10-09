const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const types = { ".html": "text/html; charset=utf-8", ".md": "text/plain; charset=utf-8" };

http
  .createServer((req, res) => {
    const url = req.url.split("?")[0];
    const file = path.join(root, url === "/" ? "index.html" : url);
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(buf);
    });
  })
  .listen(8791, "127.0.0.1", () => console.log("login-options preview on http://127.0.0.1:8791"));
