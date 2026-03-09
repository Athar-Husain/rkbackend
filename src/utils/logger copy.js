import winston from "winston";
import path from "path";

const { combine, timestamp, printf, colorize, json, metadata } = winston.format;

// 1. Define a clean format for the Console
const consoleFormat = printf(({ level, message, timestamp, metadata }) => {
  // Only show metadata if it's not empty
  const metaString =
    metadata && Object.keys(metadata).length > 0
      ? ` ${JSON.stringify(metadata)}`
      : "";

  return `${timestamp} [${level}]: ${message}${metaString}`;
});

// 2. Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    // This moves extra arguments into a "metadata" property
    metadata({ fillExcept: ["message", "level", "timestamp"] }),
  ),
  transports: [
    // Console: Clean and Colorized (No empty {} metadata)
    new winston.transports.Console({
      format: combine(colorize(), consoleFormat),
    }),

    // Error log file: JSON format
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      format: json(),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Combined log file: JSON format
    new winston.transports.File({
      filename: path.join("logs", "combined.log"),
      format: json(),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],

  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join("logs", "exceptions.log"),
    }),
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join("logs", "rejections.log"),
    }),
  ],
});

export default logger;
