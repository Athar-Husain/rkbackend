// import Promotion from "../models/Promotion.js";
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
