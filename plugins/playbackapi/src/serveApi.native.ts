import { createServer, IncomingMessage, ServerResponse } from "http";
import { BrowserWindow } from "electron";
import { URL } from "url";
console.log("EPIC STYLE");

interface ServerConfig {
  port: number;
  secure: boolean;
  apiKey?: string;
}

enum RepeatState {
  Off = 0,
  Context = 1,
  Track = 2,
}

const repeatStateDictionary: Record<string, RepeatState> = {
  off: RepeatState.Off,
  context: RepeatState.Context,
  track: RepeatState.Track,
};

let server: ReturnType<typeof createServer>;
let currInfo: any = {};
let tries = 0;
const tidalWindow = BrowserWindow.fromId(1);

// Update the media info
export const updateMediaInfo = (newInfo: any) => {
  // console.log("recieved media info:", mediaInfo);
  if (newInfo.paused !== undefined && currInfo.paused !== undefined) {
    // pause
    if (newInfo.paused && !currInfo.paused) {
      newInfo.offset = Date.now() - currInfo.lastUpdate;
      newInfo.position = currInfo.lastUpdatedPosition + currInfo.offset / 1000;
      newInfo.lastUpdatedPosition = currInfo.position;
    }

    // resume
    if (!newInfo.paused && currInfo.paused) {
      newInfo.lastUpdate = Date.now();
    }
  }

  currInfo = newInfo;

  // changing tracks or seek
  if (newInfo.position !== undefined) {
    //currentMediaInfo.position = mediaInfo.position;
    currInfo.lastUpdatedPosition = currInfo.position;
    currInfo.lastUpdate = Date.now();
  }
};

function handleControlRequest(url: URL): boolean {
  if (tidalWindow === null) {
    console.log("Unable to find Tidal window");
    return false;
  }
  if (tidalWindow.webContents === null) {
    console.log("Unable to find Tidal window webContents");
    return false;
  }
  switch (url.pathname) {
    case "/play":
      tidalWindow.webContents.send("playbackapi.play");
      break;
    case "/pause":
      tidalWindow.webContents.send("playbackapi.pause");
      break;
    case "/next":
      tidalWindow.webContents.send("playbackapi.next");
      break;
    case "/prev":
      tidalWindow.webContents.send("playbackapi.prev");
      break;
    case "/shuffle":
      let reqShuffle = url.searchParams.get("state");
      if (reqShuffle)
        tidalWindow.webContents.send(
          "playbackapi.shuffle",
          reqShuffle.toLowerCase() === "true"
        );
      break;
    case "/repeat":
      let reqState = url.searchParams.get("state");
      if (reqState) {
        tidalWindow.webContents.send(
          "playbackapi.repeat",
          repeatStateDictionary[reqState.toLowerCase()] ?? null
        );
      }
      break;
    case "/seek":
      let reqPosition = url.searchParams.get("position");
      let time = parseFloat(reqPosition || "");
      if (!isNaN(time) && time >= 0) {
        tidalWindow.webContents.send("playbackapi.seek", time);
      } else {
        return false;
      }
      break;
    case "/volume":
      let reqVolume = url.searchParams.get("level");
      if (reqVolume) {
        const volume = parseFloat(reqVolume);
        if (!isNaN(volume) && volume >= 0 && volume <= 100) {
          tidalWindow.webContents.send("playbackapi.volume", volume);
        } else {
          return false;
        }
      }
      break;
    default:
      return false;
  }
  return true;
}

const createAPIServer = (config: ServerConfig) => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    // Handle OPTIONS request for CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Check API key if secure mode is enabled
    if (config.secure) {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${config.apiKey}`) {
        res.writeHead(401, { "Content-Type": "text/plain" });
        res.end("Unauthorized");
        return;
      }
    }

    // Handle GET requests
    if (req.method === "GET") {
      if (req.url === "/now-playing") {
        res.writeHead(200, { "Content-Type": "application/json" });
        let info = currInfo;
        info.currentTime = Date.now();
        if (!info.paused) {
          info.offset = Date.now() - info.lastUpdate;
          info.position = info.lastUpdatedPosition + info.offset / 1000;
        }
        res.end(JSON.stringify(info));
        return;
      }
    } else if (req.method === "PUT") {
      if (req.url === undefined) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad Request");
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      const handled = handleControlRequest(url);
      if (handled) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
        return;
      }
    }

    // Handle all other requests
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request");
  });

  server.on("error", (e: NodeJS.ErrnoException) => {
    if (tries >= 5) {
      console.error("Failed to start server after multiple attempts.");
      return;
    }
    if (e.code === "EADDRINUSE") {
      console.error("Address in use, retrying...");
    } else {
      console.error("Server error:", e);
    }
    tries++;
    setTimeout(() => {
      server.close();
      server.listen(config.port);
    }, 1000);
  });

  server.listen(config.port, () => {
    console.log(
      `Server is running on port ${config.port}${
        config.secure ? " (secure mode)" : ""
      }`
    );
  });

  return server;
};

export const startServer = (config: ServerConfig) => {
  if (server) {
    console.log("Server detected, restarting");
    stopServer();
  }
  console.log("Starting server");

  createAPIServer(config);
};

// Cleanup function
export const stopServer = () => {
  if (server) {
    server.close(() => {
      console.log("Server stopped");
    });
  }
};
