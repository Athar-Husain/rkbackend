import admin from "firebase-admin";
import { createRequire } from "module";
import User from "../models/User.model.js";
import Staff from "../models/Staff.model.js";
import Admin from "../models/Admin.js";
import NotificationLog from "../models/NotificationLog.model.js";

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
 * Sends a push notification using DATA-ONLY payload to prevent duplicates.
 */
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
    if (!tokens.length) return { success: false, message: "No valid tokens" };

    // INDUSTRY STANDARD: Use "data" only. Do NOT use the "notification" key.
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
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Clean up invalid tokens
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

    return { success: true, successCount: response.successCount };
  } catch (err) {
    console.error("Push Error:", err.message);
    return { success: false, error: err.message };
  }
};

export const triggerNotification = async (recipientId, userModel, options) => {
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
      await sendPushNotification(recipientId, userModel, title, body, navData),
    );
  }
  return results;
};

/**
 * Bulk sending with chunking (500 tokens per batch) for scalability.
 */
export const sendBulkNotifications = async (userIds, userModel, options) => {
  const results = { total: userIds.length, success: 0, failed: 0 };
  const CHUNK_SIZE = 500;

  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);
    const chunkPromises = chunk.map((id) =>
      triggerNotification(id, userModel, options),
    );
    const responses = await Promise.all(chunkPromises);

    responses.forEach((res) => {
      if (res.some((r) => r.success)) results.success++;
      else results.failed++;
    });
  }
  return results;
};
