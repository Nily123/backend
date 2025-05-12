const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware");

// GET /orders - 查詢目前登入使用者的所有訂單
router.get('/', verifyToken, async (req, res) => {
    const user_id = req.user.userId;
  
    try {
      // 查詢使用者所有訂單
      const [orders] = await pool.execute(
        `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
        [user_id]
      );
  
      if (orders.length === 0) {
        return res.json([]);
      }
  
      // 取出所有 order_id
      const orderIds = orders.map(order => order.id);
      
      // 查詢所有訂單商品明細
      const placeholders = orderIds.map(() => '?').join(', ');
      const [items] = await pool.execute(
        `SELECT oi.order_id, oi.special_code, oi.quantity, pv.price, pv.capacity, p.name,
          grouped.image_url, p.special_code as special_code0
         FROM order_items oi
         JOIN products_variants pv ON oi.special_code = pv.special_code
         JOIN products p ON pv.product_id = p.id
         INNER JOIN (
           SELECT special_code, image_url
           FROM product_images_variants
           WHERE sequence = 1
         ) AS grouped ON oi.special_code = grouped.special_code
         WHERE oi.order_id IN (${placeholders});`,
        orderIds
      );
      console.log(items);
      // 將商品依訂單 ID 分組
      const itemsByOrder = orderIds.reduce((acc, id) => {
        acc[id] = items.filter(item => item.order_id === id);
        return acc;
      },{});
  
      // 合併回應格式
      const result = orders.map(order => ({
        ...order,
        items: itemsByOrder[order.id] || []
      }));
  
      res.status(200).json(result);
    } catch (error) {
      console.error('查詢訂單錯誤:', error);
      res.status(500).json({ error: '查詢訂單失敗' });
    }
  });
  module.exports = router;