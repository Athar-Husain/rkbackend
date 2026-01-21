// const { body, param, query, validationResult } = require("express-validator");

import { body, param, query, validationResult } from "express-validator";

// Validation middleware
export const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors
    const extractedErrors = [];
    errors.array().map((err) =>
      extractedErrors.push({
        field: err.param,
        message: err.msg,
      }),
    );

    return res.status(400).json({
      success: false,
      errors: extractedErrors,
    });
  };
};

// User registration validation
export const validateRegistration = [
  body("mobile")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please enter a valid Indian mobile number")
    .custom(async (value) => {
      const User = require("../models/User.model.js");
      const user = await User.findOne({ mobile: value });
      if (user) {
        throw new Error("Mobile number already registered");
      }
      return true;
    }),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),

  body("city").trim().notEmpty().withMessage("City is required"),

  body("area").trim().notEmpty().withMessage("Area is required"),

  body("referralCode")
    .optional()
    .trim()
    .custom(async (value) => {
      if (value) {
        const User = require("../models/User.model.js");
        const referrer = await User.findOne({ referralCode: value });
        if (!referrer) {
          throw new Error("Invalid referral code");
        }
      }
      return true;
    }),
];

// OTP validation
export const validateOTP = [
  body("mobile")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please enter a valid Indian mobile number"),

  body("otp")
    .isLength({ min: 4, max: 6 })
    .withMessage("OTP must be 4-6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),
];

// Product creation validation
export const validateProduct = [
  body("sku").trim().notEmpty().withMessage("SKU is required"),

  body("name").trim().notEmpty().withMessage("Product name is required"),

  body("category")
    .isIn([
      "MOBILE",
      "TELEVISION",
      "AC",
      "REFRIGERATOR",
      "WASHING_MACHINE",
      "AUDIO",
      "KITCHEN_APPLIANCE",
      "LAPTOP",
      "CAMERA",
      "ACCESSORY",
    ])
    .withMessage("Invalid product category"),

  body("brand").trim().notEmpty().withMessage("Brand is required"),

  body("mrp").isFloat({ min: 0 }).withMessage("MRP must be a positive number"),

  body("sellingPrice")
    .isFloat({ min: 0 })
    .withMessage("Selling price must be a positive number"),
];

// Coupon creation validation
export const validateCoupon = [
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Coupon code is required")
    .isUppercase()
    .withMessage("Coupon code must be uppercase"),

  body("title").trim().notEmpty().withMessage("Coupon title is required"),

  body("value")
    .isFloat({ min: 0 })
    .withMessage("Value must be a positive number"),

  body("minPurchaseAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum purchase must be a positive number"),

  body("validFrom").isISO8601().withMessage("Valid from must be a valid date"),

  body("validUntil")
    .isISO8601()
    .withMessage("Valid until must be a valid date")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.validFrom)) {
        throw new Error("Valid until must be after valid from");
      }
      return true;
    }),
];

// Purchase recording validation
export const validatePurchase = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isMongoId()
    .withMessage("Invalid User ID"),

  body("storeId")
    .notEmpty()
    .withMessage("Store ID is required")
    .isMongoId()
    .withMessage("Invalid Store ID"),

  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item is required"),

  body("items.*.productId")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Invalid Product ID"),

  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),

  body("items.*.unitPrice")
    .isFloat({ min: 0 })
    .withMessage("Unit price must be a positive number"),

  body("payment.method")
    .isIn(["CASH", "CARD", "UPI", "CHEQUE", "EMI", "WALLET"])
    .withMessage("Invalid payment method"),
];
