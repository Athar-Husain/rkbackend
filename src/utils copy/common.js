// const crypto = require("crypto");
// const qr = require("qr-image");

import crypto from "crypto";
import qr from "qr-image";

// Generate OTP
export const generateOTP = (length = 6) => {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

// Generate unique ID
export const generateUniqueId = (prefix = "RK") => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}${timestamp}${random}`.toUpperCase();
};

// Encrypt data
export const encrypt = (text) => {
  const cipher = crypto.createCipher("aes-256-cbc", process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
};

// Decrypt data
export const decrypt = (encryptedText) => {
  const decipher = crypto.createDecipher(
    "aes-256-cbc",
    process.env.ENCRYPTION_KEY,
  );
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

// Generate QR code
export const generateQRCode = (data) => {
  try {
    const qr_png = qr.imageSync(data, { type: "png", size: 10 });
    return `data:image/png;base64,${qr_png.toString("base64")}`;
  } catch (error) {
    console.error("Error generating QR code:", error);
    return null;
  }
};

// Format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Calculate distance between coordinates (Haversine formula)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
};

// Slugify string
export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
};

// Validate Indian mobile number
export const isValidIndianMobile = (mobile) => {
  const regex = /^[6-9]\d{9}$/;
  return regex.test(mobile);
};

// Paginate array
export const paginate = (array, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  const results = {};

  if (endIndex < array.length) {
    results.next = {
      page: page + 1,
      limit: limit,
    };
  }

  if (startIndex > 0) {
    results.previous = {
      page: page - 1,
      limit: limit,
    };
  }

  results.total = array.length;
  results.pages = Math.ceil(array.length / limit);
  results.results = array.slice(startIndex, endIndex);

  return results;
};

// Calculate age in days
export const getDaysDifference = (date1, date2 = new Date()) => {
  const diffTime = Math.abs(date2 - date1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
