import admin from "firebase-admin";
import nodemailer from "nodemailer";
import twilio from "twilio";
import fs from "fs";
import User from "../models/User.model.js";
import NotificationLog from "../models/NotificationLog.js";

// ===== Initialize Firebase =====
let firebaseInitialized = false;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
  try {
    const serviceAccount = JSON.parse(
      fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH, "utf8"),
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
    console.log("Firebase Admin SDK initialized");
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }
}

// ===== Initialize Twilio =====
const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

// ===== Initialize Email Transporter =====
const emailTransporter =
  process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS
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

// ===== Logging Function =====
const logNotification = async (userId, type, title, content, metadata = {}) => {
  try {
    await NotificationLog.create({
      userId,
      type,
      title,
      content,
      metadata,
      sentAt: new Date(),
    });
  } catch (error) {
    console.error("Error logging notification:", error);
  }
};

// ===== Push Notification =====
const sendPushNotification = async (userId, title, body, data = {}) => {
  if (!firebaseInitialized)
    return { success: false, message: "Firebase not configured" };

  try {
    const user = await User.findById(userId);
    if (!user?.deviceTokens?.length)
      return { success: false, message: "User has no device tokens" };

    const tokens = user.deviceTokens
      .filter(
        (t) =>
          t.token &&
          t.lastActive > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      )
      .map((t) => t.token);

    if (!tokens.length)
      return { success: false, message: "No active device tokens found" };

    const message = { notification: { title, body }, data, tokens };
    const response = await admin.messaging().sendEachForMulticast(message);

    await logNotification(userId, "PUSH", title, body, {
      successCount: response.successCount,
      failureCount: response.failureCount,
      data,
    });

    return {
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      response: response.responses,
    };
  } catch (error) {
    console.error("Error sending push notification:", error);
    await logNotification(userId, "PUSH", title, body, {
      error: error.message,
      data,
    });
    return { success: false, message: error.message };
  }
};

// ===== SMS Notification =====
const sendSMS = async (mobile, message) => {
  if (!twilioClient)
    return { success: false, message: "SMS service not configured" };

  try {
    const sms = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${mobile}`,
    });

    const user = await User.findOne({ mobile });
    if (user)
      await logNotification(user._id, "SMS", "SMS Notification", message, {
        mobile,
        sid: sms.sid,
      });

    return { success: true, sid: sms.sid, message: "SMS sent successfully" };
  } catch (error) {
    console.error("Error sending SMS:", error);
    return { success: false, message: error.message };
  }
};

// ===== Email Notification =====
const sendEmail = async (email, subject, htmlContent, textContent = "") => {
  if (!emailTransporter)
    return { success: false, message: "Email service not configured" };

  try {
    const info = await emailTransporter.sendMail({
      from: `"RK Electronics" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
    });

    const user = await User.findOne({ email });
    if (user)
      await logNotification(user._id, "EMAIL", subject, textContent, {
        email,
        messageId: info.messageId,
      });

    return {
      success: true,
      messageId: info.messageId,
      message: "Email sent successfully",
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, message: error.message };
  }
};

// ===== WhatsApp Notification =====
const sendWhatsApp = async (mobile, message) => {
  if (!twilioClient)
    return { success: false, message: "WhatsApp service not configured" };

  try {
    const whatsapp = await twilioClient.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:+91${mobile}`,
    });

    const user = await User.findOne({ mobile });
    if (user)
      await logNotification(
        user._id,
        "WHATSAPP",
        "WhatsApp Notification",
        message,
        { mobile, sid: whatsapp.sid },
      );

    return {
      success: true,
      sid: whatsapp.sid,
      message: "WhatsApp sent successfully",
    };
  } catch (error) {
    console.error("Error sending WhatsApp:", error);
    return { success: false, message: error.message };
  }
};

// ===== Register Device Token =====
const registerDeviceToken = async (userId, token, platform = "android") => {
  const user = await User.findById(userId);
  if (!user) return { success: false, message: "User not found" };

  const existingToken = user.deviceTokens.find((t) => t.token === token);
  if (existingToken) {
    existingToken.platform = platform;
    existingToken.lastActive = new Date();
  } else {
    user.deviceTokens.push({ token, platform, lastActive: new Date() });
  }

  await user.save();
  return { success: true, message: "Token registered" };
};

// ===== Unregister Device Token =====
const unregisterDeviceToken = async (userId, token) => {
  const user = await User.findById(userId);
  if (!user) return { success: false, message: "User not found" };

  user.deviceTokens = user.deviceTokens.filter((t) => t.token !== token);
  await user.save();
  return { success: true, message: "Token unregistered" };
};

// ===== Bulk Notifications (Parallelized) =====
const sendBulkNotifications = async (
  userIds,
  title,
  body,
  type = "PUSH",
  data = {},
) => {
  const tasks = userIds.map(async (userId) => {
    try {
      const user = await User.findById(userId);
      let result;

      switch (type) {
        case "PUSH":
          result = await sendPushNotification(userId, title, body, data);
          break;
        case "SMS":
          result = user?.mobile
            ? await sendSMS(user.mobile, body)
            : { success: false, message: "Mobile not found" };
          break;
        case "EMAIL":
          result = user?.email
            ? await sendEmail(user.email, title, body)
            : { success: false, message: "Email not found" };
          break;
        default:
          result = { success: false, message: "Invalid notification type" };
      }

      return { userId, ...result };
    } catch (error) {
      return { userId, success: false, message: error.message };
    }
  });

  const settledResults = await Promise.allSettled(tasks);

  const results = { total: userIds.length, success: 0, failed: 0, details: [] };
  for (const res of settledResults) {
    if (res.status === "fulfilled") {
      results.details.push({
        userId: res.value.userId,
        success: res.value.success,
        message: res.value.message,
      });
      res.value.success ? results.success++ : results.failed++;
    } else {
      results.details.push({
        userId: null,
        success: false,
        message: res.reason?.message || "Unknown error",
      });
      results.failed++;
    }
  }

  return results;
};

// ===== Export all functions =====
export  {
  sendPushNotification,
  sendSMS,
  sendEmail,
  sendWhatsApp,
  registerDeviceToken,
  unregisterDeviceToken,
  sendBulkNotifications,
};
