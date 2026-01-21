const User = require("../models/User.model.js");
const Coupon = require("../models/Coupon.model.js");
const Product = require("../models/Product.model.js");
const Store = require("../models/Store.model.js");
const Purchase = require("../models/Purchase.model.js");
const TargetingService = require("../services/targetingService");
const NotificationService = require("../services/notificationService");
const { exportUsersToExcel } = require("../utils/excelHelper");

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
exports.getDashboard = async (req, res, next) => {
  try {
    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // User statistics
    const totalUsers = await User.countDocuments();
    const todayUsers = await User.countDocuments({
      createdAt: { $gte: today },
    });
    const yesterdayUsers = await User.countDocuments({
      createdAt: { $gte: yesterday, $lt: today },
    });
    const userGrowth =
      yesterdayUsers > 0
        ? (((todayUsers - yesterdayUsers) / yesterdayUsers) * 100).toFixed(1)
        : 0;

    // Purchase statistics
    const totalPurchases = await Purchase.countDocuments({
      status: "COMPLETED",
    });
    const todayPurchases = await Purchase.countDocuments({
      status: "COMPLETED",
      createdAt: { $gte: today },
    });
    const todayRevenue = await Purchase.aggregate([
      { $match: { status: "COMPLETED", createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]);
    const totalRevenue = await Purchase.aggregate([
      { $match: { status: "COMPLETED" } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]);

    // Coupon statistics
    const totalCoupons = await Coupon.countDocuments();
    const activeCoupons = await Coupon.countDocuments({
      status: "ACTIVE",
      validUntil: { $gte: new Date() },
    });
    const todayRedemptions = await Purchase.aggregate([
      {
        $match: {
          status: "COMPLETED",
          createdAt: { $gte: today },
          "couponUsed.userCouponId": { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          discount: { $sum: "$discount" },
        },
      },
    ]);

    // Store statistics
    const totalStores = await Store.countDocuments({ isActive: true });
    const storeCities = await Store.distinct("location.city", {
      isActive: true,
    });

    // User growth trend (last 7 days)
    const userTrend = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: lastWeek },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 7 },
    ]);

    // Top selling products
    const topProducts = await Purchase.aggregate([
      { $match: { status: "COMPLETED", createdAt: { $gte: lastMonth } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.totalPrice" },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
    ]);

    // City-wise user distribution
    const cityDistribution = await User.aggregate([
      {
        $group: {
          _id: "$city",
          users: { $sum: 1 },
        },
      },
      { $sort: { users: -1 } },
      { $limit: 5 },
    ]);

    res.status(200).json({
      success: true,
      dashboard: {
        overview: {
          totalUsers,
          todayUsers,
          userGrowth: `${userGrowth}%`,
          totalPurchases,
          todayPurchases,
          todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
          totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
          totalCoupons,
          activeCoupons,
          todayRedemptions:
            todayRedemptions.length > 0 ? todayRedemptions[0].count : 0,
          todayDiscounts:
            todayRedemptions.length > 0 ? todayRedemptions[0].discount : 0,
          totalStores,
          storeCities: storeCities.length,
        },
        trends: {
          userGrowth: userTrend.map((day) => ({
            date: `${day._id.day}/${day._id.month}`,
            users: day.count,
          })),
          topProducts,
          cityDistribution,
        },
        quickStats: {
          avgTransaction:
            totalPurchases > 0
              ? (totalRevenue[0]?.total || 0) / totalPurchases
              : 0,
          redemptionRate:
            totalPurchases > 0
              ? ((todayRedemptions[0]?.count || 0) / totalPurchases) * 100
              : 0,
          userActivation:
            totalUsers > 0 ? (totalPurchases / totalUsers) * 100 : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new coupon
// @route   POST /api/admin/coupons
// @access  Private (Admin)
exports.createCoupon = async (req, res, next) => {
  try {
    const {
      code,
      title,
      description,
      type = "FIXED_AMOUNT",
      value,
      maxDiscount,
      minPurchaseAmount = 0,
      targeting = {},
      productRules = {},
      validFrom,
      validUntil,
      maxRedemptions = 1000,
      perUserLimit = 1,
    } = req.body;

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        error: "Coupon code already exists",
      });
    }

    // Create coupon
    const coupon = new Coupon({
      code: code.toUpperCase(),
      title,
      description,
      type,
      value,
      maxDiscount,
      minPurchaseAmount,
      targeting,
      productRules,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      maxRedemptions,
      perUserLimit,
      status: "ACTIVE",
      createdBy: req.admin ? req.admin._id : null,
    });

    await coupon.save();

    // If targeting is set, assign to eligible users
    let assignmentResult = null;
    if (
      coupon.targeting.type !== "INDIVIDUAL" ||
      (coupon.targeting.type === "INDIVIDUAL" &&
        coupon.targeting.users &&
        coupon.targeting.users.length > 0)
    ) {
      assignmentResult = await TargetingService.assignCouponToEligibleUsers(
        coupon._id
      );
    }

    res.status(201).json({
      success: true,
      coupon,
      assignment: assignmentResult,
      message: "Coupon created successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update coupon
// @route   PUT /api/admin/coupons/:id
// @access  Private (Admin)
exports.updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: "Coupon not found",
      });
    }

    // Update fields
    const updatableFields = [
      "title",
      "description",
      "value",
      "maxDiscount",
      "minPurchaseAmount",
      "targeting",
      "productRules",
      "validFrom",
      "validUntil",
      "maxRedemptions",
      "perUserLimit",
      "status",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        coupon[field] = req.body[field];
      }
    });

    await coupon.save();

    res.status(200).json({
      success: true,
      coupon,
      message: "Coupon updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get users with filters
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getUsers = async (req, res, next) => {
  try {
    const {
      city,
      area,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 50,
      hasPurchases = false,
    } = req.query;

    // Build query
    const query = {};

    if (city) {
      query.city = new RegExp(city, "i");
    }

    if (area) {
      query.area = new RegExp(area, "i");
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { mobile: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }

    if (hasPurchases === "true") {
      const usersWithPurchases = await Purchase.distinct("userId");
      query._id = { $in: usersWithPurchases };
    }

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    // Get users with purchase stats
    const users = await User.find(query)
      .select("-deviceTokens -password")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get user statistics
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const purchaseCount = await Purchase.countDocuments({
          userId: user._id,
        });
        const totalSpent = await Purchase.aggregate([
          { $match: { userId: user._id } },
          { $group: { _id: null, total: { $sum: "$finalAmount" } } },
        ]);
        const activeCoupons =
          await require("../models/UserCoupon.model.js").countDocuments({
            userId: user._id,
            status: "ACTIVE",
          });

        return {
          ...user.toObject(),
          stats: {
            purchaseCount,
            totalSpent: totalSpent.length > 0 ? totalSpent[0].total : 0,
            activeCoupons,
          },
        };
      })
    );

    const total = await User.countDocuments(query);

    // Get cities and areas for filters
    const cities = await User.distinct("city");
    const areas = city
      ? await User.distinct("area", { city: new RegExp(city, "i") })
      : [];

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      filters: {
        cities,
        areas,
      },
      users: usersWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send notification to users
// @route   POST /api/admin/notifications
// @access  Private (Admin)
exports.sendNotification = async (req, res, next) => {
  try {
    const {
      title,
      body,
      type = "PUSH",
      target = "ALL",
      cities = [],
      areas = [],
      userIds = [],
      schedule,
      data = {},
    } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: "Please provide title and body",
      });
    }

    // Build user query based on target
    let userQuery = {};

    switch (target) {
      case "ALL":
        userQuery = { isActive: true };
        break;

      case "CITY":
        if (!cities || cities.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Please select cities",
          });
        }
        userQuery = { city: { $in: cities }, isActive: true };
        break;

      case "AREA":
        if (!areas || areas.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Please select areas",
          });
        }
        userQuery = { area: { $in: areas }, isActive: true };
        break;

      case "SPECIFIC":
        if (!userIds || userIds.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Please select users",
          });
        }
        userQuery = { _id: { $in: userIds }, isActive: true };
        break;

      case "PURCHASE_HISTORY":
        // Get users with purchase history
        const usersWithPurchases = await Purchase.distinct("userId");
        userQuery = { _id: { $in: usersWithPurchases }, isActive: true };
        break;
    }

    // Get target users
    const targetUsers = await User.find(userQuery).select("_id mobile email");

    if (targetUsers.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No users found matching the criteria",
      });
    }

    // Send notifications
    const userIdsArray = targetUsers.map((user) => user._id);
    const result = await NotificationService.sendBulkNotifications(
      userIdsArray,
      title,
      body,
      type,
      data
    );

    // Schedule if needed
    if (schedule) {
      // In a real app, you'd use a job scheduler like Bull or Agenda
      console.log(`Notification scheduled for ${schedule}`);
    }

    res.status(200).json({
      success: true,
      notification: {
        title,
        body,
        type,
        target,
        targetCount: targetUsers.length,
      },
      result,
      message: `Notification sent to ${result.success} users`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export users to Excel
// @route   GET /api/admin/users/export
// @access  Private (Admin)
exports.exportUsers = async (req, res, next) => {
  try {
    const { city, area, startDate, endDate } = req.query;

    const query = {};

    if (city) {
      query.city = new RegExp(city, "i");
    }

    if (area) {
      query.area = new RegExp(area, "i");
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Get users with their purchase stats
    const users = await User.find(query)
      .select("name mobile email city area createdAt")
      .sort({ createdAt: -1 });

    // Add purchase statistics
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const purchaseCount = await Purchase.countDocuments({
          userId: user._id,
        });
        const totalSpent = await Purchase.aggregate([
          { $match: { userId: user._id } },
          { $group: { _id: null, total: { $sum: "$finalAmount" } } },
        ]);
        const activeCoupons =
          await require("../models/UserCoupon.model.js").countDocuments({
            userId: user._id,
            status: "ACTIVE",
          });

        return {
          ...user.toObject(),
          purchaseCount,
          totalSpent: totalSpent.length > 0 ? totalSpent[0].total : 0,
          activeCoupons,
        };
      })
    );

    // Generate Excel file
    const result = await exportUsersToExcel(usersWithStats);

    res.download(result.filePath, result.fileName, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        res.status(500).json({
          success: false,
          error: "Error downloading file",
        });
      }

      // Clean up file after download
      const fs = require("fs");
      fs.unlinkSync(result.filePath);
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Import products from Excel
// @route   POST /api/admin/products/import
// @access  Private (Admin)
exports.importProducts = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload an Excel file",
      });
    }

    const { importProductsFromExcel } = require("../utils/excelHelper");
    const products = await importProductsFromExcel(req.file.path);

    const results = {
      total: products.length,
      imported: 0,
      failed: 0,
      errors: [],
    };

    // Import products
    for (const productData of products) {
      try {
        // Check if product already exists
        const existingProduct = await Product.findOne({ sku: productData.sku });

        if (existingProduct) {
          // Update existing product
          Object.assign(existingProduct, productData);
          await existingProduct.save();
        } else {
          // Create new product
          await Product.create(productData);
        }

        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          sku: productData.sku,
          error: error.message,
        });
      }
    }

    // Clean up file
    const fs = require("fs");
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      results,
      message: `Imported ${results.imported} products successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get coupon analytics
// @route   GET /api/admin/coupons/analytics
// @access  Private (Admin)
exports.getCouponAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Get all coupons with redemption stats
    const coupons = await Coupon.find(query).sort({ createdAt: -1 });

    const analytics = await Promise.all(
      coupons.map(async (coupon) => {
        // Get redemptions for this coupon
        const UserCoupon = require("../models/UserCoupon.model.js");
        const redemptions = await UserCoupon.countDocuments({
          couponId: coupon._id,
          status: "USED",
        });

        // Get redemption value
        const redemptionValue = await UserCoupon.aggregate([
          { $match: { couponId: coupon._id, status: "USED" } },
          { $group: { _id: null, total: { $sum: "$redemption.amountUsed" } } },
        ]);

        // Calculate performance
        const performance =
          coupon.maxRedemptions > 0
            ? (coupon.currentRedemptions / coupon.maxRedemptions) * 100
            : 0;

        return {
          coupon: {
            id: coupon._id,
            code: coupon.code,
            title: coupon.title,
            value: coupon.value,
            type: coupon.type,
            targeting: coupon.targeting.type,
            validUntil: coupon.validUntil,
          },
          stats: {
            maxRedemptions: coupon.maxRedemptions,
            currentRedemptions: coupon.currentRedemptions,
            redemptions,
            redemptionValue:
              redemptionValue.length > 0 ? redemptionValue[0].total : 0,
            performance: Math.round(performance),
            status: coupon.status,
          },
        };
      })
    );

    // Calculate overall metrics
    const totalCoupons = coupons.length;
    const activeCoupons = coupons.filter(
      (c) => c.status === "ACTIVE" && new Date() < c.validUntil
    ).length;
    const totalRedemptions = coupons.reduce(
      (sum, c) => sum + c.currentRedemptions,
      0
    );
    const totalValue = coupons.reduce(
      (sum, c) => sum + c.currentRedemptions * c.value,
      0
    );

    res.status(200).json({
      success: true,
      summary: {
        totalCoupons,
        activeCoupons,
        totalRedemptions,
        totalValue,
        avgRedemptionRate:
          totalCoupons > 0 ? totalRedemptions / totalCoupons : 0,
      },
      analytics,
      timePeriod: {
        startDate: startDate || "Beginning",
        endDate: endDate || "Now",
      },
    });
  } catch (error) {
    next(error);
  }
};
