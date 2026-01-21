const User = require("../models/User.model.js");
const UserCoupon = require("../models/UserCoupon.model.js");
const Purchase = require("../models/Purchase.model.js");
const { formatCurrency } = require("../utils/common");

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-deviceTokens")
      .populate(
        "registrationStore",
        "name location.address location.city location.area"
      );

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's coupons
// @route   GET /api/users/coupons
// @access  Private
exports.getUserCoupons = async (req, res, next) => {
  try {
    const { status = "ACTIVE", page = 1, limit = 20 } = req.query;

    const query = { userId: req.user.id };

    if (status !== "ALL") {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const userCoupons = await UserCoupon.find(query)
      .populate(
        "couponId",
        "code title description type value minPurchaseAmount productRules"
      )
      .populate("redemption.storeId", "name location.address")
      .sort({ assignedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UserCoupon.countDocuments(query);

    // Categorize coupons
    const categorizedCoupons = {
      active: [],
      used: [],
      expired: [],
    };

    userCoupons.forEach((coupon) => {
      if (coupon.status === "ACTIVE" && !coupon.isExpired) {
        categorizedCoupons.active.push(coupon);
      } else if (coupon.status === "USED") {
        categorizedCoupons.used.push(coupon);
      } else {
        categorizedCoupons.expired.push(coupon);
      }
    });

    res.status(200).json({
      success: true,
      count: userCoupons.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      categorizedCoupons,
      coupons: userCoupons,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get specific coupon with QR code
// @route   GET /api/users/coupons/:id
// @access  Private
exports.getCouponById = async (req, res, next) => {
  try {
    const userCoupon = await UserCoupon.findOne({
      _id: req.params.id,
      userId: req.user.id,
    })
      .populate(
        "couponId",
        "code title description type value minPurchaseAmount productRules validUntil"
      )
      .populate(
        "redemption.storeId",
        "name location.address location.city location.area"
      );

    if (!userCoupon) {
      return res.status(404).json({
        success: false,
        error: "Coupon not found",
      });
    }

    // Get store locations where this coupon can be redeemed
    const Coupon = require("../models/Coupon.model.js");
    const coupon = await Coupon.findById(userCoupon.couponId);

    let applicableStores = [];
    if (
      coupon.targeting.type === "GEOGRAPHIC" &&
      coupon.targeting.geographic.stores
    ) {
      const Store = require("../models/Store.model.js");
      applicableStores = await Store.find({
        _id: { $in: coupon.targeting.geographic.stores },
      }).select(
        "name location.address location.city location.area contact.phone"
      );
    }

    res.status(200).json({
      success: true,
      coupon: userCoupon,
      applicableStores,
      redemptionInstructions: {
        step1: "Visit any RK Electronics store from the list below",
        step2: "Show this QR code to the store staff",
        step3: "Staff will scan and apply discount to your purchase",
        step4:
          "Alternative: Provide this code if QR fails: " +
          userCoupon.uniqueCode,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's purchase history
// @route   GET /api/users/purchases
// @access  Private
exports.getPurchaseHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, storeId } = req.query;

    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (storeId) {
      query.storeId = storeId;
    }

    const purchases = await Purchase.find(query)
      .populate("storeId", "name location.address location.city location.area")
      .populate("items.productId", "name category brand model images")
      .populate("couponUsed.userCouponId", "uniqueCode")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Purchase.countDocuments(query);

    // Calculate totals
    const totalSpent = await Purchase.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: "$finalAmount" },
          savings: { $sum: "$discount" },
        },
      },
    ]);

    const totalSavings = totalSpent.length > 0 ? totalSpent[0].savings : 0;
    const formattedTotalSavings = formatCurrency(totalSavings);

    res.status(200).json({
      success: true,
      count: purchases.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      purchases,
      summary: {
        totalPurchases: total,
        totalSpent: totalSpent.length > 0 ? totalSpent[0].total : 0,
        formattedTotalSpent: formatCurrency(
          totalSpent.length > 0 ? totalSpent[0].total : 0
        ),
        totalSavings,
        formattedTotalSavings,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get specific purchase invoice
// @route   GET /api/users/purchases/:id
// @access  Private
exports.getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      userId: req.user.id,
    })
      .populate(
        "storeId",
        "name location.address location.city location.area contact.phone contact.manager.name"
      )
      .populate(
        "items.productId",
        "name category brand model specifications images"
      )
      .populate("couponUsed.userCouponId", "uniqueCode couponId")
      .populate("couponUsed.userCouponId.couponId", "title value");

    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: "Purchase not found",
      });
    }

    res.status(200).json({
      success: true,
      purchase,
      invoiceDetails: {
        company: "RK Electronics",
        address: "Multiple locations across Karnataka",
        contact: "1800-123-4567",
        email: "support@rkelectronics.com",
        website: "www.rkelectronics.com",
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's referral information
// @route   GET /api/users/referral
// @access  Private
exports.getReferralInfo = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("referralCode name");

    const Referral = require("../models/Referral.model.js");
    const referrals = await Referral.find({ referrerId: req.user.id })
      .populate("referredUserId", "name mobile city area createdAt")
      .sort({ referralDate: -1 });

    const stats = await Referral.getUserStats(req.user.id);

    // Generate referral link
    const referralLink = `https://rkelectronics.com/register?ref=${user.referralCode}`;

    // Share message
    const shareMessage = `Shop at RK Electronics and get amazing deals on electronics! Use my referral code ${user.referralCode} to get ₹300 off on your first purchase. Download app now: ${referralLink}`;

    res.status(200).json({
      success: true,
      referralCode: user.referralCode,
      referralLink,
      shareMessage,
      stats,
      referrals: referrals.map((ref) => ({
        referredUser: ref.referredUserId,
        status: ref.status,
        referralDate: ref.referralDate,
        rewards: ref.rewards,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user preferences
// @route   PUT /api/users/preferences
// @access  Private
exports.updatePreferences = async (req, res, next) => {
  try {
    const { notifications, smsAlerts } = req.body;

    const updateFields = {};

    if (notifications !== undefined) {
      updateFields["preferences.notifications"] = notifications;
    }

    if (smsAlerts !== undefined) {
      updateFields["preferences.smsAlerts"] = smsAlerts;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select("-deviceTokens");

    res.status(200).json({
      success: true,
      user,
      message: "Preferences updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's saved addresses
// @route   GET /api/users/addresses
// @access  Private
exports.getAddresses = async (req, res, next) => {
  try {
    // In a future version, users might have multiple addresses
    // For now, just return their registered city/area

    const user = await User.findById(req.user.id).select("city area");

    const addresses = [
      {
        type: "primary",
        city: user.city,
        area: user.area,
        isDefault: true,
      },
    ];

    res.status(200).json({
      success: true,
      addresses,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
exports.deleteAccount = async (req, res, next) => {
  try {
    // In production, you might want to soft delete or anonymize data
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Mark as inactive instead of deleting
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Account deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};
