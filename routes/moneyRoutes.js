const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth");
const {
  parseMoney,
  createMoney,
  listMoney,
  moneyStats,
  deleteMoney,
} = require("../controllers/moneyController");

const router = express.Router();

router.use(auth);

router.post("/parse", body("text").trim().notEmpty(), parseMoney);
router.post(
  "/",
  body("text").optional().trim(),
  body("type").optional().isIn(["in", "out", "save"]),
  body("amount").optional().isFloat({ gt: 0 }),
  body("category")
    .optional()
    .isIn([
      "food",
      "rent",
      "travel",
      "fun",
      "bills",
      "health",
      "work",
      "income",
      "save",
      "other",
    ]),
  createMoney,
);
router.get("/", listMoney);
router.get("/stats/summary", moneyStats);
router.delete("/:id", deleteMoney);

module.exports = router;
