import User from "../models/User.model.js";
import Coupon from "../models/Coupon.model.js";
import Purchase from "../models/Purchase.model.js";
import UserCoupon from "../models/UserCoupon.model.js";
import Referral from "../models/Referral.model.js";
import Product from "../models/Product.model.js";
import NotificationService from "./notificationService.js";

/* --------------------------------------------------
   Geographic Eligibility
-------------------------------------------------- */
export const checkGeographicEligibility = async (user, coupon) => {
  const result = { eligible: true, reasons: [], conditions: {} };
  const geo = coupon.targeting.geographic;

  if (geo?.cities?.length) {
    if (
      !geo.cities.map((c) => c.toLowerCase()).includes(user.city.toLowerCase())
    ) {
      result.eligible = false;
      result.reasons.push(`Coupon only available in: ${geo.cities.join(", ")}`);
    } else result.conditions.cities = geo.cities;
  }

  if (geo?.areas?.length) {
    if (
      !geo.areas.map((a) => a.toLowerCase()).includes(user.area.toLowerCase())
    ) {
      result.eligible = false;
      result.reasons.push(`Coupon only available in: ${geo.areas.join(", ")}`);
    } else result.conditions.areas = geo.areas;
  }

  if (geo?.stores?.length) {
    result.conditions.stores = geo.stores.map((s) => s.name);
  }

  return result;
};

/* --------------------------------------------------
   Purchase History Eligibility
-------------------------------------------------- */
export const checkPurchaseHistoryEligibility = async (user, coupon) => {
  const result = { eligible: true, reasons: [], conditions: {} };
  const rules = coupon.targeting.purchaseHistory;
  if (!rules) return result;

  const query = { userId: user._id };
  if (rules.timeFrame) {
    const start = new Date();
    const map = { LAST_7_DAYS: 7, LAST_30_DAYS: 30, LAST_90_DAYS: 90 };
    start.setDate(start.getDate() - (map[rules.timeFrame] ?? 9000));
    query.createdAt = { $gte: start };
  }

  const purchases = await Purchase.find(query);

  if (rules.minPurchases && purchases.length < rules.minPurchases) {
    result.eligible = false;
    result.reasons.push(`Minimum ${rules.minPurchases} purchase(s) required`);
  }

  if (rules.categories?.length) {
    const hasCategory = purchases.some((p) =>
      p.items.some((i) => rules.categories.includes(i.category)),
    );
    if (!hasCategory) {
      result.eligible = false;
      result.reasons.push(
        `Required purchase in categories: ${rules.categories.join(", ")}`,
      );
    } else result.conditions.categories = rules.categories;
  }

  if (rules.minTotalSpent) {
    const total = purchases.reduce((s, p) => s + p.finalAmount, 0);
    if (total < rules.minTotalSpent) {
      result.eligible = false;
      result.reasons.push(`Minimum spend of ₹${rules.minTotalSpent} required`);
    } else {
      result.conditions.minTotalSpent = rules.minTotalSpent;
      result.conditions.currentTotalSpent = total;
    }
  }

  return result;
};

/* --------------------------------------------------
   User ↔ Coupon Eligibility
-------------------------------------------------- */
export const isUserEligibleForCoupon = async (user, coupon) => {
  const eligibility = { eligible: true, reasons: [], conditions: {} };

  if (coupon.status !== "ACTIVE") {
    eligibility.eligible = false;
    eligibility.reasons.push("Coupon is not active");
  }

  if (new Date() < coupon.validFrom || new Date() > coupon.validUntil) {
    eligibility.eligible = false;
    eligibility.reasons.push("Coupon is not valid at this time");
  }

  if (coupon.currentRedemptions >= coupon.maxRedemptions) {
    eligibility.eligible = false;
    eligibility.reasons.push("Coupon redemption limit reached");
  }

  const usedCount = await UserCoupon.countDocuments({
    userId: user._id,
    couponId: coupon._id,
    status: { $in: ["ACTIVE", "USED"] },
  });

  if (usedCount >= coupon.perUserLimit) {
    eligibility.eligible = false;
    eligibility.reasons.push("You have already used this coupon");
  }

  switch (coupon.targeting.type) {
    case "GEOGRAPHIC": {
      const geo = await checkGeographicEligibility(user, coupon);
      if (!geo.eligible) {
        eligibility.eligible = false;
        eligibility.reasons.push(...geo.reasons);
      }
      eligibility.conditions.geographic = geo.conditions;
      break;
    }

    case "INDIVIDUAL":
      if (!coupon.targeting.users.some((u) => u.equals(user._id))) {
        eligibility.eligible = false;
        eligibility.reasons.push("Coupon not assigned to you");
      }
      break;

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
  }

  return eligibility;
};

/* --------------------------------------------------
   Eligible Coupons for User
-------------------------------------------------- */
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

/* --------------------------------------------------
   Assign Coupon to Eligible Users
-------------------------------------------------- */
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

      await NotificationService.sendPushNotification(
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

/* --------------------------------------------------
   Personalized Recommendations
-------------------------------------------------- */
export const getPersonalizedRecommendations = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const purchases = await Purchase.find({ userId })
    .sort("-createdAt")
    .limit(10);

  const categories = [
    ...new Set(purchases.flatMap((p) => p.items.map((i) => i.category))),
  ];
  const brands = [
    ...new Set(
      purchases.flatMap((p) => p.items.map((i) => i.brand)).filter(Boolean),
    ),
  ];

  const coupons = await Coupon.find({
    "targeting.type": "PURCHASE_HISTORY",
    status: "ACTIVE",
    validUntil: { $gte: new Date() },
  }).limit(5);

  const eligibleCoupons = [];
  for (const c of coupons) {
    if ((await isUserEligibleForCoupon(user, c)).eligible)
      eligibleCoupons.push(c);
  }

  const products = await Product.find({
    category: { $in: categories },
    isActive: true,
  }).limit(10);

  return {
    success: true,
    userPreferences: {
      purchasedCategories: categories,
      purchasedBrands: brands,
      lastPurchase: purchases[0]?.createdAt ?? null,
    },
    recommendedCoupons: eligibleCoupons,
    recommendedProducts: products,
  };
};
