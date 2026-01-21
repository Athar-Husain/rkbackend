const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Route not found - ${req.originalUrl}`,
  });
};

// module.exports = notFound;

export default notFound;
