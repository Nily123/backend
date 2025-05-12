const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET: /api/vendors/all
router.get("/all", async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM vendors`);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching vendors:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// input查詢用
router.get("/vendor_name", async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT name FROM vendors`);
    res.status(200).json(rows.map(row => row.name));
  } catch (err) {
    console.error("Error fetching vendors:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 單一品牌的商品資訊
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT 
        piv.*,                       
        p.name AS product_name,
        p.description,
        p.ingredients,
        v.id as vendor_id  ,
        v.name AS vendor_name,
      (
          SELECT JSON_ARRAYAGG(JSON_OBJECT('capacity', pv.capacity, 'price', pv.price))
          FROM products_variants pv
          WHERE pv.product_id = p.id
        ) AS variant_prices       
       FROM product_images_variants piv
       INNER JOIN (
           SELECT product_id, MIN(special_code) AS first_special_code
           FROM product_images_variants
           WHERE sequence = 1
           GROUP BY product_id
       ) AS grouped
        ON piv.product_id = grouped.product_id
        AND piv.special_code = grouped.first_special_code
       LEFT JOIN products p
        ON piv.product_id = p.id
       LEFT JOIN vendors v
        ON p.vendor_id = v.id
       WHERE piv.sequence = 1 and v.id =?;`,
       [req.params.id]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching vendor_ids:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
