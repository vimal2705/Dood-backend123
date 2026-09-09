const mongoose = require("mongoose");

const toObjectId = (id) => {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(String(id));
};

module.exports = { toObjectId };
