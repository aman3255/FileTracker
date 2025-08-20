const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadsDir = "uploads/files";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/files");
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname;
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    const uniqueFilename = `${baseName}-${timestamp}${extension}`;
    cb(null, uniqueFilename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /csv|xlsx|xls/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const allowedMimeTypes = [
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  const mimetype =
    allowedMimeTypes.includes(file.mimetype) ||
    file.mimetype.includes("csv") ||
    file.mimetype.includes("excel") ||
    file.mimetype.includes("spreadsheet");

  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV or Excel files are allowed"), false);
  }
};

const uploadFile = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
}).single("file");

const multerMiddleware = (req, res, next) => {
  uploadFile(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded. Please select a file.",
      });
    }

    next();
  });
};

module.exports = {
  multerMiddleware,
};
