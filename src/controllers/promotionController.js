import mongoose from "mongoose";
// import Promotion from "../models/Promotion.model.js";
import Promotion from "../models/Promotion.model.js";

/* ===============================
   CREATE PROMOTION (Admin)
=============================== */
export const createPromotion1 = async (req, res) => {
  try {
    const data = { ...req.body };

    console.log("createPromotion req body ", req.body);
    console.log(" req.user ", req.user);

    // Ensure targeting cities/areas are ObjectId
    if (data.targeting?.geographic?.cities) {
      data.targeting.geographic.cities = data.targeting.geographic.cities.map(
        (id) =>
          mongoose.Types.ObjectId.isValid(id)
            ? new mongoose.Types.ObjectId(id)
            : id,
        // (id) => new mongoose.Types.ObjectId(id),
      );
    }
    if (data.targeting?.geographic?.areas) {
      data.targeting.geographic.areas = data.targeting.geographic.areas.map(
        (id) =>
          mongoose.Types.ObjectId.isValid(id)
            ? new mongoose.Types.ObjectId(id)
            : id,
        // (id) => new mongoose.Types.ObjectId(id),
      );
    }

    const promotion = await Promotion.create({
      ...data,
      createdBy: req.user._id,
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

// import mongoose from "mongoose";
// import Promotion from "../models/Promotion.model.js";

export const createPromotion2 = async (req, res) => {
  try {
    const data = { ...req.body };

    console.log("createPromotion req body ", req.body);
    console.log("req.user ", req.user);

    /* ===============================
       ✅ Convert imgurl → bannerImage
    =============================== */
    if (data.imageUrl) {
      data.bannerImage = data.imageUrl;
      delete data.imageUrl; // optional: remove unwanted field
    }

    /* ===============================
       ✅ Ensure ObjectIds
    =============================== */
    if (data.targeting?.geographic?.cities) {
      data.targeting.geographic.cities = data.targeting.geographic.cities.map(
        (id) =>
          mongoose.Types.ObjectId.isValid(id)
            ? new mongoose.Types.ObjectId(id)
            : id,
        // (id) => new mongoose.Types.ObjectId(id),
      );
    }

    if (data.targeting?.geographic?.areas) {
      data.targeting.geographic.areas = data.targeting.geographic.areas.map(
        (id) =>
          mongoose.Types.ObjectId.isValid(id)
            ? new mongoose.Types.ObjectId(id)
            : id,
        // (id) => new mongoose.Types.ObjectId(id),
      );
    }

    const promotion = await Promotion.create({
      ...data,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Promotion created successfully",
      data: promotion,
    });
  } catch (error) {
    console.error("Create Promotion Error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const createPromotion = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const data = { ...req.body };

    console.log("createPromotion req body ", req.body);
    console.log("req.user ", req.user);

    /* ===============================
       Convert imageUrl → bannerImage
    =============================== */
    if (data.imageUrl) {
      data.bannerImage = data.imageUrl;
      delete data.imageUrl;
    }

    /* ===============================
       Ensure targeting structure
    =============================== */
    if (data.targeting?.type === "GEOGRAPHIC" && !data.targeting.geographic) {
      data.targeting.geographic = {};
    }

    /* ===============================
       Ensure ObjectIds
    =============================== */
    if (data.targeting?.geographic?.cities) {
      data.targeting.geographic.cities = data.targeting.geographic.cities.map(
        (id) =>
          mongoose.Types.ObjectId.isValid(id)
            ? new mongoose.Types.ObjectId(id)
            : id,
      );
    }

    if (data.targeting?.geographic?.areas) {
      data.targeting.geographic.areas = data.targeting.geographic.areas.map(
        (id) =>
          mongoose.Types.ObjectId.isValid(id)
            ? new mongoose.Types.ObjectId(id)
            : id,
      );
    }

    if (data.targeting?.geographic?.stores) {
      data.targeting.geographic.stores = data.targeting.geographic.stores.map(
        (id) =>
          mongoose.Types.ObjectId.isValid(id)
            ? new mongoose.Types.ObjectId(id)
            : id,
      );
    }

    const promotion = await Promotion.create({
      ...data,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Promotion created successfully",
      data: promotion,
    });
  } catch (error) {
    console.error("Create Promotion Error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/* ===============================
   UPDATE PROMOTION (Admin)
=============================== */
export const updatePromotion = async (req, res) => {
  try {
    const data = { ...req.body };

    // Ensure targeting cities/areas are ObjectId
    if (data.targeting?.geographic?.cities) {
      data.targeting.geographic.cities = data.targeting.geographic.cities.map(
        (id) => new mongoose.Types.ObjectId(id),
      );
    }
    if (data.targeting?.geographic?.areas) {
      data.targeting.geographic.areas = data.targeting.geographic.areas.map(
        (id) => new mongoose.Types.ObjectId(id),
      );
    }

    const promotion = await Promotion.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });

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
   GET ALL PROMOTIONS (Admin)
=============================== */
export const getAllPromotions1 = async (req, res) => {
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

    console.log("promotions get all", promotions);
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

export const getAllPromotions2 = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, featured } = req.query;

    const query = {};

    if (status) query.status = status;
    if (featured === "true") query.featured = true;

    const promotions = await Promotion.find(query)
      .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("createdBy", "name email");

    // console.log("promotions in get ", promotions);
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

export const getAllPromotions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, featured } = req.query;

    const query = {};

    if (status) query.status = status;
    if (featured === "true") query.featured = true;

    const promotions = await Promotion.find(query)
      .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("createdBy", "name email");

    const total = await Promotion.countDocuments(query);

    console.log("promotions in get ", promotions);
    console.log("promotions in get total ", total);
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
    // promotions.forEach((p) => p.recordImpression());
    await Promise.allSettled(promotions.map((p) => p.recordImpression()));

    res.json({ success: true, data: promotions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPromotionsForUser3 = async (req, res) => {
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

    console.log("promotions getPromotionsForUser", promotions);
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

// src/controllers/promotionController.js
// import Promotion from "../models/Promotion.model.js";

export const getPromotionsForUser = async (req, res) => {
  try {
    const user = req.user; // assume user is populated by auth middleware

    if (!user) return res.status(400).json({ message: "User not found" });

    const now = new Date();

    // Base query: active, valid, not fully redeemed
    const baseQuery = {
      status: "ACTIVE",
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    };

    // GEO targeting logic
    const geoConditions = [
      // Areas selected → restrict to matching areas
      {
        "targeting.type": "GEOGRAPHIC",
        "targeting.geographic.areas.0": { $exists: true },
        "targeting.geographic.areas": user.area,
      },
      // Cities selected but no areas → match city
      {
        "targeting.type": "GEOGRAPHIC",
        "targeting.geographic.cities.0": { $exists: true },
        "targeting.geographic.areas.0": { $exists: false },
        "targeting.geographic.cities": user.city,
      },
    ];

    // Combine all targeting types
    const targetingQuery = {
      $or: [
        { "targeting.type": "ALL" },
        { "targeting.type": "INDIVIDUAL", "targeting.users": user._id },
        {
          "targeting.type": "SEGMENT",
          "targeting.segments": { $in: user.segments || [] },
        },
        ...geoConditions,
      ],
    };

    const promotions = await Promotion.find({
      ...baseQuery,
      ...targetingQuery,
    })
      .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
      .limit(20)
      .lean();

    // console.log("promotions in getpromotionsfor user", promotions);

    res.status(200).json({ success: true, data: promotions });
  } catch (error) {
    console.error("Error fetching promotions for user:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
