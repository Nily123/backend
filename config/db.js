const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.PB_DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// 測試連線
pool.getConnection()
  .then((conn) => {
    console.log("✅ Database connected!");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err);
  });

module.exports = pool;
