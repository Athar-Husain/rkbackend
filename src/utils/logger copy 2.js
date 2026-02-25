import winston from "winston";
import path from "path";

const { combine, timestamp, printf, colorize, json, metadata } = winston.format;

// 1. Define a readable format for the Console
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}]: ${message}${metaString}`;
});

// 2. Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  // Base format for all transports (File & Console)
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    metadata({ fillExcept: ["message", "level", "timestamp"] }),
  ),
  transports: [
    // Console: Pretty & Colorized
    new winston.transports.Console({
      format: combine(colorize(), consoleFormat),
    }),

    // Error log file: JSON format (Good for debugging)
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
