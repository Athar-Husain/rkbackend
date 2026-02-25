import nodemailer from "nodemailer";
import logger from "../utils/logger.js";

/* =======================
   Transporter
======================= */

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

/* =======================
   Verify SMTP Connection
======================= */

const verifyConnection = async () => {
  try {
    await transporter.verify();
    logger.info("SMTP connection established successfully");
  } catch (error) {
    logger.error("Failed to connect to SMTP server", {
      error: error.message,
    });
  }
};

// Verify on startup
verifyConnection();

/* =======================
   Send Email
======================= */

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  attachments = [],
}) => {
  try {
    if (!to || !subject || (!html && !text)) {
      throw new Error("Missing required email parameters");
    }

    const mailOptions = {
      from:
        process.env.EMAIL_FROM ||
        '"RK Electronics" <noreply@rkelectronics.com>',
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      ...(html && { html }),
      ...(text && { text }),
      ...(attachments.length > 0 && { attachments }),
      headers: {
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
        Importance: "Normal",
      },
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info("Email sent successfully", {
      to: Array.isArray(to)
        ? to.map((t) => t.split("@")[0] + "@***")
        : to.split("@")[0] + "@***",
      subject,
      messageId: info.messageId,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    logger.error("Failed to send email", {
      to,
      subject,
      error: error.message,
    });

    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/* =======================
   Welcome Email
======================= */

export const sendWelcomeEmail = async (user) => {
  const { name, email } = user;

  return sendEmail({
    to: email,
    subject: "Welcome to RK Electronics!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Welcome to RK Electronics!</h1>
          <p style="color: white; opacity: 0.8;">Your Trusted Electronics Partner</p>
        </div>

        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">Hello ${name},</h2>

          <p style="color: #666;">
            Thank you for joining RK Electronics! We're excited to have you on board.
          </p>

          <ul style="color: #666;">
            <li>Browse our wide range of electronics products</li>
            <li>Enjoy fast delivery</li>
            <li>Get exclusive deals</li>
            <li>Earn rewards with every purchase</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || "https://rkelectronics.com"}/dashboard"
               style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px;">
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    `,
  });
};

/* =======================
   Password Reset Email
======================= */

export const sendPasswordResetEmail = async (user, resetToken) => {
  const resetURL = `${
    process.env.APP_URL || "https://rkelectronics.com"
  }/auth/reset-password/${resetToken}`;

  return sendEmail({
    to: user.email,
    subject: "Reset Your Password - RK Electronics",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${user.name},</h2>
        <p>You requested a password reset.</p>

        <a href="${resetURL}"
           style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px;">
          Reset Password
        </a>

        <p style="font-size: 12px;">
          This link is valid for 10 minutes.
        </p>

        <p style="font-size: 12px; word-break: break-all;">
          ${resetURL}
        </p>
      </div>
    `,
  });
};
