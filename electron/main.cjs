const { app, BrowserWindow, dialog, utilityProcess } = require("electron");
const net = require("node:net");
const path = require("node:path");

app.setName("MAFER Hipismo");

let serverProcess;
let serverHasExited = false;
let serverExitCode;
let window;
let appUrl;

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("No se pudo reservar un puerto local."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForServer(port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (serverHasExited) {
      throw new Error(`El servidor local terminó con código ${serverExitCode}.`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw new Error("El servidor local no respondió dentro de 30 segundos.");
}

async function createWindow() {
  const port = await findAvailablePort();
  const standaloneDirectory = path.join(process.resourcesPath, "server");
  const serverPath = path.join(standaloneDirectory, "server.js");
  serverProcess = utilityProcess.fork(serverPath, [], {
    cwd: standaloneDirectory,
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    stdio: "ignore",
    serviceName: "MAFER Hipismo Next.js server",
  });
  serverProcess.once("exit", (code) => {
    serverHasExited = true;
    serverExitCode = code;
  });

  await waitForServer(port);
  appUrl = `http://127.0.0.1:${port}`;
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 700,
    title: "MAFER Hipismo",
    backgroundColor: "#f5f4f0",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== new URL(appUrl).origin) event.preventDefault();
  });
  await window.loadURL(appUrl);
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await dialog.showMessageBox({
      type: "error",
      title: "MAFER Hipismo",
      message: "No se pudo iniciar la aplicación.",
      detail: `${message}\n\nVerifica que la instalación esté completa y que PostgreSQL esté configurado.`,
    });
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (serverProcess && !serverHasExited) serverProcess.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
