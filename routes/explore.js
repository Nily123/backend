const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware");

router.post('/', async (req, res) => {
    const { special_code } = req.body;
  
    if (!Array.isArray(special_code) || special_code.length === 0) {
      return res.status(400).json({ error: 'Invalid special_code array' });
    }
    
    try {
      const placeholders = special_code.map(() => '?').join(',');
  
      const query = `
        SELECT 
          piv.*,                        
          p.name AS product_name,
          p.special_code as special_code0,       
          p.description,
          p.ingredients,
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
        WHERE piv.sequence = 1 AND p.special_code IN (${placeholders});
      `;
  
      const [rows] = await pool.execute(query, special_code);
      res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'fetch explore product' });
    }
  });
  

module.exports = router;