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

/**
 * Geographic eligibility – no changes needed, already efficient.
 */

export const checkGeographicEligibility = async (user, coupon) => {
  const result = { eligible: true, reasons: [], conditions: {} };
  const geo = coupon.targeting?.geographic;

  if (!geo) return result;

  // Cities (ObjectId comparison)
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

  // Areas (ObjectId comparison)
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

/**
 * Purchase history eligibility – rewritten with aggregation for maximum performance.
 * @param {ObjectId} userId
 * @param {Object} rules – from coupon.targeting.purchaseHistory
 * @param {Object} options – optionally pass pre‑fetched purchase stats (used in batch checks)
 */
export const checkPurchaseHistoryEligibility = async (user, coupon) => {
  const result = { eligible: true, reasons: [], conditions: {} };
  const rules = coupon.targeting?.purchaseHistory;

  if (!rules) return result;

  const query = {
    userId: user._id,
    status: "COMPLETED",
  };

  // Time Frame Handling
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

  // Min Purchases
  if (rules.minPurchases && purchases.length < rules.minPurchases) {
    result.eligible = false;
    result.reasons.push(`Minimum ${rules.minPurchases} purchases required`);
  }

  // Category Rule
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

  // Minimum Total Spent
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

  if (!user) {
    return { eligible: false, reasons: ["User not found"] };
  }

  // Basic Status Checks
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

  // Per User Limit
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

  // Targeting
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

/* =====================================================
   MAIN USER ELIGIBILITY CHECK
===================================================== */

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

/* --------------------------------------------------
   GET DISCOVERABLE COUPONS
   - Coupons visible to user but not yet assigned
-------------------------------------------------- */
export const getDiscoverableCoupons = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID");
  }

  const user = await User.findById(userId).lean();
  if (!user) throw new Error("User not found");

  const now = new Date();

  /* --------------------------------------------------
     1️⃣ Get already assigned coupons
  -------------------------------------------------- */
  const assignedCoupons = await UserCoupon.find({ userId }).distinct(
    "couponId",
  );

  /* --------------------------------------------------
     2️⃣ Base query (active + not expired + not maxed out)
  -------------------------------------------------- */
  const baseQuery = {
    status: "ACTIVE",
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    _id: { $nin: assignedCoupons },
    $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
  };

  const coupons = await Coupon.find(baseQuery)
    // .sort({ updatedAt: -1, validUntil: 1 })
    // .sort({ createdAt: -1, validUntil: 1 })
    .sort({ createdAt: -1 })

    .populate("targeting.geographic.stores", "name")
    .lean();

  /* --------------------------------------------------
     3️⃣ Determine user segment dynamically
  -------------------------------------------------- */
  const purchaseCount = await Purchase.countDocuments({ userId });

  let userSegment = null;

  if (purchaseCount === 0) userSegment = "NEW_USER";
  else if (purchaseCount >= 10) userSegment = "LOYAL_CUSTOMER";
  else if (purchaseCount >= 5) userSegment = "FREQUENT_BUYER";

  /* --------------------------------------------------
     4️⃣ Filter coupons by targeting rules
  -------------------------------------------------- */
  const discoverable = [];

  for (const coupon of coupons) {
    const targeting = coupon.targeting || {};
    const type = targeting.type || "ALL";

    let eligible = true;

    switch (type) {
      /* ---------------- ALL USERS ---------------- */
      case "ALL":
        break;

      /* ---------------- GEOGRAPHIC ---------------- */
      case "GEOGRAPHIC":
        if (targeting.geographic?.cities?.length) {
          if (
            !targeting.geographic.cities
              .map((id) => id.toString())
              .includes(user.city?.toString())
          ) {
            eligible = false;
          }
        }

        if (eligible && targeting.geographic?.areas?.length) {
          if (
            !targeting.geographic.areas
              .map((id) => id.toString())
              .includes(user.area?.toString())
          ) {
            eligible = false;
          }
        }
        break;

      /* ---------------- INDIVIDUAL ---------------- */
      case "INDIVIDUAL":
        if (
          !targeting.users?.some((u) => u.toString() === user._id.toString())
        ) {
          eligible = false;
        }
        break;

      /* ---------------- PURCHASE HISTORY ---------------- */
      case "PURCHASE_HISTORY":
        if (purchaseCount === 0) eligible = false;
        break;

      /* ---------------- REFERRAL ---------------- */
      case "REFERRAL":
        if (!user.referredBy) eligible = false;
        break;

      default:
        eligible = false;
    }

    /* ---------------- SEGMENT FILTER ---------------- */
    if (
      eligible &&
      targeting.segments?.length &&
      !targeting.segments.includes(userSegment)
    ) {
      eligible = false;
    }

    if (eligible) {
      discoverable.push(coupon);
    }
  }

  /* --------------------------------------------------
     5️⃣ Categorize response
  -------------------------------------------------- */
  const categorized = {
    common: [],
    geographic: [],
    individual: [],
    purchaseBased: [],
    referral: [],
  };

  for (const coupon of discoverable) {
    const map = {
      ALL: "common",
      GEOGRAPHIC: "geographic",
      INDIVIDUAL: "individual",
      PURCHASE_HISTORY: "purchaseBased",
      REFERRAL: "referral",
    };

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

export const buildTargetingConditions1 = ({
  user = null,
  product = null,
  cartProducts = [],
  category = null,
  brand = null,
}) => {
  const conditions = [];

  // ALL
  conditions.push({ "targeting.type": "ALL" });

  // INDIVIDUAL
  if (user?._id) {
    conditions.push({
      $and: [
        { "targeting.type": "INDIVIDUAL" },
        { "targeting.users": user._id },
      ],
    });
  }

  // GEOGRAPHIC
  if (user?.city || user?.area || user?.store) {
    const geo = [];

    if (user.city) geo.push({ "targeting.geographic.cities": user.city });
    if (user.area) geo.push({ "targeting.geographic.areas": user.area });
    if (user.store) geo.push({ "targeting.geographic.stores": user.store });

    conditions.push({
      $and: [{ "targeting.type": "GEOGRAPHIC" }, { $or: geo }],
    });
  }

  // SEGMENT
  if (user?.segments?.length) {
    conditions.push({
      $and: [
        { "targeting.type": "SEGMENT" },
        { "targeting.segments": { $in: user.segments } },
      ],
    });
  }

  // PRODUCT BASED
  if (product) {
    conditions.push({
      $and: [
        { "targeting.type": "PRODUCT_BASED" },
        {
          $or: [
            { "targeting.products": product._id },
            { "targeting.categories": product.category },
            { "targeting.brands": product.brand },
          ],
        },
      ],
    });
  }

  // CART
  if (cartProducts?.length) {
    conditions.push({
      $and: [
        { "targeting.type": "PRODUCT_BASED" },
        {
          $or: [
            { "targeting.products": { $in: cartProducts.map((p) => p._id) } },
            {
              "targeting.categories": {
                $in: cartProducts.map((p) => p.category),
              },
            },
            { "targeting.brands": { $in: cartProducts.map((p) => p.brand) } },
          ],
        },
      ],
    });
  }

  if (category) {
    conditions.push({
      $and: [
        { "targeting.type": "PRODUCT_BASED" },
        { "targeting.categories": category },
      ],
    });
  }

  if (brand) {
    conditions.push({
      $and: [
        { "targeting.type": "PRODUCT_BASED" },
        { "targeting.brands": brand },
      ],
    });
  }

  return conditions;
};

/**
 * Build targeting conditions for banners
 * Returns an array of MongoDB $or conditions
 *
 * @param {Object} options
 * @param {Object|null} options.user - logged-in user object
 * @param {Object|null} options.product - single product for product-specific banners
 * @param {Array} options.cartProducts - list of products in cart
 * @param {String|ObjectId|null} options.category - optional category filter
 * @param {String|ObjectId|null} options.brand - optional brand filter
 * @returns {Array} array of $or conditions
 */
export const buildTargetingConditions = ({
  user = null,
  product = null,
  cartProducts = [],
  category = null,
  brand = null,
} = {}) => {
  const conditions = [];

  // ------------------------------------
  // ALL users
  // ------------------------------------
  conditions.push({ "targeting.type": "ALL" });

  // ------------------------------------
  // INDIVIDUAL targeting
  // ------------------------------------
  if (user?._id) {
    conditions.push({
      $and: [
        { "targeting.type": "INDIVIDUAL" },
        { "targeting.users": user._id },
      ],
    });
  }

  // ------------------------------------
  // GEOGRAPHIC targeting
  // ------------------------------------
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

  // ------------------------------------
  // SEGMENT targeting
  // ------------------------------------
  if (user?.segments?.length) {
    conditions.push({
      $and: [
        { "targeting.type": "SEGMENT" },
        { "targeting.segments": { $in: user.segments } },
      ],
    });
  }

  // ------------------------------------
  // PRODUCT-BASED targeting
  // ------------------------------------
  const productTargets = [];

  if (product?._id) {
    productTargets.push(
      { "targeting.products": product._id },
      { "targeting.categories": product.category },
      { "targeting.brands": product.brand },
    );
  }

  if (cartProducts?.length) {
    productTargets.push(
      { "targeting.products": { $in: cartProducts.map((p) => p._id) } },
      { "targeting.categories": { $in: cartProducts.map((p) => p.category) } },
      { "targeting.brands": { $in: cartProducts.map((p) => p.brand) } },
    );
  }

  if (category) productTargets.push({ "targeting.categories": category });
  if (brand) productTargets.push({ "targeting.brands": brand });

  if (productTargets.length > 0) {
    conditions.push({
      $and: [{ "targeting.type": "PRODUCT_BASED" }, { $or: productTargets }],
    });
  }

  return conditions;
};
