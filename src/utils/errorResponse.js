// class ErrorResponse extends Error {
//   constructor(message, statusCode) {
//     super(message);
//     this.statusCode = statusCode;
//   }
// }

// module.exports = ErrorResponse;

const ErrorResponse = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.name = "ErrorResponse";
  return error;
};

export default ErrorResponse;
