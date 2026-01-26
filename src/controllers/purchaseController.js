import Purchase from "../models/Purchase.model.js";
import Product from "../models/Product.model.js";
import User from "../models/User.model.js";
import UserCoupon from "../models/UserCoupon.model.js";
import Referral from "../models/Referral.model.js";
import NotificationService from "../services/notificationService.js";

// @desc    Record a purchase (for store staff)
// @route   POST /api/purchases
// @access  Private (Store staff)
export const recordPurchase = async (req, res, next) => {
  try {
    const {
      userId,
      storeId,
      items,
      discount = 0,
      tax = 0,
      couponCode,
      paymentMethod = "CASH",
      delivery = {},
      notes = "",
    } = req.body;

    // Validate required fields
    if (
      !userId ||
      !storeId ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Please provide user ID, store ID, and at least one item",
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Verify store exists
    const Store = require("../models/Store.model.js");
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: "Store not found",
      });
    }

    // Process items
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product not found: ${item.productId}`,
        });
      }

      const unitPrice = item.unitPrice || product.sellingPrice;
      const quantity = item.quantity || 1;
      const totalPrice = unitPrice * quantity;

      processedItems.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        brand: product.brand,
        model: product.model,
        quantity,
        unitPrice,
        totalPrice,
        specifications: product.specifications,
      });

      subtotal += totalPrice;

      // Update product stock if needed
      if (product.availableInStores && product.availableInStores.length > 0) {
        const storeIndex = product.availableInStores.findIndex(
          (s) => s.storeId.toString() === storeId.toString(),
        );

        if (
          storeIndex !== -1 &&
          product.availableInStores[storeIndex].stock >= quantity
        ) {
          product.availableInStores[storeIndex].stock -= quantity;
          product.overallStock -= quantity;
          await product.save();
        }
      }
    }

    // Handle coupon if provided
    let couponUsed = null;
    if (couponCode) {
      // Find user coupon
      const userCoupon = await UserCoupon.findOne({
        uniqueCode: couponCode,
        userId: userId,
        status: "ACTIVE",
      }).populate("couponId");

      if (userCoupon) {
        // Validate coupon
        if (userCoupon.isExpired) {
          return res.status(400).json({
            success: false,
            error: "Coupon has expired",
          });
        }

        // Check minimum purchase
        if (userCoupon.couponId.minPurchaseAmount > subtotal) {
          return res.status(400).json({
            success: false,
            error: `Minimum purchase of ₹${userCoupon.couponId.minPurchaseAmount} required for this coupon`,
          });
        }

        // Calculate discount from coupon
        const couponDiscount = userCoupon.couponId.calculateDiscount(subtotal);

        // Update discount
        discount = Math.max(discount, couponDiscount);

        // Mark coupon for redemption
        couponUsed = {
          userCouponId: userCoupon._id,
          couponCode: userCoupon.couponId.code,
          discountApplied: couponDiscount,
        };
      }
    }

    // Calculate final amount
    const finalAmount = subtotal - discount + tax;

    // Create purchase record
    const purchase = new Purchase({
      userId,
      storeId,
      staffId: req.staff?.username || "system",
      items: processedItems,
      subtotal,
      discount,
      tax,
      finalAmount,
      couponUsed,
      payment: {
        method: paymentMethod,
        status: "COMPLETED",
      },
      delivery,
      notes,
      status: "COMPLETED",
    });

    await purchase.save();

    // Mark coupon as redeemed if used
    if (couponUsed && couponUsed.userCouponId) {
      const userCoupon = await UserCoupon.findById(couponUsed.userCouponId);
      if (userCoupon) {
        await userCoupon.redeem(
          storeId,
          req.staff?.username || "system",
          purchase._id,
          couponUsed.discountApplied,
        );
      }
    }

    // Check if this is user's first purchase (for referral completion)
    const userPurchaseCount = await Purchase.countDocuments({ userId: userId });
    if (userPurchaseCount === 1) {
      // Find pending referral for this user
      const referral = await Referral.findOne({
        referredUserId: userId,
        status: "PENDING",
      });

      if (referral) {
        await referral.markAsFirstPurchase(purchase._id);

        // Send notification to referrer
        await NotificationService.sendPushNotification(
          referral.referrerId,
          "Referral Completed!",
          `${user.name} made their first purchase. You've earned a ₹500 coupon!`,
        );
      }
    }

    // Send receipt to user
    await NotificationService.sendSMS(
      user.mobile,
      `Thank you for shopping at RK Electronics! Your purchase of ₹${finalAmount} is confirmed. Invoice: ${purchase.invoiceNumber}. Keep this app for future offers.`,
    );

    res.status(201).json({
      success: true,
      purchase: {
        id: purchase._id,
        invoiceNumber: purchase.invoiceNumber,
        date: purchase.createdAt,
        customer: {
          name: user.name,
          mobile: user.mobile,
        },
        store: {
          name: store.name,
          address: store.location.address,
        },
        items: purchase.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
          total: item.totalPrice,
        })),
        summary: {
          subtotal: purchase.subtotal,
          discount: purchase.discount,
          tax: purchase.tax,
          finalAmount: purchase.finalAmount,
        },
        payment: purchase.payment.method,
        couponUsed: purchase.couponUsed
          ? {
              code: purchase.couponUsed.couponCode,
              discount: purchase.couponUsed.discountApplied,
            }
          : null,
      },
      message: "Purchase recorded successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get purchase by ID
// @route   GET /api/purchases/:id
// @access  Private (User or Store staff)
export const getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate(
        "storeId",
        "name location.address location.city location.area contact.phone",
      )
      .populate("items.productId", "name brand model specifications images")
      .populate("userId", "name mobile city area");

    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: "Purchase not found",
      });
    }

    // Check authorization
    if (req.user && purchase.userId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to view this purchase",
      });
    }

    // Format items for display
    const formattedItems = purchase.items.map((item) => ({
      product: item.productId
        ? {
            name: item.productId.name,
            brand: item.productId.brand,
            model: item.productId.model,
            images: item.productId.images,
          }
        : {
            name: item.name,
            brand: item.brand,
            model: item.model,
          },
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    res.status(200).json({
      success: true,
      purchase: {
        id: purchase._id,
        invoiceNumber: purchase.invoiceNumber,
        date: purchase.createdAt,
        customer: purchase.userId,
        store: purchase.storeId,
        items: formattedItems,
        summary: {
          subtotal: purchase.subtotal,
          discount: purchase.discount,
          tax: purchase.tax,
          finalAmount: purchase.finalAmount,
        },
        payment: purchase.payment,
        delivery: purchase.delivery,
        warranty: purchase.warranty,
        status: purchase.status,
      },
      receipt: {
        company: "RK Electronics",
        address: "Multiple locations across Karnataka",
        contact: "1800-123-4567",
        email: "support@rkelectronics.com",
        terms:
          "Goods sold are not returnable unless defective. Warranty as per manufacturer terms.",
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update purchase status
// @route   PUT /api/purchases/:id/status
// @access  Private (Store staff or Admin)
export const updatePurchaseStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Please provide status",
      });
    }

    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: "Purchase not found",
      });
    }

    purchase.status = status;
    if (notes) purchase.notes = notes;
    purchase.updatedAt = new Date();

    await purchase.save();

    // Send notification to user if status changed to DELIVERED or INSTALLED
    if (status === "DELIVERED" || status === "INSTALLED") {
      const user = await User.findById(purchase.userId);
      if (user) {
        await NotificationService.sendSMS(
          user.mobile,
          `Your order ${
            purchase.invoiceNumber
          } has been ${status.toLowerCase()}. Thank you for choosing RK Electronics!`,
        );
      }
    }

    res.status(200).json({
      success: true,
      purchase: {
        id: purchase._id,
        invoiceNumber: purchase.invoiceNumber,
        status: purchase.status,
        updatedAt: purchase.updatedAt,
      },
      message: `Purchase status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add rating and feedback to purchase
// @route   POST /api/purchases/:id/rating
// @access  Private (User)
export const addRating = async (req, res, next) => {
  try {
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: "Please provide a rating between 1 and 5",
      });
    }

    const purchase = await Purchase.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: "Purchase not found",
      });
    }

    purchase.rating = rating;
    purchase.feedback = feedback;
    purchase.updatedAt = new Date();

    await purchase.save();

    // Update store average rating (in a real app, you'd have a rating system)
    const Store = require("../models/Store.model.js");
    const store = await Store.findById(purchase.storeId);

    res.status(200).json({
      success: true,
      message: "Thank you for your feedback!",
      purchase: {
        id: purchase._id,
        invoiceNumber: purchase.invoiceNumber,
        rating: purchase.rating,
        feedback: purchase.feedback,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sales report for store
// @route   GET /api/purchases/report/store/:storeId
// @access  Private (Store staff or Admin)
export const getStoreSalesReport = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { startDate, endDate, groupBy = "day" } = req.query;

    const Store = require("../models/Store.model.js");
    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: "Store not found",
      });
    }

    // Set date range (default to last 30 days)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);

    const matchStage = {
      storeId: store._id,
      status: "COMPLETED",
      createdAt: { $gte: start, $lte: end },
    };

    let groupStage;

    switch (groupBy) {
      case "hour":
        groupStage = {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
            hour: { $hour: "$createdAt" },
          },
          date: { $first: "$createdAt" },
        };
        break;

      case "day":
        groupStage = {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          date: { $first: "$createdAt" },
        };
        break;

      case "week":
        groupStage = {
          _id: {
            year: { $year: "$createdAt" },
            week: { $week: "$createdAt" },
          },
          date: { $first: "$createdAt" },
        };
        break;

      case "month":
        groupStage = {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          date: { $first: "$createdAt" },
        };
        break;

      default:
        groupStage = {
          _id: null,
          date: { $first: "$createdAt" },
        };
    }

    const report = await Purchase.aggregate([
      { $match: matchStage },
      {
        $group: {
          ...groupStage,
          totalSales: { $sum: "$finalAmount" },
          totalTransactions: { $sum: 1 },
          averageTransaction: { $avg: "$finalAmount" },
          totalDiscounts: { $sum: "$discount" },
          uniqueCustomers: { $addToSet: "$userId" },
        },
      },
      {
        $addFields: {
          uniqueCustomersCount: { $size: "$uniqueCustomers" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Calculate summary
    const summary = {
      totalSales: report.reduce((sum, item) => sum + item.totalSales, 0),
      totalTransactions: report.reduce(
        (sum, item) => sum + item.totalTransactions,
        0,
      ),
      totalDiscounts: report.reduce(
        (sum, item) => sum + item.totalDiscounts,
        0,
      ),
      averageTransaction:
        report.reduce((sum, item) => sum + item.averageTransaction, 0) /
          report.length || 0,
    };

    res.status(200).json({
      success: true,
      store: {
        name: store.name,
        city: store.location.city,
        area: store.location.area,
      },
      period: {
        start: start,
        end: end,
        days: Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
      },
      report,
      summary,
      metrics: {
        salesPerDay:
          summary.totalSales / Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
        transactionsPerDay:
          summary.totalTransactions /
          Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
        discountRate: (summary.totalDiscounts / summary.totalSales) * 100 || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export purchases to Excel
// @route   GET /api/purchases/export
// @access  Private (Admin)
export const exportPurchases = async (req, res, next) => {
  try {
    const { startDate, endDate, storeId } = req.query;

    const query = { status: "COMPLETED" };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (storeId) {
      query.storeId = storeId;
    }

    const purchases = await Purchase.find(query)
      .populate("storeId", "name location.city location.area")
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 })
      .limit(1000); // Limit for export

    // Generate Excel file
    const { exportSalesReportToExcel } = require("../utils/excelHelper");
    const result = await exportSalesReportToExcel(purchases);

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

// @desc    Get logged-in user's purchase history
// @route   GET /api/purchases/my
// @access  Private (User)
export const getMyPurchases = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const purchases = await Purchase.find({ userId: req.user.id })
      .populate("storeId", "name location.city location.area")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Purchase.countDocuments({ userId: req.user.id });

    res.json({
      success: true,
      total,
      page: Number(page),
      purchases,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get purchases for a store
// @route   GET /api/purchases/store/:storeId
// @access  Private (Store staff / Admin)
export const getStorePurchases = async (req, res, next) => {
  try {
    const purchases = await Purchase.find({
      storeId: req.params.storeId,
    })
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: purchases.length,
      purchases,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all purchases
// @route   GET /api/purchases
// @access  Private (Admin)
export const getAllPurchases = async (req, res, next) => {
  try {
    const purchases = await Purchase.find()
      .populate("storeId", "name location.city")
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: purchases.length,
      purchases,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel a purchase
// @route   PUT /api/purchases/:id/cancel
// @access  Private (Admin / Store staff)
export const cancelPurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, error: "Purchase not found" });
    }

    if (purchase.status !== "COMPLETED") {
      return res.status(400).json({
        success: false,
        error: "Only completed purchases can be cancelled",
      });
    }

    purchase.status = "CANCELLED";
    await purchase.save();

    res.json({
      success: true,
      message: "Purchase cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refund a purchase
// @route   PUT /api/purchases/:id/refund
// @access  Private (Admin)
export const refundPurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, error: "Purchase not found" });
    }

    purchase.status = "REFUNDED";
    await purchase.save();

    res.json({
      success: true,
      message: "Purchase refunded successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update feedback
// @route   PUT /api/purchases/:id/feedback
// @access  Private (User)
export const updateFeedback = async (req, res, next) => {
  try {
    const { feedback } = req.body;

    const purchase = await Purchase.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, error: "Purchase not found" });
    }

    purchase.feedback = feedback;
    await purchase.save();

    res.json({
      success: true,
      message: "Feedback updated",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user spending summary
// @route   GET /api/purchases/report/user/:userId
// @access  Private (Admin)
export const getUserSpendingReport = async (req, res, next) => {
  try {
    const report = await Purchase.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.params.userId) } },
      {
        $group: {
          _id: "$userId",
          totalSpent: { $sum: "$finalAmount" },
          totalOrders: { $sum: 1 },
          averageOrder: { $avg: "$finalAmount" },
        },
      },
    ]);

    res.json({
      success: true,
      report: report[0] || {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete purchase (hard delete)
// @route   DELETE /api/purchases/:id
// @access  Private (Admin)
export const deletePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, error: "Purchase not found" });
    }

    await purchase.deleteOne();

    res.json({
      success: true,
      message: "Purchase deleted permanently",
    });
  } catch (error) {
    next(error);
  }
};
