import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Please enter a valid Indian mobile number"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Hidden by default in queries
    },
    city: {
      type: String,
      required: [true, "City is required"],
    },
    area: {
      type: String,
      required: [true, "Area is required"],
    },
    registrationStore: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
    },
    referralCode: {
      type: String,
      unique: true,
      uppercase: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    userType: { type: String, default: "Customer" },
    // deviceTokens: [
    //   {
    //     token: String,
    //     platform: {
    //       type: String,
    //       enum: ["android", "ios", "web"],
    //     },
    //     lastActive: Date,
    //   },
    // ],
    deviceTokens: [
      {
        token: String,
        platform: {
          type: String,
          enum: ["android", "ios", "web"],
          default: "android",
        },
        lastUsed: { type: Date, default: Date.now },
      },
    ],

    preferences: {
      notifications: { type: Boolean, default: true },
      smsAlerts: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    lastLogin: Date,
    passwordResetAt: Date,
  },
  {
    timestamps: true,
  },
);

// --- HOOKS ---

// Hash password before saving
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) {
//     return next();
//   }
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);

//   if (!this.referralCode) {
//     this.referralCode = await generateUniqueReferralCode();
//   }
//   next();
// });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  if (!this.referralCode) {
    this.referralCode = await generateUniqueReferralCode();
  }
});

// --- METHODS ---

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check for active coupons
userSchema.methods.hasActiveCoupons = async function () {
  const UserCoupon = mongoose.model("UserCoupon");
  const count = await UserCoupon.countDocuments({
    userId: this._id,
    status: "ACTIVE",
  });
  return count > 0;
};

// Helper: Generate Referral Code
async function generateUniqueReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  let isUnique = false;
  while (!isUnique) {
    code = "RK";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existingUser = await mongoose.models.User.findOne({
      referralCode: code,
    });
    if (!existingUser) isUnique = true;
  }
  return code;
}

const User = mongoose.model("User", userSchema);
export default User;
