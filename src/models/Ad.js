import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
const { hash, compare } = bcrypt;

const adminSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  userType: { type: String, default: 'Admin' },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now },
  fcmTokens: [{ type: String }], // Stores multiple device tokens
});

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await hash(this.password, 12);
  next();
});

adminSchema.methods.comparePassword = function (password) {
  return compare(password, this.password);
};

export default model('Admin2', adminSchema);
