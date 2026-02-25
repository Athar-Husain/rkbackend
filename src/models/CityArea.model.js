import mongoose from "mongoose";

/* ---------------- AREA SCHEMA ---------------- */
const areaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    pincodes: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

/* ---------------- CITY AREA SCHEMA ---------------- */
const cityAreaSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      // removed unique here to avoid duplicate index warning
    },

    areas: [areaSchema],
    

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

/* ---------------- INDEXES ---------------- */
// Unique index for city
// cityAreaSchema.index({ city: 1 }, { unique: true });

// Multikey index for area names inside array
cityAreaSchema.index({ city: 1 }, { unique: true });
cityAreaSchema.index({ "areas.name": 1 });

// Index for filtering active cities
cityAreaSchema.index({ isActive: 1 });

// Optional compound index for faster filtered searches
cityAreaSchema.index({ isActive: 1, city: 1 });

/* ---------------- STATIC METHODS ---------------- */
// (Keep all your static methods as-is from your original code)

cityAreaSchema.statics.getAllCitiesWithAreas = function () {
  // return this.find({ isActive: true })
  return this.find()
    .select("city isActive areas._id areas.name areas.pincodes areas.isActive")
    .sort({ city: 1 })
    .lean();
};

// Get all active cities with their areas
cityAreaSchema.statics.getCitiesForMobile = function () {
  return this.find({ isActive: true })
    .select("city areas._id areas.name areas.pincodes")
    .sort({ city: 1 });
};

// Validate if city and area combination is valid
cityAreaSchema.statics.isValidCityArea = async function (cityId, areaId) {
  try {
    const city = await this.findOne({
      _id: cityId,
      isActive: true,
      "areas._id": areaId,
      "areas.isActive": true,
    });
    return !!city;
  } catch (error) {
    return false;
  }
};

// Get city with specific area
cityAreaSchema.statics.getCityWithArea = async function (cityId, areaId) {
  try {
    const city = await this.findOne({
      _id: cityId,
      isActive: true,
      "areas._id": areaId,
      "areas.isActive": true,
    })
      .select("city areas.$")
      .lean();

    if (!city) return null;

    return {
      city: {
        _id: city._id,
        name: city.city,
      },
      area: city.areas[0],
    };
  } catch (error) {
    return null;
  }
};

// Search cities and areas
cityAreaSchema.statics.searchLocations = async function (query) {
  try {
    const cities = await this.find({
      isActive: true,
      $or: [
        { city: { $regex: query, $options: "i" } },
        { "areas.name": { $regex: query, $options: "i" } },
      ],
    })
      .select("city areas._id areas.name")
      .sort({ city: 1 })
      .limit(10)
      .lean();

    const results = [];

    cities.forEach((city) => {
      // Add city itself
      results.push({
        type: "city",
        _id: city._id,
        name: city.city,
        parentId: null,
      });

      // Add areas of this city
      city.areas.forEach((area) => {
        if (area.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            type: "area",
            _id: area._id,
            name: area.name,
            parentId: city._id,
            parentName: city.city,
          });
        }
      });
    });

    return results;
  } catch (error) {
    return [];
  }
};

// Get areas by city ID
cityAreaSchema.statics.getAreasByCityId = async function (cityId) {
  try {
    const city = await this.findOne({
      _id: cityId,
      isActive: true,
    })
      .select("city areas._id areas.name areas.pincodes")
      .lean();

    if (!city) return [];

    return {
      city: {
        _id: city._id,
        name: city.city,
      },
      areas: city.areas.filter((area) => area.isActive),
    };
  } catch (error) {
    return { city: null, areas: [] };
  }
};

// Get area details
cityAreaSchema.statics.getAreaDetails = async function (cityId, areaId) {
  try {
    const city = await this.findOne({
      _id: cityId,
      "areas._id": areaId,
    })
      .select("city areas.$")
      .lean();

    if (!city) return null;

    return {
      city: {
        _id: city._id,
        name: city.city,
      },
      area: city.areas[0],
    };
  } catch (error) {
    return null;
  }
};

// Check service availability in area
cityAreaSchema.statics.checkServiceAvailability = async function (
  cityId,
  areaId,
) {
  try {
    const city = await this.findOne({
      _id: cityId,
      isActive: true,
      "areas._id": areaId,
      "areas.isActive": true,
    })
      .select("city areas.$")
      .lean();

    if (!city) {
      return {
        available: false,
        message: "Service not available in this location",
      };
    }

    const area = city.areas[0];

    return {
      available: true,
      city: {
        _id: city._id,
        name: city.city,
      },
      area: {
        _id: area._id,
        name: area.name,
        pincodes: area.pincodes || [],
      },
    };
  } catch (error) {
    return {
      available: false,
      message: "Unable to check service availability",
    };
  }
};

export default mongoose.model("CityArea", cityAreaSchema);
