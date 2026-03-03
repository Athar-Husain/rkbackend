import Banner from "../models/Banner.model.js";
import Promotion from "../models/Promotion.model.js";
import User from "../models/User.model.js";

/* =====================================================
   HOME DASHBOARD
===================================================== */
export const getHomeDashboard = async (req, res) => {
  try {
    const user = req.user
      ? await User.findById(req.user._id)
          .select(
            "name email mobile walletBalance referralCode segments city area store",
          )
          .lean()
      : null;

    const [banners, featuredPromotions, activePromotions] = await Promise.all([
      Banner.getActiveBanners({ user, limit: 10 }),
      Promotion.getActivePromotions({ user, featured: true, limit: 5 }),
      Promotion.getPromotionsForUser(user, { limit: 10 }),
    ]);

    console.log(
      "Dashboard banners:",
      banners.map((b) => b.title),
    );
    console.log(
      "Featured promotions:",
      featuredPromotions.map((p) => p.title),
    );
    console.log(
      "Active promotions:",
      activePromotions.map((p) => p.title),
    );

    const quickAccess = [
      {
        id: 1,
        title: "Shop by Category",
        icon: "category",
        route: "/categories",
      },
      { id: 2, title: "My Orders", icon: "orders", route: "/orders" },
      { id: 3, title: "My Wallet", icon: "wallet", route: "/wallet" },
      { id: 4, title: "My Coupons", icon: "coupon", route: "/coupons" },
      { id: 5, title: "Help & Support", icon: "support", route: "/support" },
      { id: 6, title: "Store Locator", icon: "store", route: "/stores" },
    ];

    return res.json({
      success: true,
      dashboard: {
        banners,
        featuredPromotions,
        activePromotions,
        quickAccess,
        userData: user || null,
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

export const getBanners = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const banners = await Banner.getActiveBanners();

    return res.json({
      success: true,
      banners: banners.slice(0, parseInt(limit)),
    });
  } catch (error) {
    console.error("Get banners error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load banners",
    });
  }
};

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

export const getPromotions = async (req, res) => {
  try {
    // Parse query params safely
    const featured = req.query.featured === "true"; // convert to boolean
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 10, 100));
    // ensures limit is between 1 and 100

    // Fetch promotions using schema statics
    const promotions = featured
      ? await Promotion.getFeaturedPromotions(limit)
      : await Promotion.getActivePromotions({ limit });

    console.log("promotions", promotions);
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

export const getQuickAccess = async (req, res) => {
  try {
    const quickAccess = [
      {
        id: 1,
        title: "Shop by Category",
        icon: "category",
        route: "/categories",
      },
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

export const searchOffers = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    const bannerQuery = {
      isActive: true,
    };

    const promoQuery = {
      status: "ACTIVE",
    };

    if (q) {
      bannerQuery.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];

      promoQuery.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    const [banners, promotions] = await Promise.all([
      Banner.find(bannerQuery)
        .sort({ displayOrder: 1, createdAt: -1 })
        .limit(parseInt(limit)),

      Promotion.find(promoQuery)
        .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
        .limit(parseInt(limit)),
    ]);

    return res.json({
      success: true,
      banners,
      promotions,
    });
  } catch (error) {
    console.error("Search offers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search offers",
    });
  }
};

/* =====================================================
   ACTIVE PROMOTIONS FOR USER
===================================================== */
export const getActivePromotionsForUser = async (req, res) => {
  try {
    const user = req.user
      ? await User.findById(req.user._id)
          .select("segments city area store")
          .lean()
      : null;

    const promotions = await Promotion.getPromotionsForUser(user, {
      limit: 20,
    });
    console.log(
      "Active promotions for user:",
      promotions.map((p) => p.title),
    );

    return res.json({ success: true, promotions });
  } catch (error) {
    console.error("Error fetching active promotions:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load active promotions" });
  }
};

/* =====================================================
   FEATURED PROMOTIONS FOR USER
===================================================== */
export const getFeaturedPromotionsForUser = async (req, res) => {
  try {
    const user = req.user
      ? await User.findById(req.user._id)
          .select("segments city area store")
          .lean()
      : null;

    const promotions = await Promotion.getActivePromotions({
      user,
      featured: true,
      limit: 10,
    });
    console.log(
      "Featured promotions for user:",
      promotions.map((p) => p.title),
    );

    return res.json({ success: true, promotions });
  } catch (error) {
    console.error("Error fetching featured promotions:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load featured promotions" });
  }
};

/* =====================================================
   ACTIVE BANNERS FOR USER
===================================================== */
export const getActiveBannersForUser = async (req, res) => {
  try {
    const user = req.user
      ? await User.findById(req.user._id)
          .select("segments city area store")
          .lean()
      : null;

    const banners = await Banner.getActiveBanners({ user, limit: 10 });
    console.log(
      "Active banners for user:",
      banners.map((b) => b.title),
    );

    return res.json({ success: true, banners });
  } catch (error) {
    console.error("Error fetching active banners:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load active banners" });
  }
};

/* =====================================================
   FEATURED BANNERS FOR USER
===================================================== */
export const getFeaturedBannersForUser = async (req, res) => {
  try {
    const user = req.user
      ? await User.findById(req.user._id)
          .select("segments city area store")
          .lean()
      : null;

    const banners = await Banner.getActiveBanners({ user, limit: 5 }); // adjust limit as needed
    console.log(
      "Featured banners for user:",
      banners.map((b) => b.title),
    );

    return res.json({ success: true, banners });
  } catch (error) {
    console.error("Error fetching featured banners:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load featured banners" });
  }
};
