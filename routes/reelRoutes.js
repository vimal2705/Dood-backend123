const express = require("express");
const multer = require("multer");
const { body } = require("express-validator");
const auth = require("../middleware/auth");
const {
  listReels,
  createReel,
  uploadReelFile,
  deleteReel,
} = require("../controllers/reelController");
const { MAX_BYTES } = require("../utils/reelFile");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const type = file.mimetype || "";
    if (type.startsWith("video/") || type === "application/octet-stream") {
      return cb(null, true);
    }
    cb(new Error("Only video files are allowed"));
  },
});

router.use(auth);

router.get("/", listReels);
router.post("/file", upload.single("video"), uploadReelFile);
router.post("/", body("url", "A link is required").trim().notEmpty(), createReel);
router.delete("/:id", deleteReel);

module.exports = router;
