import http from "http";
import { app } from "./app";
import { prisma } from "./lib/prisma";
import { createWebSocketServer } from "./ws/server";

const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);
const wss = createWebSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[HTTP] Server is running at http://localhost:${PORT}`);
  console.log(`[WS]   WebSocket available at ws://localhost:${PORT}/ws`);
});

// Graceful shutdown — close WS connections, then HTTP server, then DB.
const gracefulShutdown = async () => {
  // 1. Close all WS connections gracefully
  wss.clients.forEach((client) => {
    client.close(1001, "Server shutting down");
  });
  wss.close();

  // 2. Disconnect Prisma
  await prisma.$disconnect();

  // 3. Close HTTP server
  httpServer.close(() => {
    console.log("Unity care API is closed!");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
