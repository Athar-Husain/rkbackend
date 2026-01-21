const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const path = require("path");

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const productRoutes = require("./routes/products");
const couponRoutes = require("./routes/coupons");
const storeRoutes = require("./routes/stores");
const purchaseRoutes = require("./routes/purchases");
// const referralRoutes = require("./routes/referrals");
const adminRoutes = require("./routes/admin");
const analyticsRoutes = require("./routes/analytics");

// Import middleware
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.MOBILE_APP_URL,
      "http://localhost:3000",
      "exp://localhost:19000",
    ];

    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
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
  max: 100, // Limit each IP to 100 requests per windowMs
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

module.exports = app;
