const Store = require("../models/Store.model.js");

// @desc    Get all stores
// @route   GET /api/stores
// @access  Public
exports.getStores = async (req, res, next) => {
  try {
    const { city, area, type, page = 1, limit = 20 } = req.query;

    const query = { isActive: true };

    if (city) {
      query["location.city"] = new RegExp(`^${city}$`, "i");
    }

    if (area) {
      query["location.area"] = new RegExp(`^${area}$`, "i");
    }

    if (type) {
      query.type = type.toUpperCase();
    }

    const skip = (page - 1) * limit;

    const stores = await Store.find(query)
      .select("-staffAccounts")
      .sort({ type: 1, "location.city": 1, "location.area": 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Store.countDocuments(query);

    // Get distinct cities and areas for filters
    const cities = await Store.distinct("location.city", { isActive: true });
    const areas = city
      ? await Store.distinct("location.area", {
          "location.city": new RegExp(`^${city}$`, "i"),
          isActive: true,
        })
      : [];

    // Group stores by city
    const storesByCity = {};
    stores.forEach((store) => {
      const city = store.location.city;
      if (!storesByCity[city]) {
        storesByCity[city] = [];
      }
      storesByCity[city].push(store);
    });

    res.status(200).json({
      success: true,
      count: stores.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      filters: {
        cities,
        areas,
        types: ["MAIN", "BRANCH", "SUB_BRANCH"],
      },
      storesByCity,
      stores,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get store by ID
// @route   GET /api/stores/:id
// @access  Public
exports.getStoreById = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id).select(
      "-staffAccounts.password"
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        error: "Store not found",
      });
    }

    // Get nearby stores in same city
    const nearbyStores = await Store.find({
      _id: { $ne: store._id },
      "location.city": store.location.city,
      isActive: true,
    })
      .limit(5)
      .select("name location.address location.area contact.phone timings");

    // Get today's working status
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const isOpenToday = store.timings.workingDays.includes(today);

    // Format timings for display
    const timingDisplay = isOpenToday
      ? `Open today: ${store.timings.open} - ${store.timings.close}`
      : `Closed today. Open on: ${store.timings.workingDays.join(", ")}`;

    res.status(200).json({
      success: true,
      store,
      status: {
        isOpenToday,
        timingDisplay,
        currentTime: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      nearbyStores,
      contactOptions: {
        call: `tel:${store.contact.phone}`,
        whatsapp: store.contact.whatsapp
          ? `https://wa.me/91${store.contact.whatsapp}`
          : null,
        directions: store.location.coordinates
          ? `https://www.google.com/maps?q=${store.location.coordinates.lat},${store.location.coordinates.lng}`
          : `https://www.google.com/maps/search/${encodeURIComponent(
              store.location.address
            )}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stores near location
// @route   GET /api/stores/nearby
// @access  Public
exports.getNearbyStores = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10 } = req.query; // radius in km

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: "Please provide latitude and longitude",
      });
    }

    const stores = await Store.find({ isActive: true }).select(
      "name location.address location.city location.area location.coordinates contact.phone timings"
    );

    // Calculate distance and filter
    const { calculateDistance } = require("../utils/common");
    const nearbyStores = stores.filter((store) => {
      if (
        store.location.coordinates &&
        store.location.coordinates.lat &&
        store.location.coordinates.lng
      ) {
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          store.location.coordinates.lat,
          store.location.coordinates.lng
        );
        return distance <= parseFloat(radius);
      }
      return false;
    });

    // Sort by distance
    nearbyStores.sort((a, b) => {
      const distA = calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        a.location.coordinates.lat,
        a.location.coordinates.lng
      );
      const distB = calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        b.location.coordinates.lat,
        b.location.coordinates.lng
      );
      return distA - distB;
    });

    // Add distance to each store
    const storesWithDistance = nearbyStores.map((store) => {
      const distance = calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        store.location.coordinates.lat,
        store.location.coordinates.lng
      );

      return {
        ...store.toObject(),
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal
        distanceText:
          distance < 1
            ? `${Math.round(distance * 1000)}m away`
            : `${Math.round(distance * 10) / 10}km away`,
      };
    });

    res.status(200).json({
      success: true,
      count: storesWithDistance.length,
      userLocation: { lat: parseFloat(lat), lng: parseFloat(lng) },
      searchRadius: `${radius}km`,
      stores: storesWithDistance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get store staff login
// @route   POST /api/stores/staff-login
// @access  Public
exports.staffLogin = async (req, res, next) => {
  try {
    const { storeId, username, password } = req.body;

    if (!storeId || !username || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide store ID, username, and password",
      });
    }

    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: "Store not found",
      });
    }

    const staff = store.verifyStaff(username, password);

    if (!staff) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Update last login
    const staffIndex = store.staffAccounts.findIndex(
      (acc) => acc.username === username
    );
    store.staffAccounts[staffIndex].lastLogin = new Date();
    await store.save();

    // Generate simple token for staff session
    const token = require("jsonwebtoken").sign(
      { storeId: store._id, staffId: staff.username, role: staff.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.status(200).json({
      success: true,
      token,
      store: {
        id: store._id,
        name: store.name,
        city: store.location.city,
        area: store.location.area,
      },
      staff: {
        name: staff.name,
        username: staff.username,
        role: staff.role,
      },
      permissions: {
        canRecordPurchase: true,
        canRedeemCoupons: true,
        canViewCustomers: true,
        canViewReports: staff.role === "MANAGER",
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get store dashboard for staff
// @route   GET /api/stores/:id/dashboard
// @access  Private (Store staff)
exports.getStoreDashboard = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: "Store not found",
      });
    }

    // Get today's sales
    const Purchase = require("../models/Purchase.model.js");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySales = await Purchase.aggregate([
      {
        $match: {
          storeId: store._id,
          createdAt: { $gte: today, $lt: tomorrow },
          status: "COMPLETED",
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$finalAmount" },
          totalTransactions: { $sum: 1 },
          averageTransaction: { $avg: "$finalAmount" },
          totalDiscounts: { $sum: "$discount" },
        },
      },
    ]);

    // Get recent purchases
    const recentPurchases = await Purchase.find({ storeId: store._id })
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 })
      .limit(10);

    // Get store statistics
    const totalCustomers = await Purchase.distinct("userId", {
      storeId: store._id,
    });

    res.status(200).json({
      success: true,
      store: {
        name: store.name,
        location: store.location,
        contact: store.contact,
        timings: store.timings,
      },
      dashboard: {
        today:
          todaySales.length > 0
            ? todaySales[0]
            : {
                totalSales: 0,
                totalTransactions: 0,
                averageTransaction: 0,
                totalDiscounts: 0,
              },
        totalCustomers: totalCustomers.length,
        staffCount: store.staffAccounts.filter((s) => s.isActive).length,
      },
      recentPurchases: recentPurchases.map((p) => ({
        invoice: p.invoiceNumber,
        customer: p.userId
          ? `${p.userId.name} (${p.userId.mobile})`
          : "Walk-in Customer",
        amount: p.finalAmount,
        time: p.createdAt.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        items: p.items.length,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get store working hours
// @route   GET /api/stores/:id/hours
// @access  Public
exports.getStoreHours = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id).select(
      "name timings location"
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        error: "Store not found",
      });
    }

    // Check current status
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 100 + currentMinute;

    const openTime = this.parseTime(store.timings.open);
    const closeTime = this.parseTime(store.timings.close);

    const isOpenNow = currentTime >= openTime && currentTime <= closeTime;
    const today = now.toLocaleDateString("en-US", { weekday: "long" });
    const isOpenToday = store.timings.workingDays.includes(today);

    let status;
    if (!isOpenToday) {
      status = "CLOSED_TODAY";
    } else if (!isOpenNow) {
      status = "CLOSED_NOW";
    } else {
      status = "OPEN_NOW";
    }

    // Calculate time until open/close
    let nextChange;
    if (status === "OPEN_NOW") {
      const closeDate = new Date(now);
      const [closeHour, closeMinute] = store.timings.close
        .split(":")
        .map(Number);
      closeDate.setHours(closeHour, closeMinute, 0, 0);
      const timeUntilClose = Math.max(
        0,
        Math.floor((closeDate - now) / (1000 * 60))
      ); // in minutes
      nextChange = {
        action: "CLOSES",
        time: store.timings.close,
        inMinutes: timeUntilClose,
      };
    } else if (status === "CLOSED_NOW" && isOpenToday) {
      const openDate = new Date(now);
      const [openHour, openMinute] = store.timings.open.split(":").map(Number);
      if (currentTime > openTime) {
        // Opens tomorrow
        openDate.setDate(openDate.getDate() + 1);
      }
      openDate.setHours(openHour, openMinute, 0, 0);
      const timeUntilOpen = Math.max(
        0,
        Math.floor((openDate - now) / (1000 * 60))
      ); // in minutes
      nextChange = {
        action: "OPENS",
        time: store.timings.open,
        inMinutes: timeUntilOpen,
      };
    }

    res.status(200).json({
      success: true,
      store: store.name,
      location: store.location.address,
      status,
      timings: {
        open: store.timings.open,
        close: store.timings.close,
        workingDays: store.timings.workingDays,
      },
      currentTime: now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      nextChange,
      message: this.getStatusMessage(status, nextChange),
    });
  } catch (error) {
    next(error);
  }
};

// Helper method to parse time string
exports.parseTime = (timeStr) => {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return hours * 100 + minutes;
};

// Helper method to get status message
exports.getStatusMessage = (status, nextChange) => {
  switch (status) {
    case "OPEN_NOW":
      if (nextChange && nextChange.inMinutes > 0) {
        return `Open now • Closes in ${nextChange.inMinutes} minutes`;
      }
      return "Open now";

    case "CLOSED_NOW":
      if (nextChange && nextChange.inMinutes > 0) {
        return `Closed now • Opens in ${nextChange.inMinutes} minutes`;
      }
      return "Closed now";

    case "CLOSED_TODAY":
      return "Closed today";

    default:
      return "Check store timings";
  }
};
