const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const staticAssets = path.join(root, ".next", "static");
const publicAssets = path.join(root, "public");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  throw new Error("No se encontró el servidor standalone. Ejecuta primero el build de Next.js.");
}
fs.cpSync(staticAssets, path.join(standalone, ".next", "static"), { recursive: true });
fs.cpSync(publicAssets, path.join(standalone, "public"), { recursive: true });
