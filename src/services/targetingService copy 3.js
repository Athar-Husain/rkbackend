// src/services/targetingService.js
import mongoose from "mongoose";
import User from "../models/User.model.js";
import Coupon from "../models/Coupon.model.js";
import Purchase from "../models/Purchase.model.js";
import UserCoupon from "../models/UserCoupon.model.js";
import Referral from "../models/Referral.model.js";

/* =====================================================
    PRODUCT RULE VALIDATION
===================================================== */
export const validateProductRules2 = (coupon, purchaseItems = []) => {
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

export const validateProductRules = (coupon, purchaseItems = []) => {
  if (!coupon?.productRules) return true;

  const {
    type = "ALL_PRODUCTS",
    categories = [],
    brands = [],
  } = coupon.productRules;

  if (type === "ALL_PRODUCTS") return true;

  if (!purchaseItems.length) return false;

  return purchaseItems.some((item) => {
    const itemCategory = item.category?.toUpperCase().trim();
    const itemBrand = item.brand?.toUpperCase().trim();

    switch (type) {
      case "CATEGORY":
        return categories.includes(itemCategory);

      case "BRAND":
        return brands.includes(itemBrand);

      case "CATEGORY_BRAND":
        return categories.includes(itemCategory) && brands.includes(itemBrand);

      default:
        return false;
    }
  });
};

export const checkGeographicEligibility = async (user, coupon) => {
  const result = { eligible: true, reasons: [], conditions: {} };
  const geo = coupon.targeting?.geographic;

  if (!geo) return result;

  if (geo.cities?.length) {
    const allowed = geo.cities.some(
      (cityId) => cityId.toString() === user.city?.toString(),
    );

    if (!allowed) {
      result.eligible = false;
      result.reasons.push("Coupon not available in your city");
    } else {
      result.conditions.city = user.cityName;
    }
  }

  if (geo.areas?.length) {
    const allowed = geo.areas.some(
      (areaId) => areaId.toString() === user.area?.toString(),
    );

    if (!allowed) {
      result.eligible = false;
      result.reasons.push("Coupon not available in your area");
    } else {
      result.conditions.area = user.areaName;
    }
  }

  if (geo.stores?.length) {
    result.conditions.stores = geo.stores;
  }

  return result;
};

export const checkPurchaseHistoryEligibility = async (user, coupon) => {
  const result = { eligible: true, reasons: [], conditions: {} };
  const rules = coupon.targeting?.purchaseHistory;

  if (!rules) return result;

  const query = {
    userId: user._id,
    status: "COMPLETED",
  };

  if (rules.timeFrame && rules.timeFrame !== "ALL_TIME") {
    const map = {
      LAST_7_DAYS: 7,
      LAST_30_DAYS: 30,
      LAST_90_DAYS: 90,
    };

    const days = map[rules.timeFrame];
    if (days) {
      query.createdAt = {
        $gte: new Date(Date.now() - days * 86400000),
      };
    }
  }

  const purchases = await Purchase.find(query);

  if (rules.minPurchases && purchases.length < rules.minPurchases) {
    result.eligible = false;
    result.reasons.push(`Minimum ${rules.minPurchases} purchases required`);
  }

  if (rules.categories?.length) {
    const normalizedCategories = rules.categories.map((c) => c.toLowerCase());

    const hasCategory = purchases.some((purchase) =>
      purchase.items.some((item) =>
        normalizedCategories.includes(item.category?.toLowerCase()),
      ),
    );

    if (!hasCategory) {
      result.eligible = false;
      result.reasons.push(
        `Purchase required in categories: ${rules.categories.join(", ")}`,
      );
    } else {
      result.conditions.categories = rules.categories;
    }
  }

  if (rules.minTotalSpent) {
    const total = purchases.reduce((sum, p) => sum + (p.finalAmount || 0), 0);

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

export const isUserEligibleForCoupon = async (user, coupon) => {
  const eligibility = { eligible: true, reasons: [], conditions: {} };
  const now = new Date();

  if (!user) return { eligible: false, reasons: ["User not found"] };

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

  if (coupon.perUserLimit > 0) {
    const usedCount = await UserCoupon.countDocuments({
      userId: user._id,
      couponId: coupon._id,
      status: { $in: ["ACTIVE", "USED"] },
    });

    if (usedCount >= coupon.perUserLimit) {
      eligibility.eligible = false;
      eligibility.reasons.push("You have already used this coupon");
    }
    eligibility.conditions.usageCount = usedCount;
  }

  switch (coupon.targeting?.type) {
    case "ALL":
      break;
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
      if (
        !coupon.targeting.users?.some(
          (u) => u.toString() === user._id.toString(),
        )
      ) {
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
    GET DISCOVERABLE COUPONS (PRODUCTION UPDATED)
-------------------------------------------------- */
export const getDiscoverableCoupons = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId))
    throw new Error("Invalid user ID");

  const user = await User.findById(userId).lean();
  if (!user) throw new Error("User not found");

  const now = new Date();

  // 1. Logic Change: Only exclude coupons that are CURRENTLY valid in wallet or USED.
  // Coupons that are "EXPIRED" in the UserCoupon table should be allowed back in Discover.
  const activeOrUsedCoupons = await UserCoupon.find({
    userId,
    $or: [
      { status: "USED" },
      {
        status: "ACTIVE",
        validUntil: { $gte: now }, // Still active in wallet
      },
    ],
  }).distinct("couponId");

  const baseQuery = {
    status: "ACTIVE",
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    _id: { $nin: activeOrUsedCoupons }, // Exclude only active/used
    $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
  };

  const coupons = await Coupon.find(baseQuery)
    .sort({ createdAt: -1 })
    .populate("targeting.geographic.stores", "name")
    .lean();

  const purchaseCount = await Purchase.countDocuments({ userId });
  let userSegment =
    purchaseCount === 0
      ? "NEW_USER"
      : purchaseCount >= 10
        ? "LOYAL_CUSTOMER"
        : purchaseCount >= 5
          ? "FREQUENT_BUYER"
          : null;

  const discoverable = [];
  for (const coupon of coupons) {
    const targeting = coupon.targeting || {};
    const type = targeting.type || "ALL";
    let eligible = true;

    switch (type) {
      case "ALL":
        break;
      case "GEOGRAPHIC":
        if (
          targeting.geographic?.cities?.length &&
          !targeting.geographic.cities
            .map((id) => id.toString())
            .includes(user.city?.toString())
        )
          eligible = false;
        if (
          eligible &&
          targeting.geographic?.areas?.length &&
          !targeting.geographic.areas
            .map((id) => id.toString())
            .includes(user.area?.toString())
        )
          eligible = false;
        break;
      case "INDIVIDUAL":
        if (!targeting.users?.some((u) => u.toString() === user._id.toString()))
          eligible = false;
        break;
      case "PURCHASE_HISTORY":
        if (purchaseCount === 0) eligible = false;
        break;
      case "REFERRAL":
        if (!user.referredBy) eligible = false;
        break;
      default:
        eligible = false;
    }

    if (
      eligible &&
      targeting.segments?.length &&
      !targeting.segments.includes(userSegment)
    )
      eligible = false;
    if (eligible) discoverable.push(coupon);
  }

  const categorized = {
    common: [],
    geographic: [],
    individual: [],
    purchaseBased: [],
    referral: [],
  };
  const map = {
    ALL: "common",
    GEOGRAPHIC: "geographic",
    INDIVIDUAL: "individual",
    PURCHASE_HISTORY: "purchaseBased",
    REFERRAL: "referral",
  };

  for (const coupon of discoverable) {
    const key = map[coupon.targeting?.type] || "common";
    categorized[key].push(coupon);
  }

  return {
    success: true,
    totalDiscoverable: discoverable.length,
    categorizedCoupons: categorized,
    userSegment,
    userInfo: {
      city: user.cityName,
      area: user.areaName,
      registrationDate: user.createdAt,
    },
  };
};

export const buildTargetingConditions = ({
  user = null,
  product = null,
  cartProducts = [],
  category = null,
  brand = null,
} = {}) => {
  const conditions = [{ "targeting.type": "ALL" }];
  if (user?._id)
    conditions.push({
      $and: [
        { "targeting.type": "INDIVIDUAL" },
        { "targeting.users": user._id },
      ],
    });
  if (user?.city || user?.area || user?.store) {
    const geoConditions = [];
    if (user.city)
      geoConditions.push({ "targeting.geographic.cities": user.city });
    if (user.area)
      geoConditions.push({ "targeting.geographic.areas": user.area });
    if (user.store)
      geoConditions.push({ "targeting.geographic.stores": user.store });
    conditions.push({
      $and: [{ "targeting.type": "GEOGRAPHIC" }, { $or: geoConditions }],
    });
  }
  if (user?.segments?.length)
    conditions.push({
      $and: [
        { "targeting.type": "SEGMENT" },
        { "targeting.segments": { $in: user.segments } },
      ],
    });

  const productTargets = [];
  if (product?._id)
    productTargets.push(
      { "targeting.products": product._id },
      { "targeting.categories": product.category },
      { "targeting.brands": product.brand },
    );
  if (cartProducts?.length) {
    productTargets.push(
      { "targeting.products": { $in: cartProducts.map((p) => p._id) } },
      { "targeting.categories": { $in: cartProducts.map((p) => p.category) } },
      { "targeting.brands": { $in: cartProducts.map((p) => p.brand) } },
    );
  }
  if (category) productTargets.push({ "targeting.categories": category });
  if (brand) productTargets.push({ "targeting.brands": brand });
  if (productTargets.length > 0)
    conditions.push({
      $and: [{ "targeting.type": "PRODUCT_BASED" }, { $or: productTargets }],
    });

  return conditions;
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
