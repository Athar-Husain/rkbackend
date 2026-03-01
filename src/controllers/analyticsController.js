import User from "../models/User.model.js";
import Purchase from "../models/Purchase.model.js";
import Coupon from "../models/Coupon.model.js";
import Store from "../models/Store.model.js";

/* =========================================================
   SALES ANALYTICS
========================================================= */
export const getSalesAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = "day", storeId } = req.query;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    if (!startDate) start.setDate(start.getDate() - 30);

    const matchStage = {
      status: "COMPLETED",
      createdAt: { $gte: start, $lte: end },
    };

    if (storeId) matchStage.storeId = storeId;

    let groupId = {};

    switch (groupBy) {
      case "hour":
        groupId = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
          hour: { $hour: "$createdAt" },
        };
        break;
      case "week":
        groupId = {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" },
        };
        break;
      case "month":
        groupId = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
        break;
      default:
        groupId = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        };
    }

    const salesData = await Purchase.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupId,
          totalSales: { $sum: "$finalAmount" },
          totalTransactions: { $sum: 1 },
          totalDiscounts: { $sum: "$discount" },
          averageTransaction: { $avg: "$finalAmount" },
          uniqueCustomers: { $addToSet: "$userId" },
        },
      },
      {
        $addFields: {
          uniqueCustomersCount: { $size: "$uniqueCustomers" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    const totalSales = salesData.reduce((sum, i) => sum + i.totalSales, 0);
    const totalTransactions = salesData.reduce(
      (sum, i) => sum + i.totalTransactions,
      0,
    );
    const totalDiscounts = salesData.reduce(
      (sum, i) => sum + i.totalDiscounts,
      0,
    );

    const avgTransaction =
      totalTransactions > 0 ? totalSales / totalTransactions : 0;

    let storeComparison = [];

    if (!storeId) {
      const storeAgg = await Purchase.aggregate([
        { $match: matchStage },
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

      const storeIds = storeAgg.map((s) => s._id);

      const stores = await Store.find({ _id: { $in: storeIds } })
        .select("name location.city")
        .lean();

      storeComparison = storeAgg.map((item) => {
        const store = stores.find(
          (s) => s._id.toString() === item._id.toString(),
        );

        return {
          storeId: item._id,
          storeName: store?.name || "Unknown Store",
          city: store?.location?.city || "Unknown",
          totalSales: item.totalSales,
          totalTransactions: item.totalTransactions,
          avgTransaction:
            item.totalTransactions > 0
              ? item.totalSales / item.totalTransactions
              : 0,
        };
      });
    }

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
      data: {
        period: { start, end },
        summary: {
          totalSales,
          totalTransactions,
          totalDiscounts,
          avgTransaction,
          discountRate:
            totalSales > 0 ? (totalDiscounts / totalSales) * 100 : 0,
        },
        trend: salesData,
        storeComparison,
        topProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   USER ANALYTICS
========================================================= */
export const getUserAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    if (!startDate) start.setFullYear(start.getFullYear() - 1);

    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          newUsers: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const purchasedUserIds = await Purchase.distinct("userId");

    const userStatus = await User.aggregate([
      {
        $addFields: {
          hasPurchased: { $in: ["$_id", purchasedUserIds] },
        },
      },
      {
        $group: {
          _id: {
            isActive: "$isActive",
            hasPurchased: "$hasPurchased",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        period: { start, end },
        userGrowth,
        totalUsers: await User.countDocuments(),
        userStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   COUPON ANALYTICS
========================================================= */
export const getCouponAnalytics = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().lean();

    const summary = {
      totalCoupons: coupons.length,
      activeCoupons: coupons.filter((c) => c.status === "ACTIVE").length,
      totalRedemptions: coupons.reduce(
        (sum, c) => sum + (c.currentRedemptions || 0),
        0,
      ),
    };

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   STORE ANALYTICS
========================================================= */
export const getStoreAnalytics = async (req, res, next) => {
  try {
    const purchases = await Purchase.find({ status: "COMPLETED" }).lean();

    const storeMap = {};

    purchases.forEach((p) => {
      if (!storeMap[p.storeId]) {
        storeMap[p.storeId] = {
          totalSales: 0,
          totalTransactions: 0,
          totalDiscounts: 0,
          customers: new Set(),
        };
      }

      storeMap[p.storeId].totalSales += p.finalAmount;
      storeMap[p.storeId].totalTransactions += 1;
      storeMap[p.storeId].totalDiscounts += p.discount;
      storeMap[p.storeId].customers.add(p.userId.toString());
    });

    const storeIds = Object.keys(storeMap);
    const stores = await Store.find({ _id: { $in: storeIds } }).lean();

    const performance = stores.map((store) => {
      const data = storeMap[store._id] || {};

      return {
        storeId: store._id,
        store,
        totalSales: data.totalSales || 0,
        totalTransactions: data.totalTransactions || 0,
        totalDiscounts: data.totalDiscounts || 0,
        uniqueCustomersCount: data.customers ? data.customers.size : 0,
        avgTransaction:
          data.totalTransactions > 0
            ? data.totalSales / data.totalTransactions
            : 0,
      };
    });

    const recommendations = generateStoreRecommendations(performance);

    res.status(200).json({
      success: true,
      data: {
        storePerformance: performance,
        recommendations,
      },
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   STORE RECOMMENDATION HELPER
========================================================= */
export const generateStoreRecommendations = (storePerformance) => {
  if (!storePerformance || storePerformance.length === 0) return [];

  const recommendations = [];

  storePerformance.forEach((store) => {
    if (store.totalTransactions === 0) return;

    const avgTransaction = store.totalSales / store.totalTransactions;

    const retention = store.uniqueCustomersCount / store.totalTransactions;

    if (avgTransaction < 100) {
      recommendations.push({
        store: store.store.name,
        issue: "Low average transaction value",
        recommendation: "Improve upselling and bundle offers",
      });
    }

    if (retention < 0.3) {
      recommendations.push({
        store: store.store.name,
        issue: "Low customer retention",
        recommendation: "Launch loyalty program and targeted campaigns",
      });
    }

    if (store.totalSales > 0 && store.totalDiscounts / store.totalSales > 0.3) {
      recommendations.push({
        store: store.store.name,
        issue: "High discount dependency",
        recommendation:
          "Reduce discount strategy and increase value-based selling",
      });
    }
  });

  return recommendations.slice(0, 5);
};
