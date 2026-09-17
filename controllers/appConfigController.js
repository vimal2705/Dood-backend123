const DEFAULT_MESSAGE =
  "This version of Dood can no longer run. Update to continue.";

const normalizeVersion = (value, fallback) => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw.replace(/^v/i, "");
};

exports.getAppConfig = async (_req, res) => {
  try {
    const iosMin = normalizeVersion(process.env.IOS_MIN_VERSION, "1.0.0");
    const androidMin = normalizeVersion(
      process.env.ANDROID_MIN_VERSION,
      process.env.IOS_MIN_VERSION || "1.0.0",
    );

    res.status(200).json({
      success: true,
      ios: {
        minVersion: iosMin,
        storeUrl: String(process.env.IOS_STORE_URL || "").trim(),
      },
      android: {
        minVersion: androidMin,
        storeUrl:
          String(process.env.ANDROID_STORE_URL || "").trim() ||
          "https://play.google.com/store/apps/details?id=com.dood",
      },
      message:
        String(process.env.FORCE_UPDATE_MESSAGE || "").trim() || DEFAULT_MESSAGE,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Could not load app config",
    });
  }
};
