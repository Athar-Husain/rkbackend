// services/otp.service.js
import crypto from "crypto";
import OTP from "../models/Otp.model.js";
import { sendEmail } from "./email.service.js";
import { sendSMS } from "./sms.service.js";
import logger from "../utils/logger.js";

const OTP_EXPIRY_MINUTES = 10;
const MAX_DAILY_OTP = 10;
const MAX_HOURLY_OTP = 5;
const COOLDOWN_MINUTES = 1;

/* =====================================================
   HELPERS
===================================================== */

export const generateOTP = (length = 6) => {
  const digits = "0123456789";
  let otp = "";

  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[randomBytes[i] % digits.length];
  }

  return otp;
};

export const maskIdentifierold = (identifier, type) => {
  if (type === "email") {
    const [local, domain] = identifier.split("@");
    return `${local[0]}***@${domain}`;
  }
  if (type === "mobile") {
    return `${identifier.slice(0, 3)}***${identifier.slice(-3)}`;
  }
  return identifier;
};

export const maskIdentifier = (identifier, type) => {
  try {
    // Check if identifier exists
    if (!identifier) {
      console.warn("maskIdentifier: identifier is undefined or null");
      return "***";
    }

    if (type === "email") {
      // Ensure identifier is a string and has @
      const identifierStr = String(identifier);
      if (!identifierStr.includes("@")) {
        console.warn(
          "maskIdentifier: email identifier doesn't contain @:",
          identifierStr,
        );
        return "***@***";
      }

      const [local, domain] = identifierStr.split("@");
      return `${local[0]}***@${domain}`;
    }

    if (type === "mobile") {
      const identifierStr = String(identifier);
      if (identifierStr.length < 10) {
        console.warn(
          "maskIdentifier: mobile identifier too short:",
          identifierStr,
        );
        return "***";
      }
      return `${identifierStr.slice(0, 3)}***${identifierStr.slice(-3)}`;
    }

    return "***";
  } catch (error) {
    console.error("Error in maskIdentifier:", error);
    return "***";
  }
};

/* =====================================================
   RATE LIMITS & COOLDOWN
===================================================== */

export const checkRateLimits = async (identifier, purpose) => {
  const dailyCount = await OTP.getRecentOTPCount(identifier, purpose, 24);
  if (dailyCount >= MAX_DAILY_OTP) {
    throw new Error("Daily OTP limit reached. Please try again tomorrow.");
  }

  const hourlyCount = await OTP.getRecentOTPCount(identifier, purpose, 1);
  if (hourlyCount >= MAX_HOURLY_OTP) {
    throw new Error("Too many OTP requests. Please try again in an hour.");
  }
};

export const checkCooldown = async (identifier, purpose) => {
  const oneMinuteAgo = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000);

  const recentOTP = await OTP.findOne({
    identifier,
    purpose,
    createdAt: { $gte: oneMinuteAgo },
  });

  if (recentOTP) {
    const secondsLeft = Math.ceil(
      (COOLDOWN_MINUTES * 60 * 1000 - (Date.now() - recentOTP.createdAt)) /
        1000,
    );

    throw new Error(
      `Please wait ${secondsLeft} seconds before requesting new OTP.`,
    );
  }
};

/* =====================================================
   SEND OTP
===================================================== */

export const sendOTP = async ({ identifier, type, purpose, metadata = {} }) => {
  try {
    if (!identifier || !type || !purpose) {
      throw new Error("Missing required parameters");
    }

    await OTP.cleanupOldOTPs(identifier, purpose);
    await checkRateLimits(identifier, purpose);
    await checkCooldown(identifier, purpose);

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await OTP.deleteMany({
      identifier,
      purpose,
      verified: false,
    });

    const otpRecord = await OTP.create({
      identifier,
      type,
      otp,
      purpose,
      expiresAt,
      metadata,
    });

    let sent = false;
    if (type === "email") {
      sent = await sendOTPEmail(identifier, otp, purpose);
    } else if (type === "mobile") {
      sent = await sendOTPSMS(identifier, otp, purpose);
    }

    if (!sent) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw new Error("Failed to send OTP");
    }

    logger.info("OTP sent successfully", {
      identifier: maskIdentifier(identifier, type),
      type,
      purpose,
    });

    return {
      success: true,
      message: "OTP sent successfully",
      expiresIn: OTP_EXPIRY_MINUTES * 60,
      ...(process.env.NODE_ENV === "development" && { testOtp: otp }),
    };
  } catch (error) {
    logger.error("Failed to send OTP", {
      error: error.message,
      identifier: maskIdentifier(identifier, type),
      type,
      purpose,
    });
    throw error;
  }
};

/* =====================================================
   VERIFY OTP
===================================================== */

export const verifyOTPold = async ({ identifier, type, otp, purpose }) => {
  try {
    const otpRecord = await OTP.findOne({
      identifier,
      type,
      purpose,
      verified: false,
      expiresAt: { $gt: new Date() },
    }).select("+otp");

    if (!otpRecord) {
      throw new Error("OTP expired or not found");
    }

    if (otpRecord.isMaxAttemptsReached) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw new Error("Maximum attempts reached. Please request new OTP.");
    }

    const isValid = await otpRecord.compareOTP(otp);

    if (!isValid) {
      await otpRecord.incrementAttempts();
      const remaining = 5 - otpRecord.attempts;
      throw new Error(`Invalid OTP. ${remaining} attempts remaining.`);
    }

    otpRecord.verified = true;
    await otpRecord.save();

    logger.info("OTP verified successfully", {
      identifier: maskIdentifier(identifier, type),
      type,
      purpose,
    });

    return { success: true };
  } catch (error) {
    logger.error("OTP verification failed", {
      error: error.message,
      identifier: maskIdentifier(identifier, type),
      type,
      purpose,
    });
    throw error;
  }
};

export const verifyOTP2 = async ({ identifier, type, otp, purpose }) => {
  try {
    // Validate inputs
    if (!identifier || !type || !otp || !purpose) {
      throw new Error("Missing required parameters for OTP verification");
    }

    console.log(
      `Verifying OTP for ${type}: ${identifier}, purpose: ${purpose}`,
    );

    // Clean identifier
    const cleanIdentifier = identifier.trim().toLowerCase();

    // Find OTP record
    const otpRecord = await OTP.findOne({
      identifier: cleanIdentifier,
      type,
      purpose,
      otp,
      expiresAt: { $gt: new Date() },
    });

    console.log("otpRecord", otpRecord);

    if (!otpRecord) {
      const masked = maskIdentifier(identifier, type);
      console.error(`OTP verification failed for ${masked}`);
      throw new Error("OTP expired or not found");
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    otpRecord.verifiedAt = new Date();
    await otpRecord.save();

    // Delete OTP after successful verification
    await OTP.deleteOne({ _id: otpRecord._id });

    const masked = maskIdentifier(identifier, type);
    console.log(`OTP verified successfully for ${masked}`);
    return true;
  } catch (error) {
    console.error("OTP verification error:", error);
    throw error;
  }
};

export const verifyOTP = async ({ identifier, type, otp, purpose }) => {
  try {
    if (!identifier || !type || !otp || !purpose) {
      throw new Error("Missing required parameters for OTP verification");
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    // 1. Find the record WITHOUT the OTP in the query
    // Use .select("+otp") if your schema has { select: false } on the otp field
    const otpRecord = await OTP.findOne({
      identifier: cleanIdentifier,
      type,
      purpose,
      expiresAt: { $gt: new Date() },
    }).select("+otp");

    // 2. If no record or OTP doesn't match
    // Check if compareOTP exists (meaning it's hashed)
    let isValid = false;
    if (otpRecord) {
      if (typeof otpRecord.compareOTP === "function") {
        isValid = await otpRecord.compareOTP(otp);
      } else {
        isValid = otpRecord.otp === otp;
      }
    }

    if (!otpRecord || !isValid) {
      const masked = maskIdentifier(identifier, type);
      console.error(`OTP verification failed for ${masked}`);
      throw new Error("OTP expired or not found");
    }

    // 3. Mark as used and cleanup
    otpRecord.isUsed = true;
    otpRecord.verifiedAt = new Date();
    await otpRecord.save();

    await OTP.deleteOne({ _id: otpRecord._id });

    return true;
  } catch (error) {
    console.error("OTP verification error:", error);
    throw error;
  }
};

/* =====================================================
   RESEND OTP
===================================================== */

export const resendOTPold = async ({
  identifier,
  type,
  purpose,
  metadata = {},
}) => {
  try {
    const existingOTP = await OTP.findOne({
      identifier,
      type,
      purpose,
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (existingOTP) {
      if (existingOTP.retryCount >= 3) {
        throw new Error(
          "Maximum resend attempts reached. Please wait and try again.",
        );
      }

      await existingOTP.incrementRetryCount();

      const otp = await getOTPValue(existingOTP._id);

      const sent =
        type === "email"
          ? await sendOTPEmail(identifier, otp, purpose)
          : await sendOTPSMS(identifier, otp, purpose);

      if (!sent) {
        throw new Error("Failed to resend OTP");
      }

      return {
        success: true,
        message: "OTP resent successfully",
        expiresIn: Math.floor((existingOTP.expiresAt - new Date()) / 1000),
      };
    }

    return sendOTP({ identifier, type, purpose, metadata });
  } catch (error) {
    logger.error("Failed to resend OTP", {
      error: error.message,
      identifier: maskIdentifier(identifier, type),
      type,
      purpose,
    });
    throw error;
  }
};

/* =====================================================
   INTERNAL HELPERS
===================================================== */

const getOTPValue = async (otpId) => {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("OTP value retrieval only allowed in test environment");
  }

  const otpRecord = await OTP.findById(otpId).select("+otp");
  if (!otpRecord) throw new Error("OTP not found");

  return otpRecord.otp;
};

export const sendOTPEmail = async (email, otp, purpose) => {
  try {
    const purposeText =
      {
        SIGNUP: "Sign Up",
        LOGIN: "Login",
        PASSWORD_RESET: "Password Reset",
        EMAIL_VERIFICATION: "Email Verification",
      }[purpose] || "Verification";

    const emailData = {
      to: email,
      subject: `Your OTP for ${purposeText} - RK Electronics`,
      html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">RK Electronics</h1>
              <p style="color: white; opacity: 0.8;">Your Trusted Electronics Partner</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333; margin-bottom: 20px;">${purposeText} Verification</h2>
              
              <p style="color: #666; line-height: 1.6;">
                Use the following OTP to complete your ${purposeText.toLowerCase()} process.
                This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes.
              </p>
              
              <div style="background: white; border-radius: 10px; padding: 20px; text-align: center; margin: 30px 0; border: 2px dashed #ddd;">
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #333;">
                  ${otp}
                </div>
                <p style="color: #888; font-size: 14px; margin-top: 10px;">
                  Valid for ${OTP_EXPIRY_MINUTES} minutes
                </p>
              </div>
              
              <p style="color: #666; line-height: 1.6;">
                If you didn't request this OTP, please ignore this email or contact support.
              </p>
            </div>
            
            <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #888;">
              <p>© ${new Date().getFullYear()} RK Electronics. All rights reserved.</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        `,
    };

    await sendEmail(emailData);
    // await sendEmail({
    //   to: email,
    //   subject: `Your OTP for ${purposeText} - RK Electronics`,
    //   html: `<h2>Your OTP is ${otp}</h2><p>Valid for ${OTP_EXPIRY_MINUTES} minutes.</p>`,
    // });

    return true;
  } catch (error) {
    logger.error("Failed to send OTP email", {
      email,
      error: error.message,
    });
    return false;
  }
};

export const sendOTPSMS = async (mobile, otp) => {
  try {
    if (process.env.NODE_ENV !== "production") {
      logger.info(`SMS OTP to ${mobile}: ${otp}`);
      return true;
    }

    // await sendSMS({ to: mobile, message });
    return true;
  } catch (error) {
    logger.error("Failed to send OTP SMS", {
      mobile,
      error: error.message,
    });
    return false;
  }
};

/* =====================================================
   NEW: SEND DUAL OTP (EMAIL + MOBILE)
===================================================== */
export const sendDualOTP2 = async ({
  email,
  mobile,
  purpose,
  metadata = {},
}) => {
  try {
    // 1. Cleanup & Rate Limits (Checking email primarily)
    await OTP.cleanupOldOTPs(email, purpose);
    await checkRateLimits(email, purpose);
    await checkCooldown(email, purpose);

    // 2. Generate ONE OTP for both
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    console.log("hittt2777");
    // 3. Create ONE database record
    // We store the mobile in metadata so we can reference it if needed
    const otpRecord = await OTP.create({
      // identifier: email,
      identifier: email.trim().toLowerCase(),
      type: "email", // Primary type
      otp,
      purpose,
      expiresAt,
      metadata: { ...metadata, mobile },
    });

    // 4. Send to both channels
    console.log("hittt222");
    const emailSent = await sendOTPEmail(email, otp, purpose);
    const smsSent = await sendOTPSMS(mobile, otp, purpose);

    if (!emailSent && !smsSent) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw new Error("Failed to send OTP to any channel");
    }

    return {
      success: true,
      expiresIn: OTP_EXPIRY_MINUTES * 60,
      testOtp: process.env.NODE_ENV === "development" ? otp : undefined,
    };
  } catch (error) {
    logger.error("Dual OTP Failure", error);
    console.log("error in sendDualOTP", error.message);
    throw error;
  }
};

export const sendDualOTP = async ({
  email,
  mobile,
  purpose,
  metadata = {},
}) => {
  try {
    // 1. Cleanup & Rate Limits
    await OTP.cleanupOldOTPs(email, purpose);
    await checkRateLimits(email, purpose);
    await checkCooldown(email, purpose);

    // 2. Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // 3. Delete any existing OTPs for this email/purpose
    await OTP.deleteMany({
      identifier: email.toLowerCase(),
      purpose,
      verified: false,
    });

    // 4. Create OTP record (the pre-save hook will hash it)
    const otpRecord = new OTP({
      identifier: email.toLowerCase(),
      type: "email",
      otp: otp, // Store plain OTP - will be hashed by pre-save hook
      purpose,
      expiresAt,
      metadata: { ...metadata, mobile },
    });

    await otpRecord.save();

    // 5. Send to both channels
    const emailSent = await sendOTPEmail(email, otp, purpose);
    const smsSent = await sendOTPSMS(mobile, otp, purpose);

    if (!emailSent && !smsSent) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw new Error("Failed to send OTP to any channel");
    }

    return {
      success: true,
      message: "OTP sent successfully",
      expiresIn: OTP_EXPIRY_MINUTES * 60,
      ...(process.env.NODE_ENV === "development" && { testOtp: otp }),
    };
  } catch (error) {
    logger.error("Dual OTP Failure", error);
    console.log("Error in sendDualOTP:", error.message);
    throw error;
  }
};

/* =====================================================
   DEFAULT EXPORT (BACKWARD COMPATIBLE)
===================================================== */

// export default {
//   sendOTP,
//   verifyOTP,
//   resendOTP,
// };

/* =====================================================
   RESEND OTP (SUPPORTING DUAL CHANNELS)
===================================================== */
export const resendOTP = async ({ email, mobile, purpose, metadata = {} }) => {
  try {
    // If it's a dual-channel request, we primarily track by email
    const identifier = email || mobile;

    const existingOTP = await OTP.findOne({
      identifier,
      purpose,
      verified: false,
      expiresAt: { $gt: new Date() },
    }).select("+otp");

    if (existingOTP) {
      if (existingOTP.retryCount >= 3) {
        throw new Error("Maximum resend attempts reached. Please wait.");
      }

      await existingOTP.incrementRetryCount();

      // Decrypt/Get the plain OTP (In dev you might have it, in prod use the stored hash logic)
      // Since we need the ACTUAL code to resend it:
      // If your compareOTP is bcrypt based, you usually can't "get" the value back.
      // STRATEGY: In this case, it is better to generate a NEW OTP for resend to maintain security.

      return sendDualOTP({ email, mobile, purpose, metadata });
    }

    // If no existing valid OTP, just start fresh
    return sendDualOTP({ email, mobile, purpose, metadata });
  } catch (error) {
    logger.error("Failed to resend OTP", {
      error: error.message,
      email,
      purpose,
    });
    throw error;
  }
};
