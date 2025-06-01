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

  router.post("/", async (req, res) => {
    const { name, description, start_date, end_date, coverage } = req.body;
  
    try {
      const [result] = await pool.execute(
        `
        Insert into events (name, description, start_date, end_date, coverage)
        values (?,?,?,?,?)
        `,
        [name, description, start_date, end_date, coverage]
      );
  
      res.status(200).json({ message: "Event add successfully" });
    } catch (err) {
      console.error("Error updating event:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description, start_date, end_date, coverage } = req.body;
  
    try {
      const [result] = await pool.execute(
        `
        UPDATE events 
        SET name = ?, description = ?, start_date = ?, end_date = ?, coverage = ?
        WHERE id = ?
        `,
        [name, description, start_date, end_date, coverage, id]
      );
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Event not found" });
      }
  
      res.status(200).json({ message: "Event updated successfully" });
    } catch (err) {
      console.error("Error updating event:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
  
    try {
      const [result] = await pool.execute(`DELETE FROM events WHERE id = ?`, [id]);
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Event not found" });
      }
  
      res.status(200).json({ message: "Event deleted successfully" });
    } catch (err) {
      console.error("Error deleting event:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  module.exports = router;