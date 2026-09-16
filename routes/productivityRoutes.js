const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth");
const {
  getPreferences,
  updatePreferences,
  getInsights,
  refreshInsights,
  getWidgetSnapshot,
  getCockpit,
} = require("../controllers/productivityController");

const router = express.Router();
router.use(auth);

const timeField = (field) =>
  body(field)
    .optional({ values: "falsy" })
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage(`${field} must be HH:mm`);

router.get("/preferences", getPreferences);
router.patch(
  "/preferences",
  body("mode")
    .optional()
    .isIn(["morning", "afternoon", "evening", "peak", "unset"]),
  timeField("preferredStartTime"),
  timeField("preferredEndTime"),
  timeField("peakHour"),
  timeField("eveningShutdownTime"),
  body("focusDuration").optional().isInt({ min: 10, max: 180 }),
  updatePreferences,
);
router.get("/insights", getInsights);
router.post("/insights/refresh", refreshInsights);
router.get("/widget-snapshot", getWidgetSnapshot);
router.get("/cockpit", getCockpit);

module.exports = router;
