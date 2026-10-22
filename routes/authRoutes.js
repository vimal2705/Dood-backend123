const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const {
  signup,
  login,
  refresh,
  logout,
  forgotPassword,
  verifyOtp,
  resetPassword,
  verifyOtpAndReset,
  getMe,
  getMeWithToken,
  updateProfile,
  changePassword,
  deleteAccount,
} = require("../controllers/authController");
const auth = require("../middleware/auth");

// Validation middleware
const signupValidation = [
  body("name", "Name is required").trim().notEmpty(),
  body("email", "Invalid email").isEmail(),
  body("username", "Username must be at least 3 characters").isLength({
    min: 3,
  }),
  body("password", "Password must be at least 6 characters").isLength({
    min: 6,
  }),
  body("phoneNumber")
    .optional({ values: "falsy" })
    .matches(/^\d{10}$/)
    .withMessage("Phone number must be 10 digits"),
  body("dob", "Date of birth is required").isISO8601(),
];

const loginValidation = [
  body("email", "Invalid email").isEmail(),
  body("password", "Password is required").notEmpty(),
];

const verifyOtpValidation = [
  body("email", "Invalid email").isEmail(),
  body("otp", "OTP is required").notEmpty(),
];

const resetPasswordValidation = [
  body("email", "Invalid email").isEmail(),
  body("resetToken", "Reset token is required").notEmpty(),
  body("newPassword", "Password must be at least 6 characters").isLength({
    min: 6,
  }),
];

// Routes
router.post("/signup", signupValidation, signup);
router.post("/login", loginValidation, login);
router.post("/refresh", refresh);
router.post("/logout", auth, logout);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtpValidation, verifyOtp);
router.post("/reset-password", resetPasswordValidation, resetPassword);
router.post(
  "/verify-otp-and-reset",
  [
    body("email", "Invalid email").isEmail(),
    body("otp", "OTP is required").notEmpty(),
    body("newPassword", "Password must be at least 6 characters").isLength({
      min: 6,
    }),
  ],
  verifyOtpAndReset,
);
router.get("/me", auth, getMe);
router.put(
  "/me",
  auth,
  [
    body("name").optional().trim().notEmpty(),
    body("phoneNumber")
      .optional({ values: "null" })
      .custom(value => {
        const phone = String(value ?? "").trim();
        return phone === "" || /^\d{10}$/.test(phone);
      })
      .withMessage("Phone number must be 10 digits"),
    body("intent").optional(),
  ],
  updateProfile,
);
router.put(
  "/password",
  auth,
  [
    body("currentPassword", "Current password is required").notEmpty(),
    body("newPassword", "Password must be at least 6 characters").isLength({
      min: 6,
    }),
  ],
  changePassword,
);
router.delete(
  "/me",
  auth,
  [body("password", "Password is required").notEmpty()],
  deleteAccount,
);
router.post("/me-with-token", getMeWithToken);

module.exports = router;
