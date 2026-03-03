import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
// import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import logger from "./utils/logger.js";
import { genericLimiter } from "./middleware/rateLimiter.js";

// Routes (MERGED FROM OLD SERVER)

// import authRoutes from "./routes/auth.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/users.js";
import productRoutes from "./routes/products.js";
import couponRoutes from "./routes/coupons.js";
import storeRoutes from "./routes/stores.js";
import purchaseRoutes from "./routes/purchases.js";
import adminRoutes from "./routes/admin.js";
import staffRoutes from "./routes/staff.js";
import locationRoutes from "./routes/cityArea.js";
import analyticsRoutes from "./routes/analytics.js";
import homeRoutes from "./routes/home.js";
import bannerRoutes from "./routes/banner.routes.js";
import promotionRoutes from "./routes/promotion.routes.js";

// Middleware
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* =======================
   Security Middleware
======================= */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  }),
);

/* =======================
   CORS
======================= */
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(","),
    credentials: true,
  }),
);

/* =======================
   Rate Limiting
======================= */
app.use("/api", genericLimiter);

/* =======================
   Parsers
======================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

/* =======================
   Security
======================= */
// app.use(mongoSanitize());
app.use(compression());

/* =======================
   Logging
======================= */
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    }),
  );
}

/* =======================
   Static Files
======================= */
app.use("/uploads", express.static(path.join(__dirname, "./uploads")));

/* =======================
   Routes
======================= */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/banner", bannerRoutes);
app.use("/api/promotion", promotionRoutes);

/* =======================
   Health Check
======================= */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* =======================
   404 + Error Handling
======================= */
app.use(notFound);
app.use(errorHandler);

export default app;
