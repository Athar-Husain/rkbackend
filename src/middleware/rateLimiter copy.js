import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";
import logger from "../utils/logger.js";

// Redis client for rate limiting
const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : null;

/**
 * Generic rate limiter
 */
export const genericLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && { store: new RedisStore({ client: redisClient }) }),
  skip: (req) => process.env.NODE_ENV === "test",
});

/**
 * Auth rate limiter - stricter for auth endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && { store: new RedisStore({ client: redisClient }) }),
  skip: (req) => process.env.NODE_ENV === "test",
});

/**
 * OTP rate limiter - very strict for OTP endpoints
 */
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 OTP requests per hour
  message: {
    success: false,
    message: "Too many OTP requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && { store: new RedisStore({ client: redisClient }) }),
  skip: (req) => process.env.NODE_ENV === "test",
  handler: (req, res) => {
    logger.warn("OTP rate limit exceeded", {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      message: "Too many OTP requests. Please try again later.",
    });
  },
});

/**
 * Signup rate limiter
 */
export const signupLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // Limit each IP to 3 signups per day
  message: {
    success: false,
    message:
      "Too many signup attempts from this IP. Please try again tomorrow.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && { store: new RedisStore({ client: redisClient }) }),
  skip: (req) => process.env.NODE_ENV === "test",
});

/**
 * Login rate limiter
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && { store: new RedisStore({ client: redisClient }) }),
  skip: (req) => process.env.NODE_ENV === "test",
  keyGenerator: (req) => {
    // Use email/mobile for key if available
    return req.body.emailOrMobile || req.ip;
  },
});
