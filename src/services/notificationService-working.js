// services/notificationService.js
import admin from "firebase-admin";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { createRequire } from "module";

// Models
import User from "../models/User.model.js";
import Staff from "../models/Staff.model.js"; // Added
import Admin from "../models/Admin.js"; // Added
import NotificationLog from "../models/NotificationLog.js";

const require = createRequire(import.meta.url);

/* =========================
   INITIALIZATION
   ========================= */
let firebaseInitialized = false;
let serviceAccount;

try {
  if (process.env.NODE_ENV === "production") {
    serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
  } else {
    serviceAccount = require("./firebase-service-account.json");
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("🔥 Firebase Admin Initialized");
  }
  firebaseInitialized = true;
} catch (err) {
  console.error("❌ Firebase Admin init failed:", err);
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
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      })
    : null;

/* =========================
   CORE HELPERS
   ========================= */

/**
 * Maps userModel string to the actual Mongoose Model
 */
const getModel = (userModel) => {
  const models = { User, Staff, Admin };
  return models[userModel] || User;
};

/**
 * Updated Log Helper: Now handles userModel (Polymorphic)
 */
const logNotification = async (
  userId,
  userModel,
  type,
  title,
  content,
  meta = {},
) => {
  try {
    await NotificationLog.create({
      userId,
      userModel,
      type,
      title,
      content,
      category: meta.category || "SYSTEM",
      targetScreen: meta.targetScreen,
      targetId: meta.targetId,
      payload: meta.payload || {},
      status: "SENT",
    });
  } catch (error) {
    console.error("Error logging notification:", error);
  }
};

/* =========================
   EXPORTED SERVICES
   ========================= */

/**
 * Send Push Notification to any user type
 */
export const sendPushNotification = async (
  userId,
  userModel,
  title,
  body,
  navData = {},
) => {
  try {
    if (!firebaseInitialized) return { success: false };

    const Model = getModel(userModel);
    const recipient = await Model.findById(userId).lean();

    if (!recipient || !recipient.deviceTokens?.length)
      return { success: false };

    const tokens = recipient.deviceTokens.map((t) => t.token).filter(Boolean);
    if (!tokens.length) return { success: false };

    const message = {
      tokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(navData).map(([k, v]) => [k, String(v)]),
      ),
      android: {
        priority: "high",
        notification: { channelId: "high_priority", sound: "default" },
      },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Clean invalid tokens logic
    const invalidTokens = [];
    response.responses.forEach((r, i) => {
      if (
        !r.success &&
        r.error?.code === "messaging/registration-token-not-registered"
      ) {
        invalidTokens.push(tokens[i]);
      }
    });

    if (invalidTokens.length) {
      await Model.updateOne(
        { _id: userId },
        { $pull: { deviceTokens: { token: { $in: invalidTokens } } } },
      );
    }

    // Always log the attempt
    await logNotification(userId, userModel, "PUSH", title, body, navData);

    return { success: true, sent: response.successCount };
  } catch (err) {
    console.error("🔥 Push error:", err);
    return { success: false };
  }
};

/**
 * Send SMS and log
 */
export const sendSMS = async (userId, userModel, mobile, message) => {
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
