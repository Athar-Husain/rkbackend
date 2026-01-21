import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import productRoutes from "./routes/products.js";
import couponRoutes from "./routes/coupons.js";
import storeRoutes from "./routes/stores.js";
import purchaseRoutes from "./routes/purchases.js";
// import referralRoutes from "./routes/referrals.js";
import adminRoutes from "./routes/admin.js";
import analyticsRoutes from "./routes/analytics.js";

// Import middleware
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.MOBILE_APP_URL,
      "http://localhost:3000",
      "exp://localhost:19000",
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/purchases", purchaseRoutes);
// app.use("/api/referrals", referralRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

export default app;
