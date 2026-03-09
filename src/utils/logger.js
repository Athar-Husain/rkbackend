import winston from "winston";
import path from "path";
import fs from "fs";

const { combine, timestamp, printf, colorize, json, metadata, errors } =
  winston.format;

const isProduction = process.env.NODE_ENV === "production";

// Ensure logs directory exists in development
if (!isProduction) {
  const logDir = "logs";
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
}

// Console format
const consoleFormat = printf(
  ({ level, message, timestamp, metadata, stack }) => {
    const metaString =
      metadata && Object.keys(metadata).length > 0
        ? ` ${JSON.stringify(metadata)}`
        : "";

    const stackTrace = stack ? `\n${stack}` : "";

    return `${timestamp} [${level}]: ${message}${metaString}${stackTrace}`;
  },
);

// Base transports (always include console)
const transports = [
  new winston.transports.Console({
    format: combine(colorize(), consoleFormat),
  }),
];

// Add file transports only in development
if (!isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      format: json(),
      maxsize: 5242880,
      maxFiles: 5,
    }),

    new winston.transports.File({
      filename: path.join("logs", "combined.log"),
      format: json(),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    metadata({ fillExcept: ["message", "level", "timestamp", "stack"] }),
  ),
  transports,
});

// Handle uncaught exceptions
if (!isProduction) {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join("logs", "exceptions.log"),
    }),
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join("logs", "rejections.log"),
    }),
  );
}

export default logger;
