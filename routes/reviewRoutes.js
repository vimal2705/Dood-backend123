const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth");
const {
  getPulse,
  saveEvening,
  getWeek,
} = require("../controllers/reviewController");

const router = express.Router();

router.use(auth);

router.get("/pulse", getPulse);
router.get("/week", getWeek);
router.post(
  "/evening",
  body("finished").optional().trim().isLength({ max: 200 }),
  body("leftover").optional().trim().isLength({ max: 400 }),
  saveEvening,
);

module.exports = router;
