// const mongoose = require("mongoose");
import mongoose from "mongoose";

const notificationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["PUSH", "SMS", "EMAIL", "WHATSAPP"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["SENT", "DELIVERED", "FAILED"],
      default: "SENT",
    },
    error: String,
  },
  {
    timestamps: true,
  },
);

const NotificationLog = mongoose.model(
  "NotificationLog",
  notificationLogSchema,
);
// module.exports = NotificationLog;

export default NotificationLog;
