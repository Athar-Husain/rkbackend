import mongoose from "mongoose";
import User from "../models/User.model.js";
import Coupon from "../models/Coupon.model.js";
import Purchase from "../models/Purchase.model.js";
import UserCoupon from "../models/UserCoupon.model.js";
import Referral from "../models/Referral.model.js";

/* =====================================================
   PRODUCT RULE VALIDATION
===================================================== */
export const validateProductRules = (coupon, purchaseItems = []) => {
  if (!coupon?.productRules) return true;
  const {
    type,
    categories = [],
    brands = [],
    products = [],
  } = coupon.productRules;
  if (type === "ALL_PRODUCTS") return true;
  return purchaseItems.some((item) => {
    if (type === "CATEGORY") return categories.includes(item.category);
    if (type === "BRAND") return brands.includes(item.brand);
    if (type === "PRODUCT") {
      return products.some((pId) =>
        pId.equals
          ? pId.equals(item.productId)
          : pId.toString() === item.productId.toString(),
      );
    }
    return false;
  });
};

/**
 * Geographic eligibility – no changes needed, already efficient.
 */
export const checkGeographicEligibility = async (user, coupon) => {
  const result = { eligible: true, reasons: [], conditions: {} };
  const geo = coupon?.targeting?.geographic;
  if (!geo) return result;

  if (geo.cities?.length) {
    const match = geo.cities.some((cityId) =>
      cityId.equals
        ? cityId.equals(user.city)
        : cityId.toString() === user.city?.toString(),
    );
    if (!match) {
      result.eligible = false;
      result.reasons.push("Coupon not available in your city");
    } else {
      result.conditions.cities = geo.cities;
    }
  }

  if (geo.areas?.length) {
    const match = geo.areas.some((areaId) =>
      areaId.equals
        ? areaId.equals(user.area)
        : areaId.toString() === user.area?.toString(),
    );
    if (!match) {
      result.eligible = false;
      result.reasons.push("Coupon not available in your area");
    } else {
      result.conditions.areas = geo.areas;
    }
  }

  if (geo.stores?.length) {
    result.conditions.stores = geo.stores;
  }
  return result;
};

/**
 * Purchase history eligibility – rewritten with aggregation for maximum performance.
 * @param {ObjectId} userId
 * @param {Object} rules – from coupon.targeting.purchaseHistory
 * @param {Object} options – optionally pass pre‑fetched purchase stats (used in batch checks)
 */
export const checkPurchaseHistoryEligibility = async (
  userId,
  rules,
  preFetched = null,
) => {
  const result = { eligible: true, reasons: [], conditions: {} };
  if (!rules) return result;

  // If pre‑fetched aggregate data is provided, use it (batch mode)
  if (preFetched) {
    const { totalSpent, purchaseCount, categoriesBought } = preFetched;
    if (rules.minPurchases > 0 && purchaseCount < rules.minPurchases) {
      result.eligible = false;
      result.reasons.push(`Minimum ${rules.minPurchases} purchase(s) required`);
    }
    if (rules.minTotalSpent > 0 && totalSpent < rules.minTotalSpent) {
      result.eligible = false;
      result.reasons.push(`Minimum spend of ₹${rules.minTotalSpent} required`);
    }
    if (rules.categories?.length) {
      const hasCategory = rules.categories.some((cat) =>
        categoriesBought.includes(cat),
      );
      if (!hasCategory) {
        result.eligible = false;
        result.reasons.push(
          `Required purchase in categories: ${rules.categories.join(", ")}`,
        );
      } else {
        result.conditions.categories = rules.categories;
      }
    }
    result.conditions.minTotalSpent = rules.minTotalSpent;
    result.conditions.currentTotalSpent = totalSpent;
    return result;
  }

  // Single‑coupon check – perform aggregation on the fly
  const matchStage = {
    userId: new mongoose.Types.ObjectId(userId),
    status: "COMPLETED",
  };
  if (rules.timeFrame && rules.timeFrame !== "ALL_TIME") {
    const days =
      { LAST_7_DAYS: 7, LAST_30_DAYS: 30, LAST_90_DAYS: 90 }[rules.timeFrame] ||
      3650;
    matchStage.createdAt = { $gte: new Date(Date.now() - days * 86400000) };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $facet: {
        totalStats: [
          {
            $group: {
              _id: null,
              totalSpent: { $sum: "$finalAmount" },
              purchaseCount: { $sum: 1 },
            },
          },
        ],
        categories: [
          { $unwind: "$items" },
          {
            $group: { _id: null, categories: { $addToSet: "$items.category" } },
          },
        ],
      },
    },
  ];

  const [stats] = await Purchase.aggregate(pipeline);
  const totalSpent = stats.totalStats[0]?.totalSpent || 0;
  const purchaseCount = stats.totalStats[0]?.purchaseCount || 0;
  const categoriesBought = stats.categories[0]?.categories || [];

  if (rules.minPurchases > 0 && purchaseCount < rules.minPurchases) {
    result.eligible = false;
    result.reasons.push(`Minimum ${rules.minPurchases} purchase(s) required`);
  }
  if (rules.minTotalSpent > 0 && totalSpent < rules.minTotalSpent) {
    result.eligible = false;
    result.reasons.push(`Minimum spend of ₹${rules.minTotalSpent} required`);
  }
  if (rules.categories?.length) {
    const hasCategory = rules.categories.some((cat) =>
      categoriesBought.includes(cat),
    );
    if (!hasCategory) {
      result.eligible = false;
      result.reasons.push(
        `Required purchase in categories: ${rules.categories.join(", ")}`,
      );
    } else {
      result.conditions.categories = rules.categories;
    }
  }

  result.conditions.minTotalSpent = rules.minTotalSpent;
  result.conditions.currentTotalSpent = totalSpent;
  return result;
};

/* =====================================================
   MAIN USER ELIGIBILITY CHECK
===================================================== */
export const isUserEligibleForCoupon = async (user, coupon, preFetched = {}) => {
  const eligibility = {
    eligible: true,
    reasons: [],
    conditions: {},
  };

  const now = new Date();

  // ----- Basic static checks (fast, no DB) -----
  if (coupon.status !== "ACTIVE") {
    eligibility.eligible = false;
    eligibility.reasons.push("Coupon is not active");
  }
  if (now < coupon.validFrom || now > coupon.validUntil) {
    eligibility.eligible = false;
    eligibility.reasons.push("Coupon is not valid at this time");
  }
  if (coupon.currentRedemptions >= coupon.maxRedemptions) {
    eligibility.eligible = false;
    eligibility.reasons.push("Coupon redemption limit reached");
  }
  if (!eligibility.eligible) return eligibility; // short‑circuit

  // ----- Per‑user limit (pre‑fetched or query) -----
  const usageCount = preFetched.usageCount ?? await UserCoupon.countDocuments({
    userId: user._id,
    couponId: coupon._id,
    status: { $in: ["ACTIVE", "USED"] }
  });
  if (usageCount >= coupon.perUserLimit) {
    eligibility.eligible = false;
    eligibility.reasons.push("You have reached the usage limit for this coupon");
    return eligibility;
  }

  // ----- Targeting rules -----
  const targetingType = coupon.targeting?.type;

  switch (targetingType) {
    case "GEOGRAPHIC": {
      const geo = await checkGeographicEligibility(user, coupon);
      if (!geo.eligible) {
        eligibility.eligible = false;
        eligibility.reasons.push(...geo.reasons);
      }
      eligibility.conditions.geographic = geo.conditions;
      break;
    }

    case "INDIVIDUAL": {
      const assignedUsers = coupon.targeting?.users || [];
      const isAssigned = assignedUsers.some(u => u.equals(user._id));
      if (!isAssigned) {
        eligibility.eligible = false;
        eligibility.reasons.push("Coupon not assigned to you");
      }
      break;
    }

    case "PURCHASE_HISTORY": {
      const purchaseCheck = await checkPurchaseHistoryEligibility(
        user._id,
        coupon.targeting.purchaseHistory,
        preFetched.purchaseStats // may be undefined → fallback to live aggregation
      );
      if (!purchaseCheck.eligible) {
        eligibility.eligible = false;
        eligibility.reasons.push(...purchaseCheck.reasons);
      }
      eligibility.conditions.purchaseHistory = purchaseCheck.conditions;
      break;
    }

    case "REFERRAL": {
      const referral = await Referral.findOne({
        referredUserId: user._id,
        status: "COMPLETED"
      });
      if (!referral) {
        eligibility.eligible = false;
        eligibility.reasons.push("No completed referrals found");
      }
      break;
    }

    case "ALL":
    default:
      // No extra conditions
      break;
  }

  return eligibility;
};

export const getEligibleCouponsForUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const coupons = await Coupon.find({
    status: "ACTIVE",
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
    $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
  }).populate(
    "targeting.geographic.stores targeting.users productRules.products",
  );

  const categorized = {
    common: [],
    geographic: [],
    individual: [],
    purchaseBased: [],
    referral: [],
  };

  for (const coupon of coupons) {
    const { eligible } = await isUserEligibleForCoupon(user, coupon);
    if (!eligible) continue;

    const map = {
      ALL: "common",
      GEOGRAPHIC: "geographic",
      INDIVIDUAL: "individual",
      PURCHASE_HISTORY: "purchaseBased",
      REFERRAL: "referral",
    };

    categorized[map[coupon.targeting.type]]?.push(coupon);
  }

  return {
    success: true,
    totalEligible: Object.values(categorized).flat().length,
    categorizedCoupons: categorized,
    userInfo: {
      city: user.city,
      area: user.area,
      registrationDate: user.createdAt,
    },
  };
};

export const isUserEligibleForCoupon2 = async (user, coupon) => {
  const eligibility = {
    eligible: true,
    reasons: [],
    conditions: {},
  };

  const now = new Date();

  // 1️⃣ Basic validations
  if (coupon.status !== "ACTIVE") {
    eligibility.eligible = false;
    eligibility.reasons.push("Coupon is not active");
  }

  if (now < coupon.validFrom || now > coupon.validUntil) {
    eligibility.eligible = false;
    eligibility.reasons.push("Coupon is not valid at this time");
  }

  if (coupon.currentRedemptions >= coupon.maxRedemptions) {
    eligibility.eligible = false;
    eligibility.reasons.push("Coupon redemption limit reached");
  }

  // 2️⃣ Per-user limit check
  const usedCount = await UserCoupon.countDocuments({
    userId: user._id,
    couponId: coupon._id,
    status: { $in: ["ACTIVE", "USED"] },
  });

  if (usedCount >= coupon.perUserLimit) {
    eligibility.eligible = false;
    eligibility.reasons.push("You have already used this coupon");
  }

  // 3️⃣ Targeting rules
  const targetingType = coupon?.targeting?.type;

  switch (targetingType) {
    case "GEOGRAPHIC": {
      const geo = await checkGeographicEligibility(user, coupon);
      if (!geo.eligible) {
        eligibility.eligible = false;
        eligibility.reasons.push(...geo.reasons);
      }
      eligibility.conditions.geographic = geo.conditions;
      break;
    }

    case "INDIVIDUAL": {
      const assignedUsers = coupon?.targeting?.users || [];
      const isAssigned = assignedUsers.some((u) => u.equals(user._id));

      if (!isAssigned) {
        eligibility.eligible = false;
        eligibility.reasons.push("Coupon not assigned to you");
      }
      break;
    }

    case "PURCHASE_HISTORY": {
      const purchase = await checkPurchaseHistoryEligibility(user, coupon);
      if (!purchase.eligible) {
        eligibility.eligible = false;
        eligibility.reasons.push(...purchase.reasons);
      }
      eligibility.conditions.purchaseHistory = purchase.conditions;
      break;
    }

    case "REFERRAL": {
      const referral = await Referral.findOne({
        referredUserId: user._id,
        status: "COMPLETED",
      });

      if (!referral) {
        eligibility.eligible = false;
        eligibility.reasons.push("No completed referrals found");
      }
      break;
    }

    case "ALL":
    default:
      break;
  }

  return eligibility;
};

export const assignCouponToEligibleUsers = async (couponId) => {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) throw new Error("Coupon not found");

  const users = await User.find({ isActive: true });
  const results = [];

  for (const user of users) {
    try {
      const existing = await UserCoupon.findOne({ userId: user._id, couponId });
      if (existing) {
        results.push({ userId: user._id, status: "ALREADY_ASSIGNED" });
        continue;
      }

      const uc = await UserCoupon.create({
        userId: user._id,
        couponId,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 86400000),
      });

      await sendPushNotification(
        user._id,
        "New Coupon Available!",
        `You received a new coupon: ${coupon.title}`,
      );

      results.push({
        userId: user._id,
        status: "ASSIGNED",
        code: uc.uniqueCode,
      });
    } catch (err) {
      results.push({
        userId: user._id,
        status: "FAILED",
        message: err.message,
      });
    }
  }

  return { success: true, couponId, results };
};
