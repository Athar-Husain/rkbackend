import Banner from "../models/Banner.model.js";

/**
 * ADMIN: Create a new banner
 */
export const createBanner = async (req, res) => {
  try {
    const banner = await Banner.create({
      ...req.body,
      createdBy: req.user._id, // Assuming auth middleware
    });
    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PUBLIC: Fetch banners for the mobile/web app
 * Filters based on user location, segments, and active dates
 */
export const getAppBanners = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    // req.user comes from your 'protect' or 'optionalAuth' middleware
    const user = req.user || null;

    const banners = await Banner.fetchActiveBanners({
      user,
      limit: parseInt(limit),
    });

    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching banners" });
  }
};

/**
 * PUBLIC: Track Analytics
 * Increments clicks or impressions without loading the whole document
 */
export const trackBannerActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'click' or 'impression'

    if (type === "click") {
      await Banner.updateOne({ _id: id }, { $inc: { clicks: 1 } });
    } else {
      await Banner.updateOne({ _id: id }, { $inc: { impressions: 1 } });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Analytics tracking failed" });
  }
};
