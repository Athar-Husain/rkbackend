import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";
import logger from "../utils/logger.js";

// Redis client for rate limiting (optional)
const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : null;

// Helper to conditionally use Redis store
const createStore = () =>
  redisClient ? new RedisStore({ client: redisClient }) : undefined;

/**
 * Generic rate limiter (100 requests per 15 min)
 */
export const genericLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: ipKeyGenerator, // IPv6-safe
  skip: (req) => process.env.NODE_ENV === "test",
});

/**
 * Auth rate limiter (10 requests per 15 min)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === "test",
});

/**
 * OTP rate limiter (5 requests per hour)
 */
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many OTP requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === "test",
  handler: (req, res) => {
    logger.warn("OTP rate limit exceeded", { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      message: "Too many OTP requests. Please try again later.",
    });
  },
});

/**
 * Signup rate limiter (3 signups per day)
 */
export const signupLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message:
      "Too many signup attempts from this IP. Please try again tomorrow.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === "test",
});

/**
 * Login rate limiter (5 attempts per 15 min)
 * Uses email/mobile as key if provided, otherwise IPv6-safe IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  skip: (req) => process.env.NODE_ENV === "test",
  keyGenerator: (req) => {
    // Use email/mobile if provided, fallback to IPv6-safe IP
    return req.body.emailOrMobile || ipKeyGenerator(req);
  },
});
