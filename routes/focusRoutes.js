const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth");
const {
  createFocusSession,
  listFocusSessions,
  getFocusSession,
  updateFocusSession,
  completeFocusSession,
  abandonFocusSession,
} = require("../controllers/focusController");

const router = express.Router();
router.use(auth);

router.post(
  "/",
  body("title").optional().trim().isLength({ max: 100 }),
  body("plannedDuration").optional().isInt({ min: 10, max: 180 }),
  body("duration").optional().isInt({ min: 10, max: 180 }),
  body("start").optional().isBoolean(),
  createFocusSession,
);
router.get("/", listFocusSessions);
router.get("/:id", getFocusSession);
router.patch(
  "/:id",
  body("status")
    .optional()
    .isIn(["scheduled", "active", "paused", "interrupted"]),
  body("notes").optional().trim().isLength({ max: 400 }),
  updateFocusSession,
);
router.post(
  "/:id/complete",
  body("outcome").optional().isIn(["done", "partly", "open", "stopped", "dropped"]),
  body("notes").optional().trim().isLength({ max: 400 }),
  completeFocusSession,
);
router.post(
  "/:id/abandon",
  body("outcome").optional().isIn(["done", "partly", "open", "stopped", "dropped"]),
  body("notes").optional().trim().isLength({ max: 400 }),
  abandonFocusSession,
);

module.exports = router;
