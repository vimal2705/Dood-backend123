const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth");
const { listReels, createReel, deleteReel } = require("../controllers/reelController");

const router = express.Router();

router.use(auth);

router.get("/", listReels);
router.post("/", body("url", "A link is required").trim().notEmpty(), createReel);
router.delete("/:id", deleteReel);

module.exports = router;
