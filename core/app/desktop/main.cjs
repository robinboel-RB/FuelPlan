const path = require("node:path");
const http = require("node:http");
const { app, BrowserWindow } = require("electron");
const serveHandler = require("serve-handler");
const fs = require("node:fs");

let staticServer = null;

function resolveRendererDir() {
  const bundledOutDir = path.join(app.getAppPath(), "out");
  if (fs.existsSync(bundledOutDir)) {
    return bundledOutDir;
  }

  return path.join(process.resourcesPath, "renderer");
}

function startStaticServer() {
  const rendererDir = resolveRendererDir();

  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      return serveHandler(request, response, {
        public: rendererDir,
        cleanUrls: true
      });
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not resolve local desktop server port."));
        return;
      }

      staticServer = server;
      resolve(address.port);
    });
  });
}

async function createMainWindow() {
  const port = await startStaticServer();
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: "#020617",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
});
