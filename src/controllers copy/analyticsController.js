const User = require("../models/User.model.js");
const Purchase = require("../models/Purchase.model.js");
const Coupon = require("../models/Coupon.model.js");
const Store = require("../models/Store.model.js");

// @desc    Get sales analytics
// @route   GET /api/analytics/sales
// @access  Private (Admin)
exports.getSalesAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = "day", storeId } = req.query;

    // Set date range (default to last 30 days)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);

    const matchStage = {
      status: "COMPLETED",
      createdAt: { $gte: start, $lte: end },
    };

    if (storeId) {
      matchStage.storeId = storeId;
    }

    let groupStage;
    let dateFormat;

    switch (groupBy) {
      case "hour":
        groupStage = {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
            hour: { $hour: "$createdAt" },
          },
        };
        dateFormat = "DD/MM HH:00";
        break;

      case "day":
        groupStage = {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
        };
        dateFormat = "DD/MM";
        break;

      case "week":
        groupStage = {
          _id: {
            year: { $year: "$createdAt" },
            week: { $week: "$createdAt" },
          },
        };
        dateFormat = "Week WW";
        break;

      case "month":
        groupStage = {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
        };
        dateFormat = "MMM YYYY";
        break;

      default:
        groupStage = { _id: null };
        dateFormat = "All Time";
    }

    const salesData = await Purchase.aggregate([
      { $match: matchStage },
      {
        $group: {
          ...groupStage,
          totalSales: { $sum: "$finalAmount" },
          totalTransactions: { $sum: 1 },
          totalDiscounts: { $sum: "$discount" },
          averageTransaction: { $avg: "$finalAmount" },
          uniqueCustomers: { $addToSet: "$userId" },
        },
      },
      {
        $addFields: {
          dateLabel: {
            $dateToString: {
              format: dateFormat,
              date: { $toDate: { $min: "$createdAt" } },
            },
          },
          uniqueCustomersCount: { $size: "$uniqueCustomers" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Calculate metrics
    const totalSales = salesData.reduce(
      (sum, item) => sum + item.totalSales,
      0
    );
    const totalTransactions = salesData.reduce(
      (sum, item) => sum + item.totalTransactions,
      0
    );
    const totalDiscounts = salesData.reduce(
      (sum, item) => sum + item.totalDiscounts,
      0
    );
    const avgTransaction =
      totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // Get store comparison if no specific store
    let storeComparison = [];
    if (!storeId) {
      storeComparison = await Purchase.aggregate([
        { $match: { ...matchStage } },
        {
          $group: {
            _id: "$storeId",
            totalSales: { $sum: "$finalAmount" },
            totalTransactions: { $sum: 1 },
          },
        },
        { $sort: { totalSales: -1 } },
        { $limit: 10 },
      ]);

      // Get store names
      const storeIds = storeComparison.map((item) => item._id);
      const stores = await Store.find({ _id: { $in: storeIds } }).select(
        "name location.city"
      );

      storeComparison = storeComparison.map((item) => {
        const store = stores.find(
          (s) => s._id.toString() === item._id.toString()
        );
        return {
          storeId: item._id,
          storeName: store ? store.name : "Unknown Store",
          city: store ? store.location.city : "Unknown",
          totalSales: item.totalSales,
          totalTransactions: item.totalTransactions,
          avgTransaction:
            item.totalTransactions > 0
              ? item.totalSales / item.totalTransactions
              : 0,
        };
      });
    }

    // Get top products
    const topProducts = await Purchase.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          category: { $first: "$items.category" },
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.totalPrice" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      success: true,
      period: {
        start,
        end,
        days: Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
      },
      summary: {
        totalSales,
        totalTransactions,
        totalDiscounts,
        avgTransaction,
        discountRate: totalSales > 0 ? (totalDiscounts / totalSales) * 100 : 0,
      },
      trend: {
        data: salesData,
        chartType: "line",
        xAxis: "dateLabel",
        series: ["totalSales", "totalTransactions"],
      },
      storeComparison,
      topProducts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user analytics
// @route   GET /api/analytics/users
// @access  Private (Admin)
exports.getUserAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    // Set date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    start.setFullYear(start.getFullYear() - 1); // Default to last year

    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: groupBy === "day" ? { $dayOfMonth: "$createdAt" } : null,
          },
          newUsers: { $sum: 1 },
          activeUsers: {
            $sum: {
              $cond: [{ $eq: ["$isActive", true] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // User demographics
    const cityDistribution = await User.aggregate([
      {
        $group: {
          _id: "$city",
          users: { $sum: 1 },
        },
      },
      { $sort: { users: -1 } },
      { $limit: 10 },
    ]);

    const areaDistribution = await User.aggregate([
      {
        $group: {
          _id: { city: "$city", area: "$area" },
          users: { $sum: 1 },
        },
      },
      { $sort: { users: -1 } },
      { $limit: 10 },
    ]);

    // User engagement
    const userEngagement = await Purchase.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$userId",
          purchaseCount: { $sum: 1 },
          totalSpent: { $sum: "$finalAmount" },
          lastPurchase: { $max: "$createdAt" },
        },
      },
      {
        $bucket: {
          groupBy: "$purchaseCount",
          boundaries: [0, 1, 2, 3, 5, 10, 100],
          default: "10+",
          output: {
            users: { $sum: 1 },
            totalSpent: { $sum: "$totalSpent" },
            avgPurchaseValue: { $avg: "$totalSpent" },
          },
        },
      },
    ]);

    // Active vs inactive users
    const userStatus = await User.aggregate([
      {
        $group: {
          _id: {
            isActive: "$isActive",
            hasPurchased: {
              $cond: [
                {
                  $in: ["$_id", { $ifNull: [Purchase.distinct("userId"), []] }],
                },
                true,
                false,
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      period: { start, end },
      userGrowth: {
        data: userGrowth,
        totalUsers: await User.countDocuments(),
        newUsers: await User.countDocuments({
          createdAt: { $gte: start, $lte: end },
        }),
      },
      demographics: {
        cities: cityDistribution,
        areas: areaDistribution,
        topCities: cityDistribution.slice(0, 5),
      },
      engagement: userEngagement,
      userStatus,
      metrics: {
        avgPurchasesPerUser:
          (await Purchase.countDocuments()) / (await User.countDocuments()),
        repeatCustomerRate:
          ((await Purchase.distinct("userId")).length /
            (await User.countDocuments())) *
          100,
        avgCustomerValue:
          (
            await Purchase.aggregate([
              { $group: { _id: null, total: { $sum: "$finalAmount" } } },
            ])
          )[0]?.total / (await User.countDocuments()) || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get coupon performance analytics
// @route   GET /api/analytics/coupons
// @access  Private (Admin)
exports.getCouponAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    start.setMonth(start.getMonth() - 6); // Default to last 6 months

    // Coupon redemptions over time
    const redemptionTrend = await Purchase.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          "couponUsed.userCouponId": { $exists: true },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          redemptions: { $sum: 1 },
          discountValue: { $sum: "$discount" },
          salesValue: { $sum: "$finalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top performing coupons
    const topCoupons = await Purchase.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          "couponUsed.userCouponId": { $exists: true },
        },
      },
      {
        $lookup: {
          from: "usercoupons",
          localField: "couponUsed.userCouponId",
          foreignField: "_id",
          as: "userCoupon",
        },
      },
      { $unwind: "$userCoupon" },
      {
        $lookup: {
          from: "coupons",
          localField: "userCoupon.couponId",
          foreignField: "_id",
          as: "coupon",
        },
      },
      { $unwind: "$coupon" },
      {
        $group: {
          _id: "$coupon._id",
          code: { $first: "$coupon.code" },
          title: { $first: "$coupon.title" },
          value: { $first: "$coupon.value" },
          redemptions: { $sum: 1 },
          discountGiven: { $sum: "$discount" },
          salesGenerated: { $sum: "$finalAmount" },
          avgPurchase: { $avg: "$finalAmount" },
        },
      },
      { $sort: { redemptions: -1 } },
      { $limit: 10 },
    ]);

    // Coupon effectiveness by targeting type
    const byTargetingType = await Coupon.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$targeting.type",
          coupons: { $sum: 1 },
          totalRedemptions: { $sum: "$currentRedemptions" },
          avgRedemptionRate: {
            $avg: { $divide: ["$currentRedemptions", "$maxRedemptions"] },
          },
        },
      },
    ]);

    // Redemption rates
    const allCoupons = await Coupon.find({
      createdAt: { $gte: start, $lte: end },
    }).select(
      "code title value targeting.type maxRedemptions currentRedemptions validUntil status"
    );

    const redemptionRates = allCoupons.map((coupon) => ({
      code: coupon.code,
      title: coupon.title,
      type: coupon.targeting.type,
      max: coupon.maxRedemptions,
      current: coupon.currentRedemptions,
      rate:
        coupon.maxRedemptions > 0
          ? (coupon.currentRedemptions / coupon.maxRedemptions) * 100
          : 0,
      status: coupon.status,
      isExpired: new Date() > coupon.validUntil,
    }));

    res.status(200).json({
      success: true,
      period: { start, end },
      summary: {
        totalCoupons: allCoupons.length,
        activeCoupons: allCoupons.filter(
          (c) => c.status === "ACTIVE" && new Date() < c.validUntil
        ).length,
        totalRedemptions: allCoupons.reduce(
          (sum, c) => sum + c.currentRedemptions,
          0
        ),
        avgRedemptionRate:
          allCoupons.length > 0
            ? (allCoupons.reduce(
                (sum, c) => sum + c.currentRedemptions / c.maxRedemptions,
                0
              ) /
                allCoupons.length) *
              100
            : 0,
      },
      trend: redemptionTrend,
      topCoupons,
      byTargetingType,
      redemptionRates,
      insights: {
        bestPerforming: topCoupons[0],
        worstPerforming: topCoupons[topCoupons.length - 1],
        mostEffectiveType: byTargetingType.reduce((max, item) =>
          item.avgRedemptionRate > max.avgRedemptionRate ? item : max
        ),
        expirationAlert: allCoupons.filter(
          (c) =>
            c.status === "ACTIVE" &&
            new Date() < c.validUntil &&
            c.validUntil < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ).length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get store performance analytics
// @route   GET /api/analytics/stores
// @access  Private (Admin)
exports.getStoreAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    start.setMonth(start.getMonth() - 3); // Default to last 3 months

    // Store performance
    const storePerformance = await Purchase.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: "COMPLETED",
        },
      },
      {
        $group: {
          _id: "$storeId",
          totalSales: { $sum: "$finalAmount" },
          totalTransactions: { $sum: 1 },
          totalDiscounts: { $sum: "$discount" },
          uniqueCustomers: { $addToSet: "$userId" },
          avgTransaction: { $avg: "$finalAmount" },
        },
      },
      {
        $addFields: {
          uniqueCustomersCount: { $size: "$uniqueCustomers" },
        },
      },
      { $sort: { totalSales: -1 } },
    ]);

    // Get store details
    const storeIds = storePerformance.map((item) => item._id);
    const stores = await Store.find({ _id: { $in: storeIds } }).select(
      "name location.city location.area type"
    );

    const performanceWithDetails = storePerformance.map((item) => {
      const store = stores.find(
        (s) => s._id.toString() === item._id.toString()
      );
      return {
        ...item,
        store: store || {
          name: "Unknown Store",
          location: { city: "Unknown", area: "Unknown" },
        },
      };
    });

    // Sales trend by store
    const salesTrend = await Purchase.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: "COMPLETED",
        },
      },
      {
        $group: {
          _id: {
            storeId: "$storeId",
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            week: { $week: "$createdAt" },
          },
          sales: { $sum: "$finalAmount" },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // City-wise performance
    const cityPerformance = await Store.aggregate([
      {
        $lookup: {
          from: "purchases",
          localField: "_id",
          foreignField: "storeId",
          as: "purchases",
        },
      },
      {
        $project: {
          name: 1,
          city: "$location.city",
          sales: { $sum: "$purchases.finalAmount" },
          transactions: { $size: "$purchases" },
        },
      },
      {
        $group: {
          _id: "$city",
          stores: { $sum: 1 },
          totalSales: { $sum: "$sales" },
          totalTransactions: { $sum: "$transactions" },
        },
      },
      { $sort: { totalSales: -1 } },
    ]);

    // Store comparison metrics
    const comparisonMetrics = {
      highestSales: performanceWithDetails[0],
      highestTransactions: performanceWithDetails.reduce((max, item) =>
        item.totalTransactions > max.totalTransactions ? item : max
      ),
      highestAvgTransaction: performanceWithDetails.reduce((max, item) =>
        item.avgTransaction > max.avgTransaction ? item : max
      ),
      bestCustomerRetention: performanceWithDetails.reduce((max, item) =>
        item.uniqueCustomersCount / item.totalTransactions >
        max.uniqueCustomersCount / max.totalTransactions
          ? item
          : max
      ),
    };

    res.status(200).json({
      success: true,
      period: { start, end },
      storePerformance: performanceWithDetails,
      salesTrend,
      cityPerformance,
      comparisonMetrics,
      summary: {
        totalStores: stores.length,
        totalSales: storePerformance.reduce(
          (sum, item) => sum + item.totalSales,
          0
        ),
        totalTransactions: storePerformance.reduce(
          (sum, item) => sum + item.totalTransactions,
          0
        ),
        avgStorePerformance:
          storePerformance.length > 0
            ? storePerformance.reduce((sum, item) => sum + item.totalSales, 0) /
              storePerformance.length
            : 0,
      },
      recommendations: this.generateStoreRecommendations(
        performanceWithDetails
      ),
    });
  } catch (error) {
    next(error);
  }
};

// Helper method to generate store recommendations
exports.generateStoreRecommendations = (storePerformance) => {
  const recommendations = [];

  storePerformance.forEach((store) => {
    const performanceScore =
      (store.totalSales / store.totalTransactions) *
      (store.uniqueCustomersCount / store.totalTransactions);

    if (performanceScore < 10000) {
      recommendations.push({
        store: store.store.name,
        issue: "Low average transaction value",
        recommendation:
          "Train staff on upselling techniques, promote high-value products",
      });
    }

    if (store.uniqueCustomersCount / store.totalTransactions < 0.3) {
      recommendations.push({
        store: store.store.name,
        issue: "Low customer retention",
        recommendation:
          "Implement loyalty program, send personalized offers to repeat customers",
      });
    }

    if (store.totalDiscounts / store.totalSales > 0.3) {
      recommendations.push({
        store: store.store.name,
        issue: "High discount rate",
        recommendation:
          "Review discount strategy, focus on value-added services instead of price cuts",
      });
    }
  });

  return recommendations.slice(0, 5); // Return top 5 recommendations
};
