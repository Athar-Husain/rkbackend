// const dotenv = require("dotenv");

import "dotenv/config";
import app from "./src/app.js";

import connectDB from "./src/config/database.js";

// const app = require("./src/app");
// const connectDB = require("./src/config/database");

// Connect to database
// connectDB();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  console.log("Unhandled Rejection at:", promise);

  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log(`Error: ${err.message}`);
  console.log("Uncaught Exception. Shutting down...");

  // Close server & exit process
  server.close(() => process.exit(1));
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Process terminated.");
  });
});
