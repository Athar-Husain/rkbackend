import redis from "redis";
import twilio from "twilio";

/* -------------------- Redis Client -------------------- */

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
  },
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

await redisClient.connect();

/* -------------------- Twilio Client -------------------- */

let twilioClient = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );
}

/* -------------------- Helpers -------------------- */

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/* -------------------- OTP Functions -------------------- */

export const sendOTP = async (mobile, isResend = false) => {
  try {
    const otp = generateOTP();

    await redisClient.setEx(`otp:${mobile}`, 600, otp);

    if (twilioClient) {
      const message = await twilioClient.messages.create({
        body: `Your RK Electronics OTP is: ${otp}. Valid for 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${mobile}`,
      });

      console.log(`OTP sent to ${mobile}: ${message.sid}`);
    } else {
      console.log(`OTP for ${mobile}: ${otp} (Twilio not configured)`);
    }

    return {
      success: true,
      message: isResend ? "OTP resent successfully" : "OTP sent successfully",
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    };
  } catch (error) {
    console.error("Error sending OTP:", error);
    throw new Error("Failed to send OTP");
  }
};

export const verifyOTP = async (mobile, otp) => {
  try {
    const storedOTP = await redisClient.get(`otp:${mobile}`);

    if (!storedOTP) {
      return { success: false, error: "OTP expired or not found" };
    }

    if (storedOTP !== otp) {
      return { success: false, error: "Invalid OTP" };
    }

    await redisClient.del(`otp:${mobile}`);

    return { success: true, message: "OTP verified successfully" };
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw new Error("Failed to verify OTP");
  }
};

export const checkOTPExists = async (mobile) => {
  try {
    return (await redisClient.exists(`otp:${mobile}`)) === 1;
  } catch (error) {
    console.error("Error checking OTP:", error);
    return false;
  }
};

export const generatePurposeOTP = async (
  mobile,
  purpose,
  expiryMinutes = 30,
) => {
  try {
    const otp = generateOTP();
    const key = `otp:${purpose}:${mobile}`;

    await redisClient.setEx(key, expiryMinutes * 60, otp);

    if (twilioClient) {
      await twilioClient.messages.create({
        body: `Your RK Electronics ${purpose} OTP is: ${otp}. Valid for ${expiryMinutes} minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${mobile}`,
      });
    } else {
      console.log(`${purpose} OTP for ${mobile}: ${otp}`);
    }

    return { success: true, message: `${purpose} OTP sent successfully` };
  } catch (error) {
    console.error(`Error generating ${purpose} OTP:`, error);
    throw new Error(`Failed to generate ${purpose} OTP`);
  }
};

export const verifyPurposeOTP = async (mobile, purpose, otp) => {
  try {
    const key = `otp:${purpose}:${mobile}`;
    const storedOTP = await redisClient.get(key);

    if (!storedOTP) {
      return { success: false, error: "OTP expired or not found" };
    }

    if (storedOTP !== otp) {
      return { success: false, error: "Invalid OTP" };
    }

    await redisClient.del(key);

    return {
      success: true,
      message: `${purpose} OTP verified successfully`,
    };
  } catch (error) {
    console.error(`Error verifying ${purpose} OTP:`, error);
    throw new Error(`Failed to verify ${purpose} OTP`);
  }
};
