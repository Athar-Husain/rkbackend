// import Banner from "../models/Banner.js";

import Banner from "../models/Banner.model.js";
import { buildTargetingConditions } from "../services/targetingService.js";
// import { buildTargetingConditions } from "../services/targeting.service.js";

/* ===============================
   CREATE BANNER
=============================== */
export const createBanner = async (req, res) => {
  try {

    // console.log("req user", req.user)
    // console.log("req body", req.body)
    const banner = await Banner.create({
      ...req.body,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner,
    });
  } catch (error) {
    console.log("error.message in create banner", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

/* ===============================
   GET ALL BANNERS (Admin)
=============================== */
export const getAllBanners = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;

    const query = {};

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    const banners = await Banner.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("createdBy", "name email")
      .lean();

    const total = await Banner.countDocuments(query);

    res.json({
      success: true,
      total,
      page: Number(page),
      data: banners,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===============================
   GET SINGLE BANNER
=============================== */
export const getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );

    if (!banner)
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });

    res.json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===============================
   UPDATE BANNER
=============================== */
export const updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!banner)
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });

    res.json({
      success: true,
      message: "Banner updated successfully",
      data: banner,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/* ===============================
   DELETE BANNER (Soft Delete)
=============================== */
export const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner)
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });

    banner.isActive = false;
    await banner.save();

    res.json({ success: true, message: "Banner deactivated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===============================
   RECORD IMPRESSION
=============================== */
export const recordBannerImpression = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false });

    await banner.recordImpression();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/* ===============================
   RECORD CLICK
=============================== */
export const recordBannerClick = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false });

    await banner.recordClick();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/* ===============================
   FETCH ACTIVE BANNERS (Public)
   Supports targeting: user, product, cart, category, brand
=============================== */
export const fetchActiveBanners1 = async (req, res) => {
  try {
    const { category, brand } = req.query;
    const user = req.user || null;
    const cartProducts = req.cart || []; // optional: from middleware

    const targetingConditions = buildTargetingConditions({
      user,
      category,
      brand,
      cartProducts,
    });

    const now = new Date();

    const banners = await Banner.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: targetingConditions,
    })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    res.json({ success: true, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===============================
   FETCH ACTIVE BANNERS (Public)
   Supports targeting: user, product, cart, category, brand
=============================== */
export const fetchActiveBanners = async (req, res) => {
  try {
    const { category, brand } = req.query;
    const user = req.user || null;
    const cartProducts = req.cart || [];

    // Build targeting conditions safely
    const targetingConditions = buildTargetingConditions({
      user,
      category,
      brand,
      cartProducts,
    });

    // If no targeting conditions, show all active banners
    const orConditions = targetingConditions.length
      ? targetingConditions
      : [{}];

    const now = new Date();

    const banners = await Banner.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: orConditions,
    })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    res.json({ success: true, data: banners });
  } catch (error) {
    console.error("Error fetching active banners:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch banners" });
  }
};
