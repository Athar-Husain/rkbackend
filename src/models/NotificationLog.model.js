import mongoose from "mongoose";

const notificationLogSchema = new mongoose.Schema(
  {
    // 1. RECIPIENT LOGIC (Polymorphic)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "userModel",
      // index: true,
    },
    userModel: {
      type: String,
      required: true,
      // enum: ["User", "Staff", "Admin"],
    },

    // 2. CONTENT
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },

    // 3. CATEGORY
    category: {
      type: String,
      enum: [
        "ORDER",
        "WARRANTY",
        "COUPON",
        "PAYMENT",
        "SYSTEM",
        "KYC",
        "SUPPORT",
      ],
      default: "SYSTEM",
    },

    // 4. SMART NAVIGATION
    targetScreen: {
      type: String,
    },
    targetId: {
      type: String,
    },

    // 5. FLEXIBLE PAYLOAD
    payload: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // 6. STATUS TRACKING
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    type: {
      type: String,
      enum: ["PUSH", "SMS", "EMAIL", "WHATSAPP"],
      required: true,
    },
    deliveryStatus: {
      type: String,
      enum: ["PENDING", "SENT", "DELIVERED", "FAILED"],
      default: "PENDING",
    },
    errorDetails: {
      type: String,
    },
  },
  { timestamps: true },
);

// Composite index for fast fetching
notificationLogSchema.index({ userId: 1, isRead: 1 });

// TTL index (60 days auto delete)
notificationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 5184000 });

const NotificationLog = mongoose.model(
  "NotificationLog",
  notificationLogSchema,
);

export default NotificationLog;
