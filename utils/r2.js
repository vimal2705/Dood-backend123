const { DeleteObjectCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

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
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
};

const publicBaseUrl = () =>
  String(process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");

const keyFromPublicUrl = url => {
  const base = publicBaseUrl();
  const value = String(url || "");
  if (!base || !value.startsWith(`${base}/`)) return null;
  return decodeURIComponent(value.slice(base.length + 1));
};

const putObject = async ({ key, body, contentType }) => {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = publicBaseUrl();

  if (!client || !bucket || !publicUrl) {
    const error = new Error(
      "Storage is not configured. Add the R2 account, keys, bucket, and public URL.",
    );
    error.status = 503;
    throw error;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
      CacheControl: "public, max-age=31536000",
    }),
  );

  return `${publicUrl}/${key}`;
};

const deleteByUrls = async urls => {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  const keys = [...new Set((urls || []).map(keyFromPublicUrl).filter(Boolean))];
  if (!client || !bucket || !keys.length) return;

  await Promise.all(
    keys.map(Key =>
      client.send(new DeleteObjectCommand({ Bucket: bucket, Key })).catch(() => null),
    ),
  );
};

module.exports = {
  getR2Client,
  publicBaseUrl,
  putObject,
  deleteByUrls,
  keyFromPublicUrl,
};
