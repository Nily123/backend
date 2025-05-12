const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
    try {
      const [rows] = await pool.execute(`SELECT * FROM events`);
      res.status(200).json(rows);
    } catch (err) {
      console.error("Error fetching events:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  module.exports = router;