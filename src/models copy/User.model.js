import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/* ---------------- USER SCHEMA ---------------- */
const userSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      match: [/^[6-9]\d{9}$/, "Please enter a valid Indian mobile number"],
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,

      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CityArea",
      required: true,
    },
    area: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    areaName: { type: String, trim: true },
    cityName: { type: String, trim: true },
    profileImage: { type: String, default: "" },
    referralCode: {
      type: String,
      uppercase: true,
      sparse: true,
      unique: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: [0, "Wallet balance cannot be negative"],
    },
    userType: {
      type: String,
      lowercase: true,
      default: "customer",
    },
    deviceTokens: [
      {
        token: String,
        platform: {
          type: String,
          enum: ["android", "ios", "web"],
          default: "android",
        },
        deviceId: String,
        lastUsed: { type: Date, default: Date.now },
      },
    ],
    preferences: {
      notifications: { type: Boolean, default: true },
      smsAlerts: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    lastLogin: Date,
    lastActive: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* ---------------- VIRTUAL FIELDS ---------------- */
userSchema.virtual("fullName").get(function () {
  return this.name;
});

// userSchema.virtual("maskedEmail").get(function () {
//   const [local, domain] = this.email.split("@");
//   return `${local[0]}${"*".repeat(local.length - 2)}${local.slice(-1)}@${domain}`;
// });

userSchema.virtual("maskedEmail").get(function () {
  if (!this.email || !this.email.includes("@")) return "";

  const [local, domain] = this.email.split("@");

  if (local.length <= 2) {
    return `${local[0] || ""}*@${domain}`;
  }

  return `${local[0]}${"*".repeat(local.length - 2)}${local.slice(-1)}@${domain}`;
});

// userSchema.virtual("maskedMobile").get(function () {
//   return `${this.mobile.slice(0, 3)}****${this.mobile.slice(-3)}`;
// });

userSchema.virtual("maskedMobile").get(function () {
  if (!this.mobile || this.mobile.length < 6) return "";
  return `${this.mobile.slice(0, 3)}****${this.mobile.slice(-3)}`;
});

/* ---------------- INDEXES ---------------- */
userSchema.index({ createdAt: -1 });
userSchema.index({ "deviceTokens.token": 1 });
userSchema.index({ city: 1, area: 1 });

/* ---------------- PRE-SAVE HOOKS ---------------- */
// Merged logic for password hashing, referral codes, and location names
userSchema.pre("save", async function () {
  // 1. Password & Timestamp logic
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);

    // Only set passwordChangedAt if the record already existed (not on initial signup)
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000;
    }
  }

  // 2. Referral Code logic
  if (!this.referralCode) {
    this.referralCode = await generateUniqueReferralCode();
  }

  // 3. City & Area Name auto-population logic
  if (
    this.isModified("city") ||
    this.isModified("area") ||
    !this.cityName ||
    !this.areaName
  ) {
    if (this.city && this.area) {
      try {
        const CityArea = mongoose.model("CityArea");
        const cityData = await CityArea.findOne({
          _id: this.city,
          "areas._id": this.area,
        })
          .select("city areas.$")
          .lean();

        if (cityData) {
          this.cityName = cityData.city;
          this.areaName = cityData.areas[0].name;
        }
      } catch (error) {
        console.error("Mongoose Pre-save Error (Location):", error);
      }
    }
  }
});

/* ---------------- HELPER FUNCTIONS ---------------- */
async function generateUniqueReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    code = "RK";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    exists = await mongoose.models.User.findOne({ referralCode: code });
    attempts++;
  }

  if (attempts >= 10) {
    code = `RK${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }
  return code;
}

/* ---------------- METHODS ---------------- */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

userSchema.methods.incrementLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 };
  }
  return await this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = async function () {
  return await this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};

/* ---------------- EXPORT ---------------- */
const User = mongoose.model("User", userSchema);
export default User;
