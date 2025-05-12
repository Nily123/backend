const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware");

// post 結帳
router.post('/check', verifyToken, async (req, res) => {
    const userId = req.user.userId // 假設你從 token 中解析出 user id
    const {
      product_list,
      total,
      ship,
      ship_info,
      ship_cost,
      discount
    } = req.body
  
    try {
      // 1. 新增一筆訂單到 orders 表
      const [orderResult] = await pool.execute(
        `INSERT INTO orders (user_id, total_price, ship_way, ship_info, ship_cost, discount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, total, ship, ship_info, ship_cost, discount]
      )
      const orderId = (orderResult).insertId
  
      // 2. 新增多筆 order_items
      const itemInsertPromises = product_list.map(item => {
        return pool.execute(
          `INSERT INTO order_items (order_id, special_code, quantity)
           VALUES (?, ?, ?)`,
          [orderId, item.special_code, item.number]
        )
      })
  
      await Promise.all(itemInsertPromises)

      res.status(200).json({ message: 'Order created successfully', orderId })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Failed to create order' })}
  })

// GET /api/carts/:userId 查詢
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
      const [cartRows] = await pool.execute(
        'SELECT id FROM carts WHERE user_id = ?',
        [userId]
      );
  
      if (cartRows.length === 0) {
        return res.status(404).json({ message: 'Cart not found for user' });
      }
  
      const cartId = cartRows[0].id;
  
      const [items] = await pool.execute(
        `SELECT ci.id, ci.special_code, ci.quantity,
                 pv.product_id, pv.capacity, pv.price,
                 grouped.image_url, p.name, p.special_code AS special_code0
          FROM cart_items ci
          INNER JOIN (
              SELECT special_code, image_url
              FROM product_images_variants
              WHERE sequence = 1
          ) AS grouped
          ON ci.special_code = grouped.special_code
          JOIN products_variants pv ON ci.special_code = pv.special_code 
          JOIN products p ON p.id = pv.product_id
          WHERE ci.cart_id = ?;
        `,
        [cartId]
      );
  
      res.json({
        user_id: userId,
        cart_id: cartId,
        carts: items,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
// POST /api/carts 新增
router.post('/', async (req, res) => {
    const { user_id, special_code, quantity } = req.body;
  
    try {
      // 找到或建立該使用者的 cart
      let [cartRows] = await pool.execute(
        'SELECT id FROM carts WHERE user_id = ?',
        [user_id]
      );
  
      let cart_id;
      if (cartRows.length === 0) {
        const [result] = await pool.execute(
          'INSERT INTO carts (user_id) VALUES (?)',
          [user_id]
        );
        cart_id = result.insertId;
      } else {
        cart_id = cartRows[0].id;
      }
  
      // 檢查是否已有該商品於購物車
      const [existing] = await pool.execute(
        'SELECT id FROM cart_items WHERE cart_id = ? AND special_code = ?',
        [cart_id, special_code]
      );
  
      if (existing.length > 0) {
        // 若已存在，則更新數量
        await pool.execute(
          'UPDATE cart_items SET quantity = quantity + ? WHERE cart_id = ? AND special_code = ?',
          [quantity, cart_id, special_code]
        );
      } else {
        // 否則新增
        await pool.execute(
          'INSERT INTO cart_items (cart_id, special_code, quantity) VALUES (?, ?, ?)',
          [cart_id, special_code, quantity]
        );
      }
  
      res.status(200).json({ message: 'Item added to cart' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/carts 刪除
router.delete('/', async (req, res) => {
    const { user_id, special_code } = req.body;
  
    try {
      const [cartRows] = await pool.execute(
        'SELECT id FROM carts WHERE user_id = ?',
        [user_id]
      );
  
      if (cartRows.length === 0) {
        return res.status(404).json({ message: 'Cart not found for user' });
      }
  
      const cart_id = cartRows[0].id;
  
      const [result] = await pool.execute(
        'DELETE FROM cart_items WHERE cart_id = ? AND special_code = ?',
        [cart_id, special_code]
      );
  
      res.status(200).json({ message: 'Item removed from cart' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  module.exports = router;

  