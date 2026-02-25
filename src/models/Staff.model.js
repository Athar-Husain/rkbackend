import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const staffSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Staff name is required"],
      trim: true,
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
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      match: [/^[6-9]\d{9}$/, "Please enter a valid Indian mobile number"],
      unique: true,
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false, // Prevents password from leaking in API responses
    },
    userType: {
      type: String,
      lowercase: true,
      default: "staff",
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
    role: {
      type: String,
      //   enum: ["STAFF", "MANAGER", "ADMIN"],
      lowercase: true,
      default: "staff",
    },
    permissions: {
      canVerifyCoupon: { type: Boolean, default: true },
      canRedeemCoupon: { type: Boolean, default: true },
      canCreatePurchase: { type: Boolean, default: true },
      canViewBranchReports: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
    lastActive: Date,
  },
  { timestamps: true },
);

/**
 * 🔐 MODERN ASYNC PASSWORD HASHING
 */
staffSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * 🔑 AUTHENTICATION METHOD
 */
staffSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Staff = mongoose.model("Staff", staffSchema);
export default Staff;
