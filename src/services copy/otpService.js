const redis = require("redis");
const twilio = require("twilio");



// Create Redis client
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

// Initialize Twilio client
let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

class OTPService {
  // Generate and send OTP
  static async sendOTP(mobile, isResend = false) {
    try {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP in Redis with expiration (10 minutes)
      await redisClient.setEx(`otp:${mobile}`, 600, otp);

      // If Twilio is configured, send SMS
      if (twilioClient) {
        const message = await twilioClient.messages.create({
          body: `Your RK Electronics OTP is: ${otp}. Valid for 10 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${mobile}`,
        });

        console.log(`OTP sent to ${mobile} via Twilio: ${message.sid}`);
      } else {
        // In development, log OTP to console
        console.log(`OTP for ${mobile}: ${otp} (Twilio not configured)`);
      }

      return {
        success: true,
        message: isResend ? "OTP resent successfully" : "OTP sent successfully",
        otp: process.env.NODE_ENV === "development" ? otp : undefined, // Only return in dev
      };
    } catch (error) {
      console.error("Error sending OTP:", error);
      throw new Error("Failed to send OTP");
    }
  }

  // Verify OTP
  static async verifyOTP(mobile, otp) {
    try {
      // Get stored OTP from Redis
      const storedOTP = await redisClient.get(`otp:${mobile}`);

      if (!storedOTP) {
        return {
          success: false,
          error: "OTP expired or not found",
        };
      }

      if (storedOTP !== otp) {
        return {
          success: false,
          error: "Invalid OTP",
        };
      }

      // OTP verified successfully, delete from Redis
      await redisClient.del(`otp:${mobile}`);

      return {
        success: true,
        message: "OTP verified successfully",
      };
    } catch (error) {
      console.error("Error verifying OTP:", error);
      throw new Error("Failed to verify OTP");
    }
  }

  // Check if OTP exists (for resend)
  static async checkOTPExists(mobile) {
    try {
      const exists = await redisClient.exists(`otp:${mobile}`);
      return exists === 1;
    } catch (error) {
      console.error("Error checking OTP:", error);
      return false;
    }
  }

  // Generate OTP for specific purpose (password reset, etc.)
  static async generatePurposeOTP(mobile, purpose, expiryMinutes = 30) {
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const key = `otp:${purpose}:${mobile}`;

      await redisClient.setEx(key, expiryMinutes * 60, otp);

      // Send OTP via SMS
      if (twilioClient) {
        const message = await twilioClient.messages.create({
          body: `Your RK Electronics ${purpose} OTP is: ${otp}. Valid for ${expiryMinutes} minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${mobile}`,
        });

        console.log(`${purpose} OTP sent to ${mobile}: ${message.sid}`);
      } else {
        console.log(`${purpose} OTP for ${mobile}: ${otp}`);
      }

      return {
        success: true,
        message: `${purpose} OTP sent successfully`,
      };
    } catch (error) {
      console.error(`Error generating ${purpose} OTP:`, error);
      throw new Error(`Failed to generate ${purpose} OTP`);
    }
  }

  // Verify purpose OTP
  static async verifyPurposeOTP(mobile, purpose, otp) {
    try {
      const key = `otp:${purpose}:${mobile}`;
      const storedOTP = await redisClient.get(key);

      if (!storedOTP) {
        return {
          success: false,
          error: "OTP expired or not found",
        };
      }

      if (storedOTP !== otp) {
        return {
          success: false,
          error: "Invalid OTP",
        };
      }

      // Delete OTP after successful verification
      await redisClient.del(key);

      return {
        success: true,
        message: `${purpose} OTP verified successfully`,
      };
    } catch (error) {
      console.error(`Error verifying ${purpose} OTP:`, error);
      throw new Error(`Failed to verify ${purpose} OTP`);
    }
  }
}

module.exports = OTPService;
