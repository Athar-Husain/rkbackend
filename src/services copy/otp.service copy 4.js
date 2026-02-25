import crypto from "crypto";
import OTP from "../models/Otp.model.js";
import { sendEmail } from "./email.service.js";
import { sendSMS } from "./sms.service.js";
import logger from "../utils/logger.js";

const OTP_EXPIRY_MINUTES = 10;
const MAX_DAILY_OTP = 10;
const MAX_HOURLY_OTP = 5;
const COOLDOWN_MINUTES = 1;

class OTPService {
  /**
   * Generate cryptographically secure OTP
   */
  static generateOTP(length = 6) {
    const digits = "0123456789";
    let otp = "";

    // Use crypto.randomBytes for secure random numbers
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      otp += digits[randomBytes[i] % digits.length];
    }

    return otp;
  }

  /**
   * Send OTP to email/mobile
   */
  static async sendOTP({ identifier, type, purpose, metadata = {} }) {
    try {
      // Validate input
      if (!identifier || !type || !purpose) {
        throw new Error("Missing required parameters");
      }

      // Clean up old OTPs
      await OTP.cleanupOldOTPs(identifier, purpose);

      // Check rate limits
      await this.checkRateLimits(identifier, purpose);

      // Check cooldown
      await this.checkCooldown(identifier, purpose);

      // Generate OTP
      const otp = this.generateOTP();

      // Calculate expiry
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // Delete previous unverified OTPs
      await OTP.deleteMany({
        identifier,
        purpose,
        verified: false,
      });

      // Create new OTP record
      const otpRecord = await OTP.create({
        identifier,
        type,
        otp,
        purpose,
        expiresAt,
        metadata,
      });

      // Send OTP based on type
      let sent = false;
      if (type === "email") {
        sent = await this.sendOTPEmail(identifier, otp, purpose);
      } else if (type === "mobile") {
        sent = await this.sendOTPSMS(identifier, otp, purpose);
      }

      if (!sent) {
        await OTP.deleteOne({ _id: otpRecord._id });
        throw new Error("Failed to send OTP");
      }

      logger.info("OTP sent successfully", {
        identifier: this.maskIdentifier(identifier, type),
        type,
        purpose,
      });

      return {
        success: true,
        message: "OTP sent successfully",
        expiresIn: OTP_EXPIRY_MINUTES * 60, // in seconds
        // In test environment, return OTP for testing
        ...(process.env.NODE_ENV === "development" && { testOtp: otp }),
      };
    } catch (error) {
      logger.error("Failed to send OTP", {
        error: error.message,
        identifier: this.maskIdentifier(identifier, type),
        type,
        purpose,
      });

      throw error;
    }
  }

  /**
   * Verify OTP
   */
  static async verifyOTP({ identifier, type, otp, purpose }) {
    try {
      // Find valid OTP record
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

      // Check max attempts
      if (otpRecord.isMaxAttemptsReached) {
        await OTP.deleteOne({ _id: otpRecord._id });
        throw new Error("Maximum attempts reached. Please request new OTP.");
      }

      // Verify OTP
      const isValid = await otpRecord.compareOTP(otp);

      if (!isValid) {
        // Increment attempts
        await otpRecord.incrementAttempts();

        const remainingAttempts = 5 - otpRecord.attempts;
        throw new Error(
          `Invalid OTP. ${remainingAttempts} attempts remaining.`,
        );
      }

      // Mark as verified
      otpRecord.verified = true;
      await otpRecord.save();

      logger.info("OTP verified successfully", {
        identifier: this.maskIdentifier(identifier, type),
        type,
        purpose,
      });

      return {
        success: true,
        message: "OTP verified successfully",
      };
    } catch (error) {
      logger.error("OTP verification failed", {
        error: error.message,
        identifier: this.maskIdentifier(identifier, type),
        type,
        purpose,
      });

      throw error;
    }
  }

  /**
   * Resend OTP
   */
  static async resendOTP({ identifier, type, purpose, metadata = {} }) {
    try {
      // Find existing OTP
      const existingOTP = await OTP.findOne({
        identifier,
        type,
        purpose,
        verified: false,
        expiresAt: { $gt: new Date() },
      });

      if (existingOTP) {
        // Check retry count
        if (existingOTP.retryCount >= 3) {
          throw new Error(
            "Maximum resend attempts reached. Please wait and try again.",
          );
        }

        // Increment retry count
        await existingOTP.incrementRetryCount();

        // Send the existing OTP
        const otp = await this.getOTPValue(existingOTP._id);

        let sent = false;
        if (type === "email") {
          sent = await this.sendOTPEmail(identifier, otp, purpose);
        } else if (type === "mobile") {
          sent = await this.sendOTPSMS(identifier, otp, purpose);
        }

        if (!sent) {
          throw new Error("Failed to resend OTP");
        }

        return {
          success: true,
          message: "OTP resent successfully",
          expiresIn: Math.floor((existingOTP.expiresAt - new Date()) / 1000),
        };
      }

      // If no existing OTP, create new one
      return await this.sendOTP({
        identifier,
        type,
        purpose,
        metadata,
      });
    } catch (error) {
      logger.error("Failed to resend OTP", {
        error: error.message,
        identifier: this.maskIdentifier(identifier, type),
        type,
        purpose,
      });

      throw error;
    }
  }

  /**
   * Check rate limits
   */
  static async checkRateLimits(identifier, purpose) {
    try {
      // Check daily limit
      const dailyCount = await OTP.getRecentOTPCount(identifier, purpose, 24);
      if (dailyCount >= MAX_DAILY_OTP) {
        throw new Error("Daily OTP limit reached. Please try again tomorrow.");
      }

      // Check hourly limit
      const hourlyCount = await OTP.getRecentOTPCount(identifier, purpose, 1);
      if (hourlyCount >= MAX_HOURLY_OTP) {
        throw new Error("Too many OTP requests. Please try again in an hour.");
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check cooldown period
   */
  static async checkCooldown(identifier, purpose) {
    try {
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

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get OTP value (only for testing)
   */
  static async getOTPValue(otpId) {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("OTP value retrieval only allowed in test environment");
    }

    const otpRecord = await OTP.findById(otpId).select("+otp");
    if (!otpRecord) {
      throw new Error("OTP not found");
    }

    return otpRecord.otp;
  }

  /**
   * Send OTP via email
   */
  static async sendOTPEmail(email, otp, purpose) {
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
      return true;
    } catch (error) {
      logger.error("Failed to send OTP email", { email, error: error.message });
      return false;
    }
  }

  /**
   * Send OTP via SMS
   */
  static async sendOTPSMS(mobile, otp, purpose) {
    try {
      const message = `Your RK Electronics OTP for ${purpose} is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`;

      // Use your SMS provider here (Twilio, AWS SNS, etc.)
      // For now, we'll log it in development
      if (process.env.NODE_ENV !== "production") {
        logger.info(`SMS OTP to ${mobile}: ${otp}`);
        return true;
      }

      // Production SMS sending
      // await sendSMS({ to: mobile, message });
      return true;
    } catch (error) {
      logger.error("Failed to send OTP SMS", { mobile, error: error.message });
      return false;
    }
  }

  /**
   * Mask identifier for logging
   */
  static maskIdentifier(identifier, type) {
    if (type === "email") {
      const [local, domain] = identifier.split("@");
      return `${local[0]}***@${domain}`;
    } else if (type === "mobile") {
      return `${identifier.slice(0, 3)}***${identifier.slice(-3)}`;
    }
    return identifier;
  }
}

export default OTPService;
