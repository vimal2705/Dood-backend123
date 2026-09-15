const crypto = require("crypto");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

const getR2Client = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // AWS SDK v3 sends CRC checksums by default; R2 rejects those requests.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
};

const publicBaseUrl = () =>
  String(process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");

const extensionFor = (mimetype = "") => {
  if (mimetype.includes("png")) return "png";
  if (mimetype.includes("webp")) return "webp";
  if (mimetype.includes("gif")) return "gif";
  if (mimetype.includes("heic") || mimetype.includes("heif")) return "heic";
  return "jpg";
};

exports.uploadImage = async (req, res) => {
  try {
    const client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrl = publicBaseUrl();

    if (!client || !bucket || !publicUrl) {
      return res.status(503).json({
        success: false,
        message:
          "Image upload is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL.",
      });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Choose an image first",
      });
    }

    const key = `dreams/${Date.now()}-${crypto.randomUUID()}.${extensionFor(req.file.mimetype)}`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || "image/jpeg",
        CacheControl: "public, max-age=31536000",
      }),
    );

    return res.status(201).json({
      success: true,
      url: `${publicUrl}/${key}`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not upload image",
    });
  }
};
