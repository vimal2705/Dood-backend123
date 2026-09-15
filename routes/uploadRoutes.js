const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const { uploadImage } = require("../controllers/uploadController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const type = file.mimetype || "";
    if (!type || type === "application/octet-stream") {
      file.mimetype = "image/jpeg";
      return cb(null, true);
    }
    if (type.startsWith("image/")) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed"));
  },
});

router.use(auth);
router.post("/", upload.single("image"), uploadImage);

module.exports = router;
