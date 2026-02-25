import nodemailer from "nodemailer";
import logger from "../utils/logger.js";

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // Verify connection
    this.verifyConnection();
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info("SMTP connection established successfully");
    } catch (error) {
      logger.error("Failed to connect to SMTP server", {
        error: error.message,
      });
    }
  }

  /**
   * Send email
   */
  async sendEmail({ to, subject, html, text, attachments = [] }) {
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

      const info = await this.transporter.sendMail(mailOptions);

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
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(user) {
    const { name, email } = user;

    const emailData = {
      to: email,
      subject: "Welcome to RK Electronics!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to RK Electronics!</h1>
            <p style="color: white; opacity: 0.8;">Your Trusted Electronics Partner</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${name},</h2>
            
            <p style="color: #666; line-height: 1.6;">
              Thank you for joining RK Electronics! We're excited to have you on board.
            </p>
            
            <div style="background: white; border-radius: 10px; padding: 20px; margin: 30px 0; border: 1px solid #e0e0e0;">
              <h3 style="color: #333; margin-top: 0;">Here's what you can do:</h3>
              <ul style="color: #666; line-height: 1.8;">
                <li>Browse our wide range of electronics products</li>
                <li>Enjoy fast delivery to your location</li>
                <li>Get exclusive deals and offers</li>
                <li>Earn rewards with every purchase</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL || "https://rkelectronics.com"}/dashboard" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 12px 30px; 
                        text-decoration: none; 
                        border-radius: 25px;
                        font-weight: bold;
                        display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6;">
              If you have any questions, feel free to contact our support team.
            </p>
          </div>
          
          <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #888;">
            <p>© ${new Date().getFullYear()} RK Electronics. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      `,
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, resetToken) {
    const resetURL = `${process.env.APP_URL || "https://rkelectronics.com"}/auth/reset-password/${resetToken}`;

    const emailData = {
      to: user.email,
      subject: "Reset Your Password - RK Electronics",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Password Reset</h1>
            <p style="color: white; opacity: 0.8;">RK Electronics</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${user.name},</h2>
            
            <p style="color: #666; line-height: 1.6;">
              You recently requested to reset your password for your RK Electronics account.
              Click the button below to reset it.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetURL}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 12px 30px; 
                        text-decoration: none; 
                        border-radius: 25px;
                        font-weight: bold;
                        display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6; font-size: 14px;">
              This password reset link is valid for 10 minutes. If you didn't request a password reset, 
              please ignore this email or contact support if you have concerns.
            </p>
            
            <div style="background: white; border-radius: 10px; padding: 15px; margin: 30px 0; border: 1px solid #e0e0e0;">
              <p style="color: #666; margin: 0; font-size: 12px;">
                <strong>Note:</strong> If the button doesn't work, copy and paste this link in your browser:
              </p>
              <p style="color: #667eea; word-break: break-all; font-size: 12px; margin: 5px 0 0 0;">
                ${resetURL}
              </p>
            </div>
          </div>
          
          <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #888;">
            <p>© ${new Date().getFullYear()} RK Electronics. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      `,
    };

    return await this.sendEmail(emailData);
  }
}

export default new EmailService();
