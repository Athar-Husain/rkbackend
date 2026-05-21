import "dotenv/config";
import http from "http";
import mongoose from "mongoose";
import app from "./src/app.js";
import logger from "./src/utils/logger.js";
import connectDB from "./src/config/database.js";

const PORT = process.env.PORT || 5000;

/* =======================
   Create HTTP Server
======================= */
const server = http.createServer(app);

/* =======================
   Start Server
======================= */
const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
};

startServer();

/* =======================
   Graceful Shutdown
======================= */
const gracefulShutdown = async (signal) => {
  try {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    // Stop accepting new requests
    server.close(async (err) => {
      if (err) {
        logger.error("Error closing HTTP server", err);
      } else {
        logger.info("HTTP server closed");
      }

      try {
        // Close MongoDB connection
        await mongoose.connection.close(false);
        logger.info("MongoDB disconnected");
      } catch (mongoErr) {
        logger.error("Error disconnecting MongoDB", mongoErr);
      }

      process.exit(0);
    });
  } catch (shutdownErr) {
    logger.error("Error during shutdown", shutdownErr);
    process.exit(1);
  }
};

/* =======================
   Process Handlers
======================= */
process.on("unhandledRejection", async (err) => {
  logger.error("Unhandled Rejection:", err);

  try {
    await mongoose.connection.close(false);
    logger.info("MongoDB disconnected after unhandled rejection");
  } catch (closeErr) {
    logger.error("Error disconnecting MongoDB after rejection", closeErr);
  }

  process.exit(1);
});

process.on("uncaughtException", async (err) => {
  logger.error("Uncaught Exception:", err);

  try {
    await mongoose.connection.close(false);
    logger.info("MongoDB disconnected after uncaught exception");
  } catch (closeErr) {
    logger.error("Error disconnecting MongoDB after exception", closeErr);
  }

  process.exit(1);
});

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
