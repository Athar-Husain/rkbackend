// src/services/sms.service.js
import logger from "../utils/logger.js";

/* =======================
   Provider Config
======================= */

const SMS_PROVIDER = process.env.SMS_PROVIDER || "test";

/* =======================
   Helpers
======================= */

const validateMobile = (to) => {
  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(to)) {
    throw new Error("Invalid mobile number");
  }
};

/* =======================
   Provider Implementations
======================= */

const sendViaTwilio = async (to, message) => {
  // TODO: Real Twilio implementation
  logger.info(`[Twilio] SMS to ${to}: ${message}`);
  return { messageId: `twilio_${Date.now()}` };
};

const sendViaAWS = async (to, message, templateId) => {
  // TODO: Real AWS SNS implementation
  logger.info(`[AWS SNS] SMS to ${to}: ${message}`);
  return { messageId: `aws_${Date.now()}` };
};

const sendViaTest = async (to, message) => {
  logger.info(`[Test SMS] To: ${to}, Message: ${message}`);
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    messageId: `test_${Date.now()}`,
    note: "SMS logged for testing. Configure SMS provider for production.",
  };
};

/* =======================
   Core SMS Sender
======================= */

export const sendSMS = async ({ to, message, templateId = null }) => {
  try {
    if (!to || !message) {
      throw new Error("Missing required SMS parameters");
    }

    validateMobile(to);

    let result;

    switch (SMS_PROVIDER) {
      case "twilio":
        result = await sendViaTwilio(to, message);
        break;
      case "aws":
        result = await sendViaAWS(to, message, templateId);
        break;
      case "test":
      default:
        result = await sendViaTest(to, message);
        break;
    }

    logger.info("SMS sent successfully", {
      to: `${to.slice(0, 3)}***${to.slice(-3)}`,
      provider: SMS_PROVIDER,
      messageLength: message.length,
    });

    return {
      success: true,
      provider: SMS_PROVIDER,
      ...result,
    };
  } catch (error) {
    logger.error("Failed to send SMS", {
      to,
      provider: SMS_PROVIDER,
      error: error.message,
    });

    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

/* =======================
   High-level SMS Helpers
======================= */

export const sendOTP = async (to, otp, purpose) => {
  const purposeText =
    {
      SIGNUP: "sign up",
      LOGIN: "login",
      PASSWORD_RESET: "password reset",
      VERIFICATION: "verification",
    }[purpose] || "verification";

  const message = `Your RK Electronics OTP for ${purposeText} is ${otp}. Valid for 10 minutes. Do not share with anyone.`;

  return sendSMS({ to, message });
};

export const sendWelcomeSMS = async (to, userName) => {
  const message = `Welcome ${userName} to RK Electronics! Thank you for joining us. Download our app for better experience: ${
    process.env.APP_DOWNLOAD_URL || "https://rkelectronics.com/app"
  }`;

  return sendSMS({ to, message });
};

export const sendTransactionSMS = async (
  to,
  amount,
  transactionId,
  type = "payment",
) => {
  const typeText = type === "payment" ? "Payment" : "Refund";

  const message = `Your ${typeText} of ₹${amount} for Transaction ID: ${transactionId} has been successful. Thank you for shopping with RK Electronics.`;

  return sendSMS({ to, message });
};

export const sendDeliveryUpdateSMS = async (to, orderId, status) => {
  const statusMessages = {
    confirmed: "Your order has been confirmed and is being processed.",
    shipped: "Your order has been shipped. Track your delivery in the app.",
    out_for_delivery: "Your order is out for delivery. Please be available.",
    delivered: "Your order has been delivered. Thank you for shopping with us!",
    delayed:
      "Your delivery is delayed. We'll update you with new delivery time.",
  };

  const message = `Order ${orderId}: ${
    statusMessages[status] || "Status updated"
  } - RK Electronics`;

  return sendSMS({ to, message });
};
