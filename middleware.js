const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Access Denied: No Token Provided" });
  }

  const token = authHeader.split(" ")[1]; // 取得 JWT
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    req.user = decoded; // 把解碼後的 user 資訊存入 req 物件，方便後續使用
    next();
  } catch (err) {
    console.error('JWT verify error:', err.name, err.message);
    return res.status(403).json({ success: false, message: "Invalid or Expired Token" });
  }
};

module.exports = verifyToken;