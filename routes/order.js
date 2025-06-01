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

  // GET /orders - 查詢所有使用者的訂單（後台）
router.get('/all_orders', async (req, res) => {
  try {
    // 查詢所有訂單，並聯結 user 資訊
    const [orders] = await pool.execute(
      `SELECT o.*, u.username, u.email, u.phone
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );

    if (orders.length === 0) {
      return res.json([]);
    }

    // 撈出所有訂單 ID
    const orderIds = orders.map(order => order.id);
    const placeholders = orderIds.map(() => '?').join(', ');

    // 查詢所有訂單的商品明細
    const [items] = await pool.execute(
      `SELECT oi.order_id, oi.special_code, oi.quantity,
              pv.price, pv.capacity, p.name,
              grouped.image_url, p.special_code AS special_code0
       FROM order_items oi
       JOIN products_variants pv ON oi.special_code = pv.special_code
       JOIN products p ON pv.product_id = p.id
       JOIN (
         SELECT special_code, image_url
         FROM product_images_variants
         WHERE sequence = 1
       ) AS grouped ON oi.special_code = grouped.special_code
       WHERE oi.order_id IN (${placeholders});`,
      orderIds
    );

    // 將商品依訂單分組
    const itemsByOrder = orderIds.reduce((acc, id) => {
      acc[id] = items.filter(item => item.order_id === id);
      return acc;
    }, {});

    // 合併商品資料
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

// PUT /orders/:id - 更新指定訂單
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    ship_way,
    ship_info,
    ship_cost,
    discount,
    total_price,
    status
  } = req.body;

  try {
    const [result] = await pool.execute(
      `UPDATE orders 
       SET ship_way = ?, 
           ship_info = ?, 
           ship_cost = ?, 
           discount = ?, 
           total_price = ?, 
           status = ? 
       WHERE id = ?`,
      [ship_way, ship_info, ship_cost, discount, total_price, status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '訂單不存在' });
    }

    res.status(200).json({ message: '訂單已更新' });
  } catch (error) {
    console.error('更新訂單錯誤:', error);
    res.status(500).json({ error: '訂單更新失敗' });
  }
});

// DELETE /orders/:id - 刪除訂單及明細
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 先刪除 order_items 中對應的資料
    await connection.execute(
      `DELETE FROM order_items WHERE order_id = ?`,
      [id]
    );

    // 再刪除 orders 主表中的訂單
    const [result] = await connection.execute(
      `DELETE FROM orders WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '訂單不存在' });
    }

    await connection.commit();
    res.status(200).json({ message: '訂單與明細已刪除' });
  } catch (error) {
    await connection.rollback();
    console.error('刪除訂單錯誤:', error);
    res.status(500).json({ error: '刪除失敗' });
  } finally {
    connection.release();
  }
});

  module.exports = router;