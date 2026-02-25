import "dotenv/config";
import http from "http";
import mongoose from "mongoose";
import app from "./src/app.js";
import logger from "./src/utils/logger.js";
import connectDB from "./src/config/database.js";

const PORT = process.env.PORT || 5000;

/* =======================
   Server
======================= */

const server = http.createServer(app);

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
};

startServer();

/* =======================
   Process Handlers
======================= */

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection", err);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", err);
  process.exit(1);
});

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

function shutdown() {
  logger.info("Shutting down gracefully...");
  server.close(() => {
    mongoose.connection.close(false, () => {
      logger.info("MongoDB disconnected");
      process.exit(0);
    });
  });
}
