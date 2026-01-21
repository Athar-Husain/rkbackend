const mongoose = require("mongoose");

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
      uppercase: true,
      required: true,
    },
    type: {
      type: String,
      enum: ["MAIN", "BRANCH", "SUB_BRANCH"],
      default: "BRANCH",
    },

    // Location
    location: {
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      area: {
        type: String,
        required: true,
      },
      pincode: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
      landmark: String,
    },

    // Contact Information
    contact: {
      phone: {
        type: String,
        required: true,
      },
      whatsapp: String,
      email: String,
      manager: {
        name: String,
        phone: String,
      },
    },

    // Timings
    timings: {
      open: {
        type: String,
        default: "10:00 AM",
      },
      close: {
        type: String,
        default: "8:00 PM",
      },
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

    // Staff Accounts (Simple credentials)
    staffAccounts: [
      {
        username: String,
        password: String,
        name: String,
        role: {
          type: String,
          enum: ["STAFF", "MANAGER"],
          default: "STAFF",
        },
        isActive: {
          type: Boolean,
          default: true,
        },
        lastLogin: Date,
      },
    ],

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Metadata
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Generate store code before saving
storeSchema.pre("save", function (next) {
  if (!this.code) {
    const cityCode = this.location.city.substring(0, 3).toUpperCase();
    const areaCode = this.location.area.substring(0, 3).toUpperCase();
    const randomNum = Math.floor(100 + Math.random() * 900);
    this.code = `${cityCode}${areaCode}${randomNum}`;
  }
  next();
});

// Method to add staff account
storeSchema.methods.addStaffAccount = function (
  username,
  password,
  name,
  role = "STAFF"
) {
  this.staffAccounts.push({
    username,
    password, // In production, hash this password
    name,
    role,
    isActive: true,
  });
  return this.save();
};

// Method to verify staff credentials
storeSchema.methods.verifyStaff = function (username, password) {
  const staff = this.staffAccounts.find(
    (acc) =>
      acc.username === username && acc.password === password && acc.isActive
  );
  return staff || null;
};

// Static method to find stores by city
storeSchema.statics.findByCity = function (city) {
  return this.find({
    "location.city": new RegExp(`^${city}$`, "i"),
    isActive: true,
  }).sort({ "location.area": 1 });
};

// Static method to find stores by area
storeSchema.statics.findByArea = function (city, area) {
  return this.find({
    "location.city": new RegExp(`^${city}$`, "i"),
    "location.area": new RegExp(`^${area}$`, "i"),
    isActive: true,
  });
};

const Store = mongoose.model("Store", storeSchema);
module.exports = Store;
