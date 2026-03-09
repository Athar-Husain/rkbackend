import admin from "firebase-admin";
import { createRequire } from "module";
import User from "../models/User.model.js";
import Staff from "../models/Staff.model.js";
import Admin from "../models/Admin.js";
import NotificationLog from "../models/NotificationLog.model.js";
import mongoose from "mongoose";

const require = createRequire(import.meta.url);

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

const getModel = (userModel) => {
  const models = { User, Staff, Admin };
  const Model = models[userModel];
  if (!Model) throw new Error("Invalid user model");
  return Model;
};

// Internal helper for single sends
const logNotification = async (logData) => {
  try {
    await NotificationLog.create(logData);
  } catch (err) {
    console.error("Notification Log Error:", err.message);
  }
};

export const sendNotificationSMS = async (
  userId,
  userModel,
  mobile,
  message,
) => {
  // if (!twilioClient) return { success: false };
  try {
    // SMS Logic here...
    await logNotification({
      userId,
      userModel,
      type: "SMS",
      title: "SMS Alert",
      content: message,
      deliveryStatus: "SENT",
    });
    return { success: true };
  } catch (err) {
    return { success: false };
  }
};

export const sendPushNotification = async (
  userId,
  userModel,
  title,
  body,
  navData = {},
  skipLog = false,
) => {
  try {
    if (!firebaseInitialized)
      return { success: false, message: "Firebase not initialized" };

    const Model = getModel(userModel);
    const user = await Model.findById(userId).lean();
    if (!user?.deviceTokens?.length)
      return { success: false, message: "No device tokens" };

    const tokens = user.deviceTokens.map((t) => t.token).filter(Boolean);
    if (!tokens.length) return { success: false, message: "No valid tokens" };

    const message = {
      tokens,
      data: {
        title: String(title),
        body: String(body),
        category: String(navData.category || "SYSTEM"),
        targetScreen: String(navData.targetScreen || ""),
        targetId: String(navData.targetId || ""),
        image: String(navData.image || ""),
      },
      android: { priority: "high" },
      apns: { payload: { aps: { contentAvailable: true, badge: 1 } } },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Cleanup logic
    const invalidTokens = [];
    response.responses.forEach((r, index) => {
      if (
        !r.success &&
        (r.error?.code === "messaging/registration-token-not-registered" ||
          r.error?.code === "messaging/invalid-registration-token")
      ) {
        invalidTokens.push(tokens[index]);
      }
    });

    if (invalidTokens.length) {
      await Model.updateOne(
        { _id: userId },
        { $pull: { deviceTokens: { token: { $in: invalidTokens } } } },
      );
    }

    // Only log here if NOT called from bulk (to avoid duplicate logs)
    if (!skipLog) {
      await logNotification({
        userId,
        userModel,
        type: "PUSH",
        title,
        content: body,
        category: navData.category,
        targetScreen: navData.targetScreen,
        targetId: navData.targetId,
        deliveryStatus: response.successCount > 0 ? "DELIVERED" : "FAILED",
      });
    }

    return { success: true, successCount: response.successCount };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const triggerNotification = async (
  recipientId,
  userModel,
  options,
  skipLog = false,
) => {
  const {
    title,
    body,
    category,
    targetScreen,
    targetId,
    image,
    channels = ["PUSH"],
  } = options;
  const navData = { category, targetScreen, targetId, image };
  const results = [];

  if (channels.includes("PUSH")) {
    results.push(
      await sendPushNotification(
        recipientId,
        userModel,
        title,
        body,
        navData,
        skipLog,
      ),
    );
  }
  return results;
};

/**
 * Bulk sending with high-speed insertMany for NotificationLog
 */
export const sendBulkNotifications = async (userIds, userModel, options) => {
  const results = { total: userIds.length, success: 0, failed: 0 };
  const CHUNK_SIZE = 500;

  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);
    const bulkLogs = [];

    const chunkPromises = chunk.map(async (id) => {
      // pass skipLog = true to avoid individual NotificationLog.create calls
      const responses = await triggerNotification(id, userModel, options, true);

      const isSuccess = responses.some((r) => r.success);
      if (isSuccess) results.success++;
      else results.failed++;

      // Prepare data for the bulk insert
      bulkLogs.push({
        // userId: id,
        userId: new mongoose.Types.ObjectId(id),
        userModel,
        title: options.title,
        content: options.body,
        category: options.category || "SYSTEM",
        targetScreen: options.targetScreen,
        targetId: options.targetId,
        type: "PUSH",
        deliveryStatus: isSuccess ? "DELIVERED" : "FAILED",
        isRead: false,
      });
    });

    await Promise.all(chunkPromises);

    // Log all users in this chunk to the schema at once
    if (bulkLogs.length > 0) {
      await NotificationLog.insertMany(bulkLogs, { ordered: false }).catch(
        (err) => console.error("Bulk Log Error:", err.message),
      );
    }
  }
  return results;
};
