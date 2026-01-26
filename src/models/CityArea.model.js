// const mongoose = require("mongoose");
import mongoose from "mongoose";

const cityAreaSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: [true, "City name is required"],
      trim: true,
      unique: true,
      toLowerCase: true,
    },
    areas: [
      {
        name: {
          type: String,
          required: true,
          toLowerCase: true,
          trim: true,
        },
        pincodes: [String],
        isActive: {
          type: Boolean,
          default: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: Date,
  },
  {
    timestamps: true,
  },
);

// Method to add new area to city
cityAreaSchema.methods.addArea = function (areaName, pincodes = []) {
  this.areas.push({
    name: areaName,
    pincodes: pincodes,
  });
  return this.save();
};

// Method to remove area from city
cityAreaSchema.methods.removeArea = function (areaName) {
  this.areas = this.areas.filter((area) => area.name !== areaName);
  return this.save();
};

// Static method to get all cities with areas
cityAreaSchema.statics.getAllCitiesWithAreas = function () {
  return this.find({ isActive: true })
    .select("city areas.name areas.pincodes")
    .sort({ city: 1 });
};

// Static method to check if area exists in city
cityAreaSchema.statics.isValidCityArea = async function (city, area) {
  const cityDoc = await this.findOne({
    city: new RegExp(`^${city}$`, "i"),
    isActive: true,
  });

  if (!cityDoc) return false;

  const areaExists = cityDoc.areas.some(
    (a) => a.name.toLowerCase() === area.toLowerCase() && a.isActive,
  );

  return areaExists;
};

const CityArea = mongoose.model("CityArea", cityAreaSchema);
// module.exports = CityArea;
export default CityArea;
