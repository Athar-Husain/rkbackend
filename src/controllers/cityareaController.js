import CityArea from "../models/CityArea.model.js";

/**
 * @desc    Create a new City (optionally with areas)
 * @route   POST /api/city-area/city
 * @access  Admin
 */
export const createCity = async (req, res, next) => {
  try {
    const { city, areas = [] } = req.body;

    if (!city) {
      return res.status(400).json({
        success: false,
        error: "City name is required",
      });
    }

    const existingCity = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
    });

    if (existingCity) {
      return res.status(400).json({
        success: false,
        error: "City already exists",
      });
    }

    const cityDoc = await CityArea.create({
      city,
      areas: areas.map((area) => ({
        name: area.name,
        pincodes: area.pincodes || [],
      })),
    });

    res.status(201).json({
      success: true,
      message: "City created successfully",
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add single or multiple areas to an existing city
 * @route   POST /api/city-area/:city/areas
 * @access  Admin
 */
export const addAreasToCityold = async (req, res, next) => {
  try {
    const { city, areas } = req.params;
    // const { areas } = req.body;

    if (!Array.isArray(areas) || areas.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Areas array is required",
      });
    }

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
      isActive: true,
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    areas.forEach((area) => {
      const exists = cityDoc.areas.some(
        (a) => a.name.toLowerCase() === area.name.toLowerCase(),
      );

      if (!exists) {
        cityDoc.areas.push({
          name: area.name,
          pincodes: area.pincodes || [],
        });
      }
    });

    await cityDoc.save();

    res.status(200).json({
      success: true,
      message: "Areas added successfully",
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

export const addAreasToCity = async (req, res, next) => {
  try {
    const { city } = req.params;
    const { areas } = req.body;

    console.log("req body", req.body);

    if (!Array.isArray(areas) || areas.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Areas array is required",
      });
    }

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
      isActive: true,
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    areas.forEach((area) => {
      const exists = cityDoc.areas.some(
        (a) => a.name.toLowerCase() === area.name.toLowerCase(),
      );

      if (!exists) {
        cityDoc.areas.push({
          name: area.name,
          pincodes: area.pincodes || [],
        });
      }
    });

    await cityDoc.save();

    res.status(200).json({
      success: true,
      message: "Areas added successfully",
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all active cities with areas
 * @route   GET /api/city-area
 * @access  Public
 */
export const getAllCitiesWithAreas = async (req, res, next) => {
  try {
    const cities = await CityArea.getAllCitiesWithAreas();

    res.status(200).json({
      success: true,
      count: cities.length,
      data: cities,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single city with areas
 * @route   GET /api/city-area/:city
 * @access  Public
 */
export const getCityDetails = async (req, res, next) => {
  try {
    const { city } = req.params;

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    res.status(200).json({
      success: true,
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove an area from a city
 * @route   DELETE /api/city-area/:city/area/:area
 * @access  Admin
 */
export const removeAreaFromCity = async (req, res, next) => {
  try {
    const { city, area } = req.params;

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    const originalLength = cityDoc.areas.length;

    cityDoc.areas = cityDoc.areas.filter(
      (a) => a.name.toLowerCase() !== area.toLowerCase(),
    );

    if (cityDoc.areas.length === originalLength) {
      return res.status(404).json({
        success: false,
        error: "Area not found",
      });
    }

    await cityDoc.save();

    res.status(200).json({
      success: true,
      message: "Area removed successfully",
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle city active/inactive
 * @route   PATCH /api/city-area/:city/status
 * @access  Admin
 */
export const toggleCityStatus = async (req, res, next) => {
  try {
    const { city } = req.params;

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    cityDoc.isActive = !cityDoc.isActive;
    await cityDoc.save();

    res.status(200).json({
      success: true,
      message: `City ${cityDoc.isActive ? "activated" : "deactivated"}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle area active/inactive
 * @route   PATCH /api/city-area/:city/area/:area/status
 * @access  Admin
 */
export const toggleAreaStatus = async (req, res, next) => {
  try {
    const { city, area } = req.params;

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    const areaDoc = cityDoc.areas.find(
      (a) => a.name.toLowerCase() === area.toLowerCase(),
    );

    if (!areaDoc) {
      return res.status(404).json({
        success: false,
        error: "Area not found",
      });
    }

    areaDoc.isActive = !areaDoc.isActive;
    await cityDoc.save();

    res.status(200).json({
      success: true,
      message: `Area ${areaDoc.isActive ? "activated" : "deactivated"}`,
    });
  } catch (error) {
    next(error);
  }
};

// import CityArea from "../models/CityArea.model.js";

/**
 * @desc    Get all active cities (User selection)
 * @route   GET /api/location/cities
 * @access  Public
 */
export const getCities = async (req, res, next) => {
  try {
    const cities = await CityArea.find({ isActive: true })
      .select("city")
      .sort({ city: 1 });

    res.status(200).json({
      success: true,
      data: cities.map((c) => c.city),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get active areas for a selected city
 * @route   GET /api/location/cities/:city/areas
 * @access  Public
 */
export const getAreasByCity = async (req, res, next) => {
  try {
    const { city } = req.params;

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
      isActive: true,
    }).select("areas");

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    const activeAreas = cityDoc.areas
      .filter((area) => area.isActive)
      .map((area) => ({
        name: area.name,
        pincodes: area.pincodes,
      }));

    res.status(200).json({
      success: true,
      city,
      areas: activeAreas,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate city & area combination
 * @route   POST /api/location/validate
 * @access  Public
 */
export const validateCityArea = async (req, res, next) => {
  try {
    const { city, area } = req.body;

    if (!city || !area) {
      return res.status(400).json({
        success: false,
        error: "City and area are required",
      });
    }

    const isValid = await CityArea.isValidCityArea(city, area);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: "Invalid city or area",
      });
    }

    res.status(200).json({
      success: true,
      message: "Valid city and area",
    });
  } catch (error) {
    next(error);
  }
};

// const isValidLocation = await CityArea.isValidCityArea(city, area);
// if (!isValidLocation) {
//   return res.status(400).json({
//     success: false,
//     error: "Selected city and area are not serviceable",
//   });
// }
