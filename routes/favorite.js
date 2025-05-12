const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET 使用者收藏的商品卡
router.get("/product_card/:userid",async(req,res) =>{
    const id = req.params.userid;
    try{
        const [fav] = await pool.query(
            `
            select * 
            from favorites inner join(SELECT 
              piv.*,                        
              p.name AS product_name,
              p.special_code as special_code0,       
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
            WHERE piv.sequence = 1 )AS fav_products 
            ON favorites.product_id = fav_products.product_id
            where user_id = ?;
            `,[id]
        );
        res.status(200).json(fav);
    }catch(err){
        res.status(500).json("fail get fav pro card!")
    }
});



// POST: 加入收藏
router.post("/", async (req, res) => {
  const { user_id, product_id } = req.body;

  try {
    await pool.execute(
      `INSERT IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)`,
      [user_id, product_id]
    );

    res.status(200).json({ message: "Product added to favorites" });
  } catch (err) {
    console.error("Error adding to favorites:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE: 移除收藏
router.delete("/", async (req, res) => {
    const { user_id, product_id } = req.query;

  try {
    await pool.execute(
      `DELETE FROM favorites WHERE user_id = ? AND product_id = ?`,
      [user_id, product_id]
    );

    res.status(200).json({ message: "Product removed from favorites" });
  } catch (err) {
    console.error("Error removing from favorites:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET: 取得某使用者收藏的商品 IDs /api/favorites/:id
router.get("/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const [rows] = await pool.execute(
      `SELECT product_id FROM favorites WHERE user_id = ?`,
      [userId]
    );

    const productIds = rows.map(row => row.product_id);

    res.status(200).json({
      user_id: userId,
      product_id: productIds
    });
  } catch (err) {
    console.error("Error fetching favorites:", err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;