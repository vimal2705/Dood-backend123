const User = require("../models/User");
const Dream = require("../models/Dream");
const Action = require("../models/Action");
const Task = require("../models/Task");
const Idea = require("../models/Idea");
const Note = require("../models/Note");
const MoneyEntry = require("../models/MoneyEntry");
const FocusSession = require("../models/FocusSession");
const ChallengeSession = require("../models/ChallengeSession");
const ProductivityPreference = require("../models/ProductivityPreference");
const ProductivityInsight = require("../models/ProductivityInsight");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { DeleteObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const sendEmail = require("../utils/email");
const { INTENTS } = require("../utils/intents");
const { validationResult } = require("express-validator");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

const createPasswordResetToken = () => crypto.randomBytes(32).toString("hex");
const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const otpMatches = (storedHash, otp) => {
  if (!storedHash || !otp) return false;
  const providedHash = hashToken(otp);
  const stored = Buffer.from(String(storedHash));
  const provided = Buffer.from(providedHash);
  if (stored.length !== provided.length) return false;
  return crypto.timingSafeEqual(stored, provided);
};

const publicBaseUrl = () =>
  String(process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");

const r2KeyFromUrl = (url) => {
  const base = publicBaseUrl();
  const value = String(url || "");
  if (!base || !value.startsWith(`${base}/`)) return null;
  return decodeURIComponent(value.slice(base.length + 1));
};

const deleteDreamImages = async (urls) => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const keys = [...new Set((urls || []).map(r2KeyFromUrl).filter(Boolean))];
  if (!keys.length || !accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  await Promise.all(
    keys.map((Key) =>
      client.send(new DeleteObjectCommand({ Bucket: bucket, Key })).catch(() => null),
    ),
  );
};

exports.deleteAccount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { password } = req.body;
    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const matches = await user.matchPassword(password);
    if (!matches) {
      return res.status(400).json({
        success: false,
        message: "Password is wrong",
      });
    }

    const userId = user._id;
    const dreams = await Dream.find({ userId }).select("image");
    await deleteDreamImages(dreams.map((dream) => dream.image));

    await Promise.all([
      Dream.deleteMany({ userId }),
      Action.deleteMany({ userId }),
      Task.deleteMany({ userId }),
      Idea.deleteMany({ userId }),
      Note.deleteMany({ userId }),
      MoneyEntry.deleteMany({ userId }),
      FocusSession.deleteMany({ userId }),
      ChallengeSession.deleteMany({ userId }),
      ProductivityPreference.deleteMany({ userId }),
      ProductivityInsight.deleteMany({ userId }),
    ]);

    await User.deleteOne({ _id: userId });

    return res.json({
      success: true,
      message: "Account deleted",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, username, password, phoneNumber, dob, intent } = req.body;

    // Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    // Create new user
    user = new User({
      name,
      email,
      username,
      password,
      phoneNumber,
      dob,
      ...(INTENTS.includes(intent) ? { intent } : {}),
    });

    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        phoneNumber: user.phoneNumber,
        dob: user.dob,
        intent: user.intent || null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        phoneNumber: user.phoneNumber,
        dob: user.dob,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide an email" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account exists for this email, an OTP has been sent",
      });
    }

    // Generate 6-digit OTP (store only the hash)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetPasswordOtpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.resetPasswordOtp = hashToken(otp);
    user.resetPasswordOtpExpire = resetPasswordOtpExpire;
    await user.save();

    const message = `
      <h1>Password Reset OTP</h1>
      <p>You have requested a password reset</p>
      <p>Your OTP is: <strong style="font-size: 24px; color: #007bff;">${otp}</strong></p>
      <p>This OTP is valid for 10 minutes only.</p>
      <p>Do not share this OTP with anyone.</p>
      <p>If you did not request a password reset, please ignore this email.</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: "Password Reset OTP",
        message,
      });

      res.status(200).json({
        success: true,
        message: "If an account exists for this email, an OTP has been sent",
      });
    } catch (error) {
      user.resetPasswordOtp = undefined;
      user.resetPasswordOtpExpire = undefined;
      await user.save();

      return res
        .status(500)
        .json({ success: false, message: "Email could not be sent" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify OTP (returns reset token)
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.resetPasswordOtp || !user.resetPasswordOtpExpire) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request a new password reset.",
      });
    }

    if (Date.now() > user.resetPasswordOtpExpire) {
      user.resetPasswordOtp = undefined;
      user.resetPasswordOtpExpire = undefined;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new password reset.",
      });
    }

    if (!otpMatches(user.resetPasswordOtp, otp)) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    const resetToken = createPasswordResetToken();
    user.resetPasswordTokenHash = hashToken(resetToken);
    user.resetPasswordTokenExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    // OTP is one-time: clear it once verified
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpire = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      email: user.email,
      resetToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset password using reset token
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, resetToken, newPassword } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.resetPasswordTokenHash || !user.resetPasswordTokenExpire) {
      return res.status(400).json({
        success: false,
        message: "No reset token found. Please verify OTP again.",
      });
    }

    if (Date.now() > user.resetPasswordTokenExpire) {
      user.resetPasswordTokenHash = undefined;
      user.resetPasswordTokenExpire = undefined;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Reset token has expired. Please verify OTP again.",
      });
    }

    const providedHash = hashToken(resetToken);
    if (providedHash !== user.resetPasswordTokenHash) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid reset token" });
    }

    user.password = newPassword;
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordTokenExpire = undefined;
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Password reset successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify OTP and reset password (legacy)
// @route   POST /api/auth/verify-otp-and-reset
// @access  Public
exports.verifyOtpAndReset = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, otp, newPassword } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if OTP exists and is valid
    if (!user.resetPasswordOtp || !user.resetPasswordOtpExpire) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request a new password reset.",
      });
    }

    // Check if OTP has expired
    if (Date.now() > user.resetPasswordOtpExpire) {
      user.resetPasswordOtp = undefined;
      user.resetPasswordOtpExpire = undefined;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new password reset.",
      });
    }

    if (!otpMatches(user.resetPasswordOtp, otp)) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // Reset password
    user.password = newPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpire = undefined;
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordTokenExpire = undefined;
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Password reset successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { name, phoneNumber, intent } = req.body;
    if (name !== undefined) user.name = String(name).trim();
    if (phoneNumber !== undefined) user.phoneNumber = String(phoneNumber).trim();
    if (INTENTS.includes(intent)) {
      user.intent = intent;
    }

    await user.save();
    return res.json({
      success: true,
      message: "Profile updated",
      user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const matches = await user.matchPassword(currentPassword);
    if (!matches) {
      return res.status(400).json({
        success: false,
        message: "Current password is wrong",
      });
    }

    user.password = newPassword;
    await user.save();
    return res.json({ success: true, message: "Password updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current logged in user with token in body
// @route   POST /api/auth/me-with-token
// @access  Public
exports.getMeWithToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide a token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};
