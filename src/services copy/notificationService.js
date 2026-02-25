// src/services/notificationService.js
import admin from "firebase-admin";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { createRequire } from "module";

import User from "../models/User.model.js";
import Staff from "../models/Staff.model.js";
import Admin from "../models/Admin.js";
import NotificationLog from "../models/NotificationLog.model.js";
// import NotificationLog from "../models/NotificationLog.js";

const require = createRequire(import.meta.url);

/* ================= INITIALIZATION ================= */

let firebaseInitialized = false;
let serviceAccount;

try {
  if (process.env.NODE_ENV === "production") {
    serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
  } else {
    serviceAccount = require("./firebase-service-account.json");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  firebaseInitialized = true;
  console.log("🔥 Firebase Initialized");
} catch (err) {
  console.error("❌ Firebase Init Error:", err.message);
}

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const emailTransporter =
  process.env.EMAIL_HOST && process.env.EMAIL_USER
    ? nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === "true",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })
    : null;

/* ================= MODEL MAPPER ================= */

const getModel = (userModel) => {
  const models = { User, Staff, Admin };
  const Model = models[userModel];
  if (!Model) throw new Error("Invalid user model");
  return Model;
};

/* ================= LOGGING ================= */

const logNotification = async ({
  userId,
  userModel,
  type,
  title,
  content,
  category = "SYSTEM",
  targetScreen,
  targetId,
  payload = {},
  deliveryStatus = "SENT",
  errorDetails,
}) => {
  try {
    await NotificationLog.create({
      userId,
      userModel,
      type,
      title,
      content,
      category,
      targetScreen,
      targetId,
      payload,
      deliveryStatus,
      errorDetails,
    });
  } catch (err) {
    console.error("Notification Log Error:", err.message);
  }
};

/* ================= PUSH ================= */

export const sendPushNotification = async (
  userId,
  userModel,
  title,
  body,
  navData = {},
) => {
  try {
    if (!firebaseInitialized)
      return { success: false, message: "Firebase not initialized" };

    const Model = getModel(userModel);
    const user = await Model.findById(userId).lean();
    if (!user?.deviceTokens?.length)
      return { success: false, message: "No device tokens" };

    const tokens = user.deviceTokens.map((t) => t.token).filter(Boolean);
    if (!tokens.length) return { success: false, message: "Invalid tokens" };

    const message = {
      tokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(navData).map(([k, v]) => [k, String(v)]),
      ),
      android: {
        priority: "high",
        notification: { sound: "default" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    const invalidTokens = [];

    response.responses.forEach((r, index) => {
      if (
        !r.success &&
        r.error?.code === "messaging/registration-token-not-registered"
      ) {
        invalidTokens.push(tokens[index]);
      }
    });

    if (invalidTokens.length) {
      await Model.updateOne(
        { _id: userId },
        {
          $pull: {
            deviceTokens: { token: { $in: invalidTokens } },
          },
        },
      );
    }

    await logNotification({
      userId,
      userModel,
      type: "PUSH",
      title,
      content: body,
      category: navData.category,
      targetScreen: navData.targetScreen,
      targetId: navData.targetId,
      payload: navData.payload,
      deliveryStatus: response.successCount > 0 ? "DELIVERED" : "FAILED",
    });

    return { success: true };
  } catch (err) {
    await logNotification({
      userId,
      userModel,
      type: "PUSH",
      title,
      content: body,
      deliveryStatus: "FAILED",
      errorDetails: err.message,
    });
    return { success: false };
  }
};

/**
 * Send SMS and log
 */
// export const sendSMS = async (userId, userModel, mobile, message) => {
export const sendNotificationSMS  = async (userId, userModel, mobile, message) => {
  if (!twilioClient) return { success: false };
  try {
    const sms = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${mobile}`,
    });

    await logNotification(userId, userModel, "SMS", "SMS Alert", message, {
      sid: sms.sid,
    });
    return { success: true };
  } catch (err) {
    return { success: false };
  }
};

/**
 * THE MASTER TRIGGER: Use this in your controllers!
 * channels: ['PUSH', 'SMS', 'EMAIL']
 */
export const triggerNotification = async (recipientId, userModel, options) => {
  const {
    title,
    body,
    category,
    targetScreen,
    targetId,
    channels = ["PUSH"],
    payload = {},
  } = options;

  const navData = { category, targetScreen, targetId, payload };

  const results = [];

  if (channels.includes("PUSH")) {
    results.push(
      await sendPushNotification(recipientId, userModel, title, body, navData),
    );
  }

  // You can add logic for SMS/Email here using the same pattern
  return results;
};

/**
 * Unified Register Token
 */
export const registerDeviceToken = async (
  userId,
  userModel,
  token,
  platform = "android",
) => {
  const Model = getModel(userModel);
  const user = await Model.findById(userId);
  if (!user) throw new Error("User not found");

  const existingIndex = user.deviceTokens.findIndex((t) => t.token === token);
  if (existingIndex !== -1) {
    user.deviceTokens[existingIndex].platform = platform;
    user.deviceTokens[existingIndex].lastUsed = new Date();
  } else {
    user.deviceTokens.push({ token, platform, lastUsed: new Date() });
  }
  await user.save();
  return { success: true };
};

export const sendBulkNotifications1 = async (
  userIds,
  title,
  body,
  type = "PUSH",
  data = {},
) => {
  const results = { total: userIds.length, success: 0, failed: 0, details: [] };

  for (const userId of userIds) {
    try {
      const user = await User.findById(userId);
      let result;
      switch (type) {
        case "PUSH":
          result = await sendPushNotification(userId, title, body, data);
          break;
        case "SMS":
          result =
            user && user.mobile
              ? await sendSMS(user.mobile, body)
              : { success: false, message: "Mobile not found" };
          break;
        case "EMAIL":
          result =
            user && user.email
              ? await sendEmail(user.email, title, body)
              : { success: false, message: "Email not found" };
          break;
        default:
          result = { success: false, message: "Invalid notification type" };
      }
      results.details.push({
        userId,
        success: result.success,
        message: result.message || "Sent",
      });
      result.success ? results.success++ : results.failed++;
    } catch (error) {
      results.details.push({ userId, success: false, message: error.message });
      results.failed++;
    }
  }
  return results;
};

/**
 * Send notification to an array of users (Bulk)
 * @param {Array} userIds - Array of ObjectIds
 * @param {String} userModel - 'Admin', 'Staff', or 'User'
 * @param {Object} options - Notification content and metadata
 */
export const sendBulkNotifications = async (userIds, userModel, options) => {
  const results = {
    total: userIds.length,
    success: 0,
    failed: 0,
  };

  // We use Promise.all to trigger all notifications in parallel for speed
  const notifications = userIds.map((id) =>
    triggerNotification(id, userModel, options),
  );

  const responses = await Promise.all(notifications);

  responses.forEach((res) => {
    // Since triggerNotification returns an array of channel results
    const isSuccess = res.some((r) => r.success === true);
    if (isSuccess) results.success++;
    else results.failed++;
  });

  return results;
};
