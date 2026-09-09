const express = require("express");
const { body } = require("express-validator");
const {
  mentorChat,
  morningMotivation,
  planToday,
  expandDream,
  applyDreamPlan,
  classifyIdea,
} = require("../controllers/aiController");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

router.post(
  "/mentor",
  body("message", "Message is required").trim().notEmpty(),
  mentorChat,
);

router.post("/plan-today", planToday);

router.get("/morning", morningMotivation);

router.post(
  "/expand-dream",
  body("dreamId", "dreamId is required").isMongoId(),
  expandDream,
);

router.post(
  "/expand-dream/apply",
  body("dreamId", "dreamId is required").isMongoId(),
  body("actions", "actions must be an array").isArray({ min: 1, max: 4 }),
  applyDreamPlan,
);

router.post(
  "/classify-idea",
  body("ideaId", "ideaId is required").isMongoId(),
  classifyIdea,
);

module.exports = router;
