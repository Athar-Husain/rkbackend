import admin from "firebase-admin";
import nodemailer from "nodemailer";
import twilio from "twilio";
import fs from "fs"; // Required to read the Firebase service account JSON
import User from "../models/User.model.js";
import NotificationLog from "../models/NotificationLog.js";

// Initialize Firebase Admin SDK
let firebaseInitialized = false;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
  try {
    // In ES6, we read JSON files manually
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

// Initialize Twilio for SMS
let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );
}

// Initialize email transporter
let emailTransporter;
if (
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS
) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

class NotificationService {
  // Send push notification to user
  static async sendPushNotification(userId, title, body, data = {}) {
    try {
      if (!firebaseInitialized) {
        console.log("Firebase not initialized, skipping push notification");
        return { success: false, message: "Firebase not configured" };
      }

      const user = await User.findById(userId);

      if (!user || !user.deviceTokens || user.deviceTokens.length === 0) {
        return { success: false, message: "User has no device tokens" };
      }

      // Get active device tokens
      const tokens = user.deviceTokens
        .filter(
          (token) =>
            token.token &&
            token.lastActive > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        )
        .map((token) => token.token);

      if (tokens.length === 0) {
        return { success: false, message: "No active device tokens found" };
      }

      const message = {
        notification: { title, body },
        data: data,
        tokens: tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      // Log the notification
      await this.logNotification(userId, "PUSH", title, body, {
        successCount: response.successCount,
        failureCount: response.failureCount,
        data: data,
      });

      return {
        success: true,
        sent: response.successCount,
        failed: response.failureCount,
        response: response.responses,
      };
    } catch (error) {
      console.error("Error sending push notification:", error);
      await this.logNotification(userId, "PUSH", title, body, {
        error: error.message,
        data: data,
      });
      throw new Error("Failed to send push notification");
    }
  }

  // Send SMS notification
  static async sendSMS(mobile, message) {
    try {
      if (!twilioClient) {
        console.log(`SMS not sent (Twilio not configured): ${message}`);
        return { success: false, message: "SMS service not configured" };
      }

      const sms = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${mobile}`,
      });

      const user = await User.findOne({ mobile });
      if (user) {
        await this.logNotification(
          user._id,
          "SMS",
          "SMS Notification",
          message,
          {
            mobile,
            sid: sms.sid,
          },
        );
      }

      return { success: true, sid: sms.sid, message: "SMS sent successfully" };
    } catch (error) {
      console.error("Error sending SMS:", error);
      throw new Error("Failed to send SMS");
    }
  }

  // Send email notification
  static async sendEmail(email, subject, htmlContent, textContent = "") {
    try {
      if (!emailTransporter) {
        console.log(`Email not sent (Service not configured): ${subject}`);
        return { success: false, message: "Email service not configured" };
      }

      const mailOptions = {
        from: `"RK Electronics" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        text: textContent,
        html: htmlContent,
      };

      const info = await emailTransporter.sendMail(mailOptions);

      const user = await User.findOne({ email });
      if (user) {
        await this.logNotification(user._id, "EMAIL", subject, textContent, {
          email,
          messageId: info.messageId,
        });
      }

      return {
        success: true,
        messageId: info.messageId,
        message: "Email sent successfully",
      };
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send email");
    }
  }

  // Send WhatsApp message
  static async sendWhatsApp(mobile, message) {
    try {
      if (!twilioClient) {
        console.log(`WhatsApp not sent (Twilio not configured): ${message}`);
        return { success: false, message: "WhatsApp service not configured" };
      }

      const whatsapp = await twilioClient.messages.create({
        body: message,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:+91${mobile}`,
      });

      const user = await User.findOne({ mobile });
      if (user) {
        await this.logNotification(
          user._id,
          "WHATSAPP",
          "WhatsApp Notification",
          message,
          {
            mobile,
            sid: whatsapp.sid,
          },
        );
      }

      return {
        success: true,
        sid: whatsapp.sid,
        message: "WhatsApp sent successfully",
      };
    } catch (error) {
      console.error("Error sending WhatsApp:", error);
      throw new Error("Failed to send WhatsApp message");
    }
  }

  // Send bulk notifications
  static async sendBulkNotifications(
    userIds,
    title,
    body,
    type = "PUSH",
    data = {},
  ) {
    try {
      const results = {
        total: userIds.length,
        success: 0,
        failed: 0,
        details: [],
      };

      for (const userId of userIds) {
        try {
          let result;
          const user = await User.findById(userId);

          switch (type) {
            case "PUSH":
              result = await this.sendPushNotification(
                userId,
                title,
                body,
                data,
              );
              break;
            case "SMS":
              result =
                user && user.mobile
                  ? await this.sendSMS(user.mobile, body)
                  : { success: false, message: "Mobile not found" };
              break;
            case "EMAIL":
              result =
                user && user.email
                  ? await this.sendEmail(user.email, title, body)
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
          results.details.push({
            userId,
            success: false,
            message: error.message,
          });
          results.failed++;
        }
      }
      return results;
    } catch (error) {
      console.error("Error in bulk notification:", error);
      throw new Error("Failed to send bulk notifications");
    }
  }

  // Log notification
  static async logNotification(userId, type, title, content, metadata = {}) {
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
  }

  // Register device token
  static async registerDeviceToken(userId, token, platform = "android") {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      const existingTokenIndex = user.deviceTokens.findIndex(
        (t) => t.token === token,
      );

      if (existingTokenIndex !== -1) {
        user.deviceTokens[existingTokenIndex].platform = platform;
        user.deviceTokens[existingTokenIndex].lastActive = new Date();
      } else {
        user.deviceTokens.push({ token, platform, lastActive: new Date() });
      }

      await user.save();
      return { success: true, message: "Token registered" };
    } catch (error) {
      throw new Error("Failed to register device token");
    }
  }

  // Unregister device token
  static async unregisterDeviceToken(userId, token) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      user.deviceTokens = user.deviceTokens.filter((t) => t.token !== token);
      await user.save();

      return { success: true, message: "Token unregistered" };
    } catch (error) {
      throw new Error("Failed to unregister device token");
    }
  }
}

export default NotificationService;
