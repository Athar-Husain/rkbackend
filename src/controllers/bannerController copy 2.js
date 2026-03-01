import Banner from "../../models/Banner.js";
import { getActiveBanners } from "../services/banner.service.js";

/* ===============================
   CREATE BANNER
=============================== */
export const createBanner = async (req, res) => {
  try {
    const banner = await Banner.create({
      ...req.body,
      createdBy: req.admin._id,
    });

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner,
    });
  } catch (error) {
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
      .populate("createdBy", "name email");

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
    const banner = await Banner.findById(req.params.id)
      .populate("createdBy", "name email");

    if (!banner)
      return res.status(404).json({ success: false, message: "Banner not found" });

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
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!banner)
      return res.status(404).json({ success: false, message: "Banner not found" });

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
      return res.status(404).json({ success: false, message: "Banner not found" });

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



export const fetchActiveBanners = async (req, res) => {
  const banners = await getActiveBanners({
    user: req.user,
    category: req.query.category,
    brand: req.query.brand,
  });

  res.json({ success: true, banners });
};