const MAX_BYTES = 40 * 1024 * 1024;

const EXTENSIONS = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
  "video/3gpp2": "3g2",
  "video/x-m4v": "m4v",
};

const VIDEO_PATH = /\.(mp4|mov|m4v|webm|3gp|3g2)(\?|#|$)/i;

const extensionFor = (mimetype = "", filename = "") => {
  const type = String(mimetype).split(";")[0].trim().toLowerCase();
  if (EXTENSIONS[type]) return EXTENSIONS[type];
  const match = String(filename).toLowerCase().match(/\.(mp4|mov|m4v|webm|3gp|3g2)$/);
  return match ? match[1] : "mp4";
};

const isPrivateHost = hostname => {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (host === "0.0.0.0" || host === "::1" || host === "169.254.169.254") return true;
  return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
};

const looksLikeVideoUrl = raw => {
  try {
    const url = new URL(String(raw || ""));
    if (url.protocol !== "https:" || isPrivateHost(url.hostname)) return false;
    return VIDEO_PATH.test(url.pathname);
  } catch {
    return false;
  }
};

const downloadVideo = async raw => {
  const url = new URL(String(raw || ""));
  if (url.protocol !== "https:" || isPrivateHost(url.hostname)) {
    const error = new Error("Paste a public https video link.");
    error.status = 400;
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let response;
  try {
    response = await fetch(url, { redirect: "follow", signal: controller.signal });
  } catch (error) {
    const failed = new Error("Could not download that video.");
    failed.status = 400;
    throw failed;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const error = new Error("Could not download that video.");
    error.status = 400;
    throw error;
  }

  const type = String(response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_BYTES) {
    const error = new Error("Video is too large (max 40MB).");
    error.status = 400;
    throw error;
  }
  if (type && !type.startsWith("video/") && type !== "application/octet-stream") {
    const error = new Error("That link is not a video file.");
    error.status = 400;
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_BYTES) {
    const error = new Error(
      buffer.length ? "Video is too large (max 40MB)." : "That video file is empty.",
    );
    error.status = 400;
    throw error;
  }

  return {
    buffer,
    contentType: type.startsWith("video/") ? type : "video/mp4",
    extension: extensionFor(type, url.pathname),
  };
};

module.exports = {
  MAX_BYTES,
  extensionFor,
  looksLikeVideoUrl,
  downloadVideo,
};
