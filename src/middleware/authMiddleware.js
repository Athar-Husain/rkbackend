import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import CustomerModel from '../models/Customer.model.js';
import AdminModel from '../models/Admin.model.js';
import TeamModel from '../models/Team.model.js';

/**
 * @desc Protects routes for Admin users only.
 */
export const AdminProtect = asyncHandler(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await AdminModel.findById(decoded.id).select('-password');

    if (!admin) {
      return res.status(401).json({ message: 'Admin not found' });
    }

    if (admin.userType !== 'Admin') {
      return res.status(403).json({ message: 'Access denied: Not an Admin' });
    }

    req.user = admin;
    next();
  } catch (error) {
    const isJwtError =
      error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError';
    const message = isJwtError ? 'Invalid or expired token' : error.message;
    res.status(401).json({ message });
  }
});




/**
 * @desc Protects routes for Customer users only.
 */
export const CustomerProtect = asyncHandler(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const customer = await CustomerModel.findById(decoded.id).select(
      '-password'
    );

    if (!customer) {
      return res.status(401).json({ message: 'Customer not found' });
    }

    if (customer.userType !== 'Customer') {
      return res.status(403).json({ message: 'Access denied: Not a customer' });
    }

    req.user = customer;
    next();
  } catch (error) {
    const isJwtError =
      error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError';
    const message = isJwtError ? 'Invalid or expired token' : error.message;
    res.status(401).json({ message });
  }
});

/**
 * @desc Protects routes for Team users only.
 */
export const TeamProtect = asyncHandler(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const teamMember = await TeamModel.findById(decoded.id).select('-password');

    if (!teamMember) {
      return res.status(401).json({ message: 'Team member not found' });
    }

    if (teamMember.userType !== 'Team') {
      return res
        .status(403)
        .json({ message: 'Access denied: Not a Team member' });
    }

    req.user = teamMember;
    next();
  } catch (error) {
    const isJwtError =
      error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError';
    const message = isJwtError ? 'Invalid or expired token' : error.message;
    res.status(401).json({ message });
  }
});

/**
 * @desc A common middleware that protects routes and identifies the user
 * from any of the three user models (Admin, Customer, Team).
 */
export const commonProtect = asyncHandler(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user;

    // Attempt to find the user in each model
    user = await AdminModel.findById(decoded.id).select('-password');
    if (!user) {
      user = await TeamModel.findById(decoded.id).select('-password');
    }
    if (!user) {
      user = await CustomerModel.findById(decoded.id).select('-password');
    }

    if (!user) {
      return res
        .status(401)
        .json({ message: 'User not found or invalid token.' });
    }

    // Attach the user object to the request
    req.user = user;
    next();
  } catch (error) {
    const isJwtError =
      error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError';
    const message = isJwtError ? 'Invalid or expired token' : error.message;
    res.status(401).json({ message });
  }
});

export const AdminTeamProtect = asyncHandler(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user;

    // Attempt to find the user in each model
    user = await AdminModel.findById(decoded.id).select('-password');
    if (!user) {
      user = await TeamModel.findById(decoded.id).select('-password');
    }

    if (!user) {
      return res
        .status(401)
        .json({ message: 'User not found or invalid token.' });
    }

    // Attach the user object to the request
    req.user = user;
    next();
  } catch (error) {
    const isJwtError =
      error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError';
    const message = isJwtError ? 'Invalid or expired token' : error.message;
    res.status(401).json({ message });
  }
});
