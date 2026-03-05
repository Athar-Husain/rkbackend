import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Store name is required"],
      trim: true,
    },
    code: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ["MAIN", "BRANCH", "SUB_BRANCH"],
      default: "BRANCH",
    },
    location: {
      address: { type: String, required: true },
      area: { type: String, required: true }, // Logic: "jagruti nagar" -> "JAGRUTI-NAGAR"
      city: { type: String, required: true }, // Logic: "ballari" -> "BALLARI"
      state: { type: String, required: true, default: "KARNATAKA" },
      pincode: String,
      coordinates: { lat: Number, lng: Number },
      landmark: String,
      gmapsLink: String,
    },
    contact: {
      phone: { type: String, required: true },
      whatsapp: String,
      email: String,
      managerName: String,
    },
    timings: {
      open: { type: String, default: "10:00 AM" },
      close: { type: String, default: "08:00 PM" },
      workingDays: {
        type: [String],
        default: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

/**
 * 🚀 MODERN ASYNC PRE-SAVE HOOK
 * Handles String Formatting & Store Code Generation
 */
storeSchema.pre("save", async function () {
  if (this.location) {
    // 1. Format City: Trim and Uppercase
    if (this.location.city) {
      this.location.city = this.location.city.trim().toUpperCase();
    }

    // 2. Format Area: Trim, Uppercase, and Replace Spaces with Hyphens
    if (this.location.area) {
      this.location.area = this.location.area
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "-"); // Replaces one or more spaces with a single hyphen
    }

    // 3. Generate Store Code if not provided
    if (!this.code && this.location.city && this.location.area) {
      const cityPart = this.location.city.substring(0, 3);
      const areaPart = this.location.area.substring(0, 3);
      const randomNum = Math.floor(100 + Math.random() * 900);
      this.code = `${cityPart}-${areaPart}-${randomNum}`;
    }
  }
});

const Store = mongoose.model("Store", storeSchema);
export default Store;
