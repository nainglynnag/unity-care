import {app} from "./app";
import { prisma } from "./lib/prisma";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Backend Server is running at http://localhost:${PORT}`);
});

// To disconnect from database automatically when the server is closed
const gracefulShutdown = async () => {
  await prisma.$disconnect();
  server.close(()=>{
    console.log("Unity care API is closed!");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);