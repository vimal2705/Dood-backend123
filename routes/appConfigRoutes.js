const express = require("express");
const { getAppConfig } = require("../controllers/appConfigController");

const router = express.Router();

router.get("/", getAppConfig);

module.exports = router;
