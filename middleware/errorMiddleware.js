export const errorHandler = (err, req, res, next) => {
  // Normalize non-Error objects (e.g. Cloudinary rejects with plain objects)
  if (!(err instanceof Error)) {
    err = new Error(
      typeof err === "string" ? err : JSON.stringify(err)
    );
  }

  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    err.message = "File is too large. Maximum allowed size is 5MB.";
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    statusCode = 400;
    err.message = "Unexpected file field. Please use the correct file input.";
  }

  console.error(`❌ ERROR [${statusCode}]: ${err.message}`);
  console.error(`   PATH: ${req.method} ${req.originalUrl}`);
  if (statusCode === 500) {
    console.error(`   STACK: ${err.stack}`);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || "Server Error",
    ...(process.env.NODE_ENV !== "production" && statusCode === 500
      ? { stack: err.stack }
      : {}),
  });
};

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};