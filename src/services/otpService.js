import twilio from "twilio";

/* ---------------- In-Memory Store (DEV ONLY) ---------------- */

const otpStore = new Map();
/*
  key   -> mobile
  value -> { otp, expiresAt }
*/

/* ---------------- Twilio ---------------- */

let twilioClient = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );
}

/* ---------------- Helpers ---------------- */

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/* ---------------- OTP Functions ---------------- */

export const sendOTP = async (mobile, isResend = false) => {
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min

  otpStore.set(mobile, { otp, expiresAt });

  if (twilioClient) {
    await twilioClient.messages.create({
      body: `Your RK Electronics OTP is: ${otp}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${mobile}`,
    });
  } else {
    console.log(`DEV OTP for ${mobile}: ${otp}`);
  }

  return {
    success: true,
    message: isResend ? "OTP resent successfully" : "OTP sent successfully",
    otp: process.env.NODE_ENV === "development" ? otp : undefined,
  };
};

export const verifyOTP = async (mobile, otp) => {
  const record = otpStore.get(mobile);

  if (!record) {
    return { success: false, error: "OTP not found or expired" };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(mobile);
    return { success: false, error: "OTP expired" };
  }

  if (record.otp !== otp) {
    return { success: false, error: "Invalid OTP" };
  }

  otpStore.delete(mobile);

  return { success: true, message: "OTP verified successfully" };
};

export const checkOTPExists = async (mobile) => {
  const record = otpStore.get(mobile);
  return record && Date.now() < record.expiresAt;
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
