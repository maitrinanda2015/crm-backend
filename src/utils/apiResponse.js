const sendResponse = (res, statusCode, message, data = null, meta = undefined) => {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  if (meta) body.meta = meta; // pagination info
  return res.status(statusCode).json(body);
};

module.exports = sendResponse;