import Banner from "../models/Banner.model.js";
import Promotion from "../models/Promotion.model.js";
import Product from "../models/Product.model.js";
import User from "../models/User.model.js";
import { generateToken } from "../utils/token.js";

/* =====================================================
   HOME DASHBOARD
===================================================== */

export const getHomeDashboard = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const userCity = req.user?.city || null;
    const userArea = req.user?.area || null;

    // Get banners for the user
    const banners = await Banner.getActiveBanners({
      targetingType: userId ? "INDIVIDUAL" : "ALL",
    });

    // Get featured promotions
    const featuredPromotions = await Promotion.getFeaturedPromotions(5);

    // Get active promotions for the user
    const activePromotions = await Promotion.getPromotionsForUser(
      userId,
      { limit: 10 },
    );

    // Get trending products (top 10 by sales or views)
    const trendingProducts = await Product.find({
      isActive: true,
      isFeatured: true,
    })
      .sort({ priority: -1, createdAt: -1 })
      .limit(10)
      .select("name price images discount category brand");

    // Get quick access tiles
    const quickAccess = [
      { id: 1, title: "Shop by Category", icon: "category", route: "/categories" },
      { id: 2, title: "My Orders", icon: "orders", route: "/orders" },
      { id: 3, title: "My Wallet", icon: "wallet", route: "/wallet" },
      { id: 4, title: "My Coupons", icon: "coupon", route: "/coupons" },
      { id: 5, title: "Help & Support", icon: "support", route: "/support" },
      { id: 6, title: "Store Locator", icon: "store", route: "/stores" },
    ];

    // Get user-specific data if logged in
    let userData = null;
    if (userId) {
      const user = await User.findById(userId).select(
        "name email mobile walletBalance referralCode",
      );
      userData = user.toObject();
    }

    return res.json({
      success: true,
      dashboard: {
        banners,
        featuredPromotions,
        activePromotions,
        trendingProducts,
        quickAccess,
        userData,
      },
    });
  } catch (error) {
    console.error("Home dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load home dashboard",
    });
  }
};

/* =====================================================
   GET BANNERS
===================================================== */

export const getBanners = async (req, res) => {
  try {
    const { type = "ALL", limit = 10 } = req.query;

    const banners = await Banner.getActiveBanners({
      targetingType: type,
      limit: parseInt(limit),
    });

    return res.json({
      success: true,
      banners,
    });
  } catch (error) {
    console.error("Get banners error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load banners",
    });
  }
};

/* =====================================================
   GET PROMOTIONS
===================================================== */

export const getPromotions = async (req, res) => {
  try {
    const { type = "ALL", featured = false, limit = 10 } = req.query;

    const promotions = await Promotion.getActivePromotions({
      targetingType: type,
      featured: featured === "true",
      limit: parseInt(limit),
    });

    return res.json({
      success: true,
      promotions,
    });
  } catch (error) {
    console.error("Get promotions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load promotions",
    });
  }
};

/* =====================================================
   GET FEATURED PRODUCTS
===================================================== */

export const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 10, category } = req.query;

    const query = { isActive: true, isFeatured: true };
    if (category) query.category = category;

    const products = await Product.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .select("name price images discount category brand");

    return res.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Get featured products error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load featured products",
    });
  }
};

/* =====================================================
   GET QUICK ACCESS TILES
===================================================== */

export const getQuickAccess = async (req, res) => {
  try {
    const quickAccess = [
      { id: 1, title: "Shop by Category", icon: "category", route: "/categories" },
      { id: 2, title: "My Orders", icon: "orders", route: "/orders" },
      { id: 3, title: "My Wallet", icon: "wallet", route: "/wallet" },
      { id: 4, title: "My Coupons", icon: "coupon", route: "/coupons" },
      { id: 5, title: "Help & Support", icon: "support", route: "/support" },
      { id: 6, title: "Store Locator", icon: "store", route: "/stores" },
    ];

    return res.json({
      success: true,
      quickAccess,
    });
  } catch (error) {
    console.error("Get quick access error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load quick access tiles",
    });
  }
};

/* =====================================================
   SEARCH OFFERS AND PROMOTIONS
===================================================== */

export const searchOffers = async (req, res) => {
  try {
    const { q, type = "ALL", limit = 10 } = req.query;

    const query = { status: "ACTIVE" };
    if (type !== "ALL") query.type = type;

    // Search in title and description
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    const results = await Promise.all([
      Banner.find(query).sort({ displayOrder: 1, createdAt: -1 }).limit(parseInt(limit)),
      Promotion.find(query).sort({ priority: -1, displayOrder: 1, createdAt: -1 }).limit(parseInt(limit)),
    ]);

    return res.json({
      success: true,
      banners: results[0],
      promotions: results[1],
    });
  } catch (error) {
    console.error("Search offers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search offers",
    });
  }
};