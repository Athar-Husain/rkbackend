// middleware/errorHandler.js
import ErrorResponse from "../utils/errorResponse.js"; // Import the ErrorResponse function

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console for dev
  console.error(err.stack);

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = `Resource not found with id of ${err.value}`;
    error = ErrorResponse(message, 404); // Use the function to create the error
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `Duplicate field value entered: ${field} "${value}" already exists`;
    error = ErrorResponse(message, 400); // Use the function
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    error = ErrorResponse(message, 400); // Use the function
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    const message = "Invalid token";
    error = ErrorResponse(message, 401); // Use the function
  }

  if (err.name === "TokenExpiredError") {
    const message = "Token expired";
    error = ErrorResponse(message, 401); // Use the function
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || "Server Error",
  });
};

export default errorHandler;
