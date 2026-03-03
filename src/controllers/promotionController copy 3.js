// import Promotion from "../models/Promotion.js";
import mongoose from "mongoose";
import Promotion from "../models/Promotion.model.js";

/* ===============================
   CREATE PROMOTION (Admin)
=============================== */
export const createPromotion = async (req, res) => {
  try {
    const promotion = await Promotion.create({
      ...req.body,
      createdBy: req.admin._id,
    });

    res.status(201).json({
      success: true,
      message: "Promotion created successfully",
      data: promotion,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/* ===============================
   GET ALL PROMOTIONS (Admin)
=============================== */
export const getAllPromotions = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, featured } = req.query;
    const query = {};

    if (search) query.title = { $regex: search, $options: "i" };
    if (status) query.status = status.toUpperCase();
    if (featured !== undefined) query.featured = featured === "true";

    const promotions = await Promotion.find(query)
      .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("createdBy", "name email");

    const total = await Promotion.countDocuments(query);

    res.json({
      success: true,
      total,
      page: Number(page),
      data: promotions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===============================
   GET SINGLE PROMOTION
=============================== */
export const getPromotionById = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );

    if (!promotion)
      return res
        .status(404)
        .json({ success: false, message: "Promotion not found" });

    res.json({ success: true, data: promotion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===============================
   UPDATE PROMOTION (Admin)
=============================== */
export const updatePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    if (!promotion)
      return res
        .status(404)
        .json({ success: false, message: "Promotion not found" });

    res.json({
      success: true,
      message: "Promotion updated successfully",
      data: promotion,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/* ===============================
   DELETE PROMOTION (Soft Delete)
=============================== */
export const deletePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);

    if (!promotion)
      return res
        .status(404)
        .json({ success: false, message: "Promotion not found" });

    promotion.status = "DELETED";
    await promotion.save();

    res.json({ success: true, message: "Promotion deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===============================
   RECORD IMPRESSION
=============================== */
export const recordPromotionImpression = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) return res.status(404).json({ success: false });

    await promotion.recordImpression();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/* ===============================
   RECORD CLICK
=============================== */
export const recordPromotionClick = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) return res.status(404).json({ success: false });

    await promotion.recordClick();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/* ===============================
   RECORD REDEMPTION
=============================== */
export const recordPromotionRedemption = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) return res.status(404).json({ success: false });

    if (!promotion.isActive)
      return res
        .status(400)
        .json({ success: false, message: "Promotion not active" });

    await promotion.recordRedemption();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/* ===============================
   FETCH ACTIVE PROMOTIONS (User)
=============================== */
export const fetchActivePromotions = async (req, res) => {
  console.log("fetchActivePromotions hit");
  try {
    const promotions = await Promotion.getActivePromotions({
      user: req.user || null,
      featured: req.query.featured === "true",
      limit: Number(req.query.limit) || 20,
    });

    // Optionally record impressions for each banner asynchronously
    promotions.forEach((p) => p.recordImpression());

    res.json({ success: true, data: promotions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// import Promotion from "../models/Promotion.model.js";

/* ===============================
   FETCH ACTIVE PROMOTIONS FOR USER BY CITY/AREA
=============================== */
export const getPromotionsForUser1 = async (req, res) => {
  console.log("hit");
  try {
    const user = req.user;
    console.log("req user", user);
    if (!user || !user.city || !user.area) {
      return res.status(400).json({
        success: false,
        message: "User city and area information is required",
      });
    }

    const now = new Date();

    // Base query for active promotions
    const baseQuery = {
      status: "ACTIVE",
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
    };

    // Query promotions that target the user's city or area
    const locationQuery = {
      $or: [
        { "targeting.type": "ALL" }, // global promotions
        {
          $and: [
            { "targeting.type": "GEOGRAPHIC" },
            {
              $or: [
                { "targeting.geographic.cities": user.city },
                { "targeting.geographic.areas": user.area },
              ],
            },
          ],
        },
        {
          $and: [
            { "targeting.type": "INDIVIDUAL" },
            { "targeting.users": user._id },
          ],
        },
        {
          $and: [
            { "targeting.type": "SEGMENT" },
            { "targeting.segments": { $in: user.segments || [] } },
          ],
        },
      ],
    };

    const promotions = await Promotion.find({
      ...baseQuery,
      ...locationQuery,
    })
      .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
      .limit(20)
      .populate("createdBy", "name email");

    // Optionally record impressions for each promotion asynchronously
    promotions.forEach((p) => p.recordImpression());

    console.log("promotions", promotions);

    res.json({
      success: true,
      total: promotions.length,
      data: promotions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPromotionsForUser2 = async (req, res) => {
  try {
    const user = req.user; // user is populated by protect middleware

    console.log("req.user:", user);

    if (!user || !user.city || !user.area) {
      return res.status(400).json({
        success: false,
        message: "User city and area information is required",
      });
    }

    const now = new Date();

    // Convert user's city/area to ObjectId for querying
    const userCityId = mongoose.Types.ObjectId(user.city);
    const userAreaId = mongoose.Types.ObjectId(user.area);

    // Base query for active promotions
    const baseQuery = {
      status: "ACTIVE",
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
    };

    // Build targeting query
    const targetingQuery = {
      $or: [
        { "targeting.type": "ALL" }, // global promotions
        {
          $and: [
            { "targeting.type": "GEOGRAPHIC" },
            {
              $or: [
                { "targeting.geographic.cities": userCityId },
                { "targeting.geographic.areas": userAreaId },
              ],
            },
          ],
        },
        {
          $and: [
            { "targeting.type": "INDIVIDUAL" },
            { "targeting.users": user._id },
          ],
        },
        {
          $and: [
            { "targeting.type": "SEGMENT" },
            { "targeting.segments": { $in: user.segments || [] } },
          ],
        },
      ],
    };

    // Combine queries using $and
    const promotions = await Promotion.find({
      $and: [baseQuery, targetingQuery],
    })
      .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
      .limit(20)
      .populate("createdBy", "name email");

    // Record impressions asynchronously
    promotions.forEach((p) => p.recordImpression().catch(() => {}));

    console.log("promotions", promotions);
    res.json({
      success: true,
      total: promotions.length,
      data: promotions,
    });
  } catch (error) {
    console.error("Error in getPromotionsForUser:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPromotionsForUser = async (req, res) => {
  try {
    const user = req.user;

    console.log("req.user:", user);

    if (!user || !user.city || !user.area) {
      return res.status(400).json({
        success: false,
        message: "User city and area information is required",
      });
    }

    const now = new Date();

    // ✅ Use `new` for ObjectId
    const userCityId = new mongoose.Types.ObjectId(user.city);
    const userAreaId = new mongoose.Types.ObjectId(user.area);

    const baseQuery = {
      status: "ACTIVE",
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
    };

    const targetingQuery = {
      $or: [
        { "targeting.type": "ALL" },
        {
          $and: [
            { "targeting.type": "GEOGRAPHIC" },
            {
              $or: [
                { "targeting.geographic.cities": userCityId },
                { "targeting.geographic.areas": userAreaId },
              ],
            },
          ],
        },
        {
          $and: [
            { "targeting.type": "INDIVIDUAL" },
            { "targeting.users": user._id },
          ],
        },
        {
          $and: [
            { "targeting.type": "SEGMENT" },
            { "targeting.segments": { $in: user.segments || [] } },
          ],
        },
      ],
    };

    const promotions = await Promotion.find({
      $and: [baseQuery, targetingQuery],
    })
      .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
      .limit(20)
      .populate("createdBy", "name email");

    promotions.forEach((p) => p.recordImpression().catch(() => {}));


    console.log("promotions getPromotionsForUser", promotions)
    res.json({
      success: true,
      total: promotions.length,
      data: promotions,
    });
  } catch (error) {
    console.error("Error in getPromotionsForUser:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
