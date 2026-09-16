const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth");
const {
  suggestChallenge,
  createChallenge,
  listChallenges,
  getChallenge,
  startChallenge,
  completeChallenge,
  declineChallenge,
} = require("../controllers/challengeController");

const router = express.Router();
router.use(auth);

router.post("/suggest", suggestChallenge);
router.post(
  "/",
  body("title").optional().trim().isLength({ min: 1, max: 100 }),
  body("duration").optional().isInt({ min: 10, max: 180 }),
  createChallenge,
);
router.get("/", listChallenges);
router.get("/:id", getChallenge);
router.post("/:id/start", startChallenge);
router.post(
  "/:id/complete",
  body("outcome").optional().isIn(["done", "partly", "open", "stopped", "dropped"]),
  completeChallenge,
);
router.post("/:id/decline", declineChallenge);

module.exports = router;
