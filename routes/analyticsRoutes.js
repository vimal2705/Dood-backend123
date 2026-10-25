const express = require("express");
const auth = require("../middleware/auth");
const { ingest, summary } = require("../controllers/analyticsController");

const router = express.Router();

router.use(auth);
router.post("/events", ingest);
router.get("/summary", summary);

module.exports = router;
