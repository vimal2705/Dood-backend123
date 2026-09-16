const sanitizePoints = (points) => {
  if (!Array.isArray(points)) return undefined;
  return points
    .map((point) => String(point || "").trim())
    .filter(Boolean)
    .slice(0, 12);
};

module.exports = { sanitizePoints };
