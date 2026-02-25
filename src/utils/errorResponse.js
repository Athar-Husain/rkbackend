// class ErrorResponse extends Error {
//   constructor(message, statusCode) {
//     super(message);
//     this.statusCode = statusCode;
//   }
// }

// module.exports = ErrorResponse;

// const ErrorResponse = (message, statusCode) => {
//   const error = new Error(message);
//   error.statusCode = statusCode;
//   error.name = "ErrorResponse";
//   return error;
// };

// export default ErrorResponse;

// utils/errorResponse.js
const ErrorResponse = (message, statusCode) => {
  const error = new Error(message); // Create a new error
  error.statusCode = statusCode; // Attach the status code
  error.name = "ErrorResponse"; // Optionally give the error a name
  return error; // Return the error object
};

export default ErrorResponse;
