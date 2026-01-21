const User = require("../models/User.model.js");
const Coupon = require("../models/Coupon.model.js");
const Purchase = require("../models/Purchase.model.js");

class TargetingService {
  // Get eligible coupons for a user
  static async getEligibleCouponsForUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Get all active coupons
      const activeCoupons = await Coupon.find({
        status: "ACTIVE",
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() },
        $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
      })
        .populate("targeting.geographic.stores")
        .populate("targeting.users")
        .populate("productRules.products");

      // Filter coupons based on eligibility
      const eligibleCoupons = [];

      for (const coupon of activeCoupons) {
        const eligibility = await this.isUserEligibleForCoupon(user, coupon);

        if (eligibility.eligible) {
          eligibleCoupons.push({
            coupon: coupon,
            eligibility: eligibility,
          });
        }
      }

      // Categorize coupons
      const categorizedCoupons = {
        common: [], // For all users
        geographic: [], // City/Area specific
        individual: [], // Assigned to specific users
        purchaseBased: [], // Based on purchase history
        referral: [], // Referral rewards
      };

      eligibleCoupons.forEach((item) => {
        switch (item.coupon.targeting.type) {
          case "ALL":
            categorizedCoupons.common.push(item.coupon);
            break;
          case "GEOGRAPHIC":
            categorizedCoupons.geographic.push(item.coupon);
            break;
          case "INDIVIDUAL":
            categorizedCoupons.individual.push(item.coupon);
            break;
          case "PURCHASE_HISTORY":
            categorizedCoupons.purchaseBased.push(item.coupon);
            break;
          case "REFERRAL":
            categorizedCoupons.referral.push(item.coupon);
            break;
        }
      });

      return {
        success: true,
        totalEligible: eligibleCoupons.length,
        categorizedCoupons,
        userInfo: {
          city: user.city,
          area: user.area,
          registrationDate: user.createdAt,
        },
      };
    } catch (error) {
      console.error("Error getting eligible coupons:", error);
      throw new Error("Failed to get eligible coupons");
    }
  }

  // Check if user is eligible for a specific coupon
  static async isUserEligibleForCoupon(user, coupon) {
    const eligibility = {
      eligible: true,
      reasons: [],
      conditions: {},
    };

    // Check coupon status
    if (coupon.status !== "ACTIVE") {
      eligibility.eligible = false;
      eligibility.reasons.push("Coupon is not active");
    }

    // Check validity dates
    if (new Date() < coupon.validFrom || new Date() > coupon.validUntil) {
      eligibility.eligible = false;
      eligibility.reasons.push("Coupon is not valid at this time");
    }

    // Check redemption limits
    if (coupon.currentRedemptions >= coupon.maxRedemptions) {
      eligibility.eligible = false;
      eligibility.reasons.push("Coupon redemption limit reached");
    }

    // Check per user limit
    const UserCoupon = require("../models/UserCoupon.model.js");
    const userCouponCount = await UserCoupon.countDocuments({
      userId: user._id,
      couponId: coupon._id,
      status: { $in: ["ACTIVE", "USED"] },
    });

    if (userCouponCount >= coupon.perUserLimit) {
      eligibility.eligible = false;
      eligibility.reasons.push("You have already used this coupon");
    }

    // Check targeting rules
    switch (coupon.targeting.type) {
      case "GEOGRAPHIC":
        const geoEligibility = await this.checkGeographicEligibility(
          user,
          coupon
        );
        if (!geoEligibility.eligible) {
          eligibility.eligible = false;
          eligibility.reasons.push(...geoEligibility.reasons);
        }
        eligibility.conditions.geographic = geoEligibility.conditions;
        break;

      case "INDIVIDUAL":
        if (
          !coupon.targeting.users.some(
            (u) => u._id.toString() === user._id.toString()
          )
        ) {
          eligibility.eligible = false;
          eligibility.reasons.push("Coupon not assigned to you");
        }
        break;

      case "PURCHASE_HISTORY":
        const purchaseEligibility = await this.checkPurchaseHistoryEligibility(
          user,
          coupon
        );
        if (!purchaseEligibility.eligible) {
          eligibility.eligible = false;
          eligibility.reasons.push(...purchaseEligibility.reasons);
        }
        eligibility.conditions.purchaseHistory = purchaseEligibility.conditions;
        break;

      case "REFERRAL":
        // Check if user has completed referrals
        const Referral = require("../models/Referral.model.js");
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

    // Check product restrictions
    if (coupon.productRules.type !== "ALL_PRODUCTS") {
      eligibility.conditions.productRestrictions = coupon.productRules;
    }

    // Check minimum purchase amount
    if (coupon.minPurchaseAmount > 0) {
      eligibility.conditions.minPurchaseAmount = coupon.minPurchaseAmount;
    }

    return eligibility;
  }

  // Check geographic eligibility
  static async checkGeographicEligibility(user, coupon) {
    const result = {
      eligible: true,
      reasons: [],
      conditions: {},
    };

    const geo = coupon.targeting.geographic;

    // Check cities
    if (geo.cities && geo.cities.length > 0) {
      const userCity = user.city.toLowerCase();
      const eligibleCities = geo.cities.map((c) => c.toLowerCase());

      if (!eligibleCities.includes(userCity)) {
        result.eligible = false;
        result.reasons.push(
          `Coupon only available in: ${geo.cities.join(", ")}`
        );
      } else {
        result.conditions.cities = geo.cities;
      }
    }

    // Check areas
    if (geo.areas && geo.areas.length > 0) {
      const userArea = user.area.toLowerCase();
      const eligibleAreas = geo.areas.map((a) => a.toLowerCase());

      if (!eligibleAreas.includes(userArea)) {
        result.eligible = false;
        result.reasons.push(
          `Coupon only available in: ${geo.areas.join(", ")}`
        );
      } else {
        result.conditions.areas = geo.areas;
      }
    }

    // Check stores
    if (geo.stores && geo.stores.length > 0) {
      result.conditions.stores = geo.stores.map((s) => s.name);
    }

    return result;
  }

  // Check purchase history eligibility
  static async checkPurchaseHistoryEligibility(user, coupon) {
    const result = {
      eligible: true,
      reasons: [],
      conditions: {},
    };

    const rules = coupon.targeting.purchaseHistory;

    if (!rules) {
      return result;
    }

    // Build purchase query
    const purchaseQuery = { userId: user._id };

    // Add time frame filter
    if (rules.timeFrame) {
      const startDate = new Date();

      switch (rules.timeFrame) {
        case "LAST_7_DAYS":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "LAST_30_DAYS":
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "LAST_90_DAYS":
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setFullYear(2000); // All time
      }

      purchaseQuery.createdAt = { $gte: startDate };
    }

    // Get user's purchases
    const purchases = await Purchase.find(purchaseQuery);

    // Check minimum purchases
    if (rules.minPurchases && purchases.length < rules.minPurchases) {
      result.eligible = false;
      result.reasons.push(`Minimum ${rules.minPurchases} purchase(s) required`);
    }

    // Check categories
    if (rules.categories && rules.categories.length > 0) {
      const hasCategoryPurchase = purchases.some((purchase) =>
        purchase.items.some((item) => rules.categories.includes(item.category))
      );

      if (!hasCategoryPurchase) {
        result.eligible = false;
        result.reasons.push(
          `Required purchase in categories: ${rules.categories.join(", ")}`
        );
      } else {
        result.conditions.categories = rules.categories;
      }
    }

    // Check minimum total spent
    if (rules.minTotalSpent && rules.minTotalSpent > 0) {
      const totalSpent = purchases.reduce(
        (sum, purchase) => sum + purchase.finalAmount,
        0
      );

      if (totalSpent < rules.minTotalSpent) {
        result.eligible = false;
        result.reasons.push(
          `Minimum spend of ₹${rules.minTotalSpent} required`
        );
      } else {
        result.conditions.minTotalSpent = rules.minTotalSpent;
        result.conditions.currentTotalSpent = totalSpent;
      }
    }

    return result;
  }

  // Get users eligible for a coupon
  static async getUsersEligibleForCoupon(couponId) {
    try {
      const coupon = await Coupon.findById(couponId);
      if (!coupon) {
        throw new Error("Coupon not found");
      }

      let eligibleUsers = [];

      switch (coupon.targeting.type) {
        case "ALL":
          // All active users
          eligibleUsers = await User.find({ isActive: true }).select(
            "name mobile city area createdAt"
          );
          break;

        case "GEOGRAPHIC":
          const geo = coupon.targeting.geographic;
          const query = { isActive: true };

          if (geo.cities && geo.cities.length > 0) {
            query.city = { $in: geo.cities };
          }

          if (geo.areas && geo.areas.length > 0) {
            query.area = { $in: geo.areas };
          }

          eligibleUsers = await User.find(query).select(
            "name mobile city area createdAt"
          );
          break;

        case "INDIVIDUAL":
          // Specific users already defined
          eligibleUsers = coupon.targeting.users;
          break;

        case "PURCHASE_HISTORY":
          // Get all users, then filter by purchase history
          const allUsers = await User.find({ isActive: true }).select(
            "name mobile city area createdAt"
          );

          for (const user of allUsers) {
            const eligibility = await this.checkPurchaseHistoryEligibility(
              user,
              coupon
            );
            if (eligibility.eligible) {
              eligibleUsers.push(user);
            }
          }
          break;
      }

      return {
        success: true,
        coupon: coupon.title,
        targetingType: coupon.targeting.type,
        eligibleUsersCount: eligibleUsers.length,
        eligibleUsers,
      };
    } catch (error) {
      console.error("Error getting eligible users:", error);
      throw new Error("Failed to get eligible users");
    }
  }

  // Assign coupon to eligible users
  static async assignCouponToEligibleUsers(couponId) {
    try {
      const result = await this.getUsersEligibleForCoupon(couponId);

      if (!result.success) {
        throw new Error("Failed to get eligible users");
      }

      const UserCoupon = require("../models/UserCoupon.model.js");
      const assignmentResults = [];

      for (const user of result.eligibleUsers) {
        try {
          // Check if user already has this coupon
          const existingUserCoupon = await UserCoupon.findOne({
            userId: user._id,
            couponId: couponId,
          });

          if (existingUserCoupon) {
            assignmentResults.push({
              userId: user._id,
              mobile: user.mobile,
              status: "ALREADY_ASSIGNED",
              message: "Coupon already assigned to user",
            });
            continue;
          }

          // Create user coupon
          const userCoupon = new UserCoupon({
            userId: user._id,
            couponId: couponId,
            validFrom: new Date(),
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });

          await userCoupon.save();

          assignmentResults.push({
            userId: user._id,
            mobile: user.mobile,
            status: "ASSIGNED",
            userCouponId: userCoupon._id,
            uniqueCode: userCoupon.uniqueCode,
          });

          // Send notification to user
          const NotificationService = require("./notificationService");
          await NotificationService.sendPushNotification(
            user._id,
            "New Coupon Available!",
            `You have received a new coupon: ${coupon.title}`
          );
        } catch (error) {
          assignmentResults.push({
            userId: user._id,
            mobile: user.mobile,
            status: "FAILED",
            message: error.message,
          });
        }
      }

      return {
        success: true,
        couponId: couponId,
        totalEligible: result.eligibleUsersCount,
        assigned: assignmentResults.filter((r) => r.status === "ASSIGNED")
          .length,
        alreadyAssigned: assignmentResults.filter(
          (r) => r.status === "ALREADY_ASSIGNED"
        ).length,
        failed: assignmentResults.filter((r) => r.status === "FAILED").length,
        details: assignmentResults,
      };
    } catch (error) {
      console.error("Error assigning coupon to users:", error);
      throw new Error("Failed to assign coupon to users");
    }
  }

  // Get personalized recommendations for user
  static async getPersonalizedRecommendations(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Get user's purchase history
      const purchases = await Purchase.find({ userId: userId })
        .sort({ createdAt: -1 })
        .limit(10);

      // Extract purchased categories and brands
      const purchasedCategories = new Set();
      const purchasedBrands = new Set();

      purchases.forEach((purchase) => {
        purchase.items.forEach((item) => {
          purchasedCategories.add(item.category);
          if (item.brand) {
            purchasedBrands.add(item.brand);
          }
        });
      });

      // Get coupons based on purchase history
      const purchaseBasedCoupons = await Coupon.find({
        "targeting.type": "PURCHASE_HISTORY",
        status: "ACTIVE",
        validUntil: { $gte: new Date() },
      }).limit(5);

      // Filter coupons user is eligible for
      const eligibleCoupons = [];
      for (const coupon of purchaseBasedCoupons) {
        const eligibility = await this.isUserEligibleForCoupon(user, coupon);
        if (eligibility.eligible) {
          eligibleCoupons.push(coupon);
        }
      }

      // Get products in purchased categories
      const Product = require("../models/Product.model.js");
      const recommendedProducts = await Product.find({
        category: { $in: Array.from(purchasedCategories) },
        isActive: true,
      }).limit(10);

      return {
        success: true,
        userPreferences: {
          purchasedCategories: Array.from(purchasedCategories),
          purchasedBrands: Array.from(purchasedBrands),
          lastPurchase: purchases[0] ? purchases[0].createdAt : null,
          totalPurchases: purchases.length,
        },
        recommendedCoupons: eligibleCoupons.map((c) => ({
          id: c._id,
          title: c.title,
          value: c.value,
          validUntil: c.validUntil,
        })),
        recommendedProducts: recommendedProducts.map((p) => ({
          id: p._id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          sellingPrice: p.sellingPrice,
          discountPercentage: p.discountPercentage,
        })),
      };
    } catch (error) {
      console.error("Error getting personalized recommendations:", error);
      throw new Error("Failed to get personalized recommendations");
    }
  }
}

module.exports = TargetingService;
