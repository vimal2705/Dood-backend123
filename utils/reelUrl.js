const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const INSTAGRAM_CODE = /^[A-Za-z0-9_-]{5,30}$/;

const hostOf = url => url.hostname.replace(/^www\./, "").toLowerCase();

const youtubeIdFrom = url => {
  const host = hostOf(url);
  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] || "";
  }
  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "youtube-nocookie.com") {
    return "";
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") {
    return parts[1] || "";
  }
  return url.searchParams.get("v") || "";
};

const instagramCodeFrom = url => {
  if (hostOf(url) !== "instagram.com") return "";
  const match = url.pathname.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : "";
};

const parseReelUrl = raw => {
  const text = String(raw || "").trim();
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const youtubeId = youtubeIdFrom(url);
  if (YOUTUBE_ID.test(youtubeId)) {
    return {
      platform: "youtube",
      externalId: youtubeId,
      url: `https://www.youtube.com/shorts/${youtubeId}`,
      embedUrl: `https://www.youtube.com/embed/${youtubeId}?playsinline=1&rel=0`,
      thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }

  const instagramCode = instagramCodeFrom(url);
  if (INSTAGRAM_CODE.test(instagramCode)) {
    return {
      platform: "instagram",
      externalId: instagramCode,
      url: `https://www.instagram.com/reel/${instagramCode}/`,
      embedUrl: `https://www.instagram.com/reel/${instagramCode}/embed/captioned/?cr=1&v=14&wp=540`,
      thumbnailUrl: "",
    };
  }

  return {
    platform: "link",
    externalId: "",
    url: url.toString().slice(0, 500),
    embedUrl: url.toString().slice(0, 500),
    thumbnailUrl: "",
  };
};

module.exports = { parseReelUrl };
