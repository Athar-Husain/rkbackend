import mongoose from "mongoose";

const areaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  pincodes: [String],
  isActive: {
    type: Boolean,
    default: true,
  },
});

const cityAreaSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    areas: [areaSchema],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

/* ---------------- STATIC METHODS ---------------- */

cityAreaSchema.statics.getCitiesForMobile = function () {
  return this.find({ isActive: true })
    .select("city areas._id areas.name")
    .sort({ city: 1 });
};

cityAreaSchema.statics.isValidCityArea = async function (cityId, areaId) {
  const city = await this.findOne({
    _id: cityId,
    "areas._id": areaId,
    "areas.isActive": true,
  });

  return !!city;
};

export default mongoose.model("CityArea", cityAreaSchema);
