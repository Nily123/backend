const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const verifyToken = require("../middleware");
const router = express.Router();
const dayjs = require ('dayjs');

//驗證
router.post("/vertify",async(req,res) =>{
  const {val_email ,val_phone } =req.body;
  try{
    let email_res = false;
    let phone_res = false;
    if(val_email == "0000"){
      email_res =true;
    }
    if(val_phone == "0000"){
      phone_res =true;
    }
    res.status(200).json({email_res:email_res, phone_res:phone_res});
  }catch(err){
    res.status(500).json({ error: err.message });
  }
});


// 註冊
router.post("/register", async (req, res) => {
  const { username, account_name, password, email, phone } = req.body;
  try {
    const [result] = await pool.execute(
      `
      INSERT INTO users (username ,account_name, password, email, phone) 
      VALUES (?,?,?,?,?)
      `,
      [username, account_name, password, email, phone]
    );
    const userId = result.insertId;
    await pool.execute(
      `
      INSERT INTO users_roles (user_id, role_id)
      VALUES (?, 1)
      `,
      [userId]
    );
    res.status(200).json({ message: "User registered", success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 登入
router.post("/login", async (req, res) => {
  const { account_name, password } = req.body;

  try {
    const [rows] = await pool.execute(
      `
      SELECT * FROM users 
      LEFT JOIN users_roles ON users.id = users_roles.user_id 
      LEFT JOIN roles ON users_roles.role_id = roles.id 
      WHERE account_name = ?
      `,
      [account_name]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const user = rows[0];

    // ✅ 檢查是否帳號被鎖定
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      const unlockTime = dayjs(user.account_locked_until).format('YYYY-MM-DD HH:mm:ss');
      return res.status(403).json({ success: false, message: `帳號已鎖定至 ${unlockTime}` });
    }

    // ✅ 驗證密碼
    const isMatch = password === user.password;

    if (!isMatch) {
      const now = new Date();
      let failCount = user.login_fail_count || 0;
      let lastFailTime = user.last_login_fail_time ? new Date(user.last_login_fail_time) : null;

      // 如果10分鐘前錯誤過，就重置計數
      if (!lastFailTime || now.getTime() - lastFailTime.getTime() > 10 * 60 * 1000) {
        failCount = 1;
      } else {
        failCount += 1;
      }

      const updates = [`login_fail_count = ?`, `last_login_fail_time = ?`];
      const values = [failCount, now];

      // 如果超過3次就鎖定
      if (failCount >= 3) {
        const lockUntil = new Date(now.getTime() + 10 * 60 * 1000); // 鎖定10分鐘
        updates.push(`account_locked_until = ?`);
        values.push(lockUntil);
      }

      values.push(user.user_id);
      await pool.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // ✅ 成功登入時重置錯誤計數
    await pool.execute(
      `UPDATE users SET login_fail_count = 0, last_login_fail_time = NULL, account_locked_until = NULL WHERE id = ?`,
      [user.user_id]
    );

    // 🔐 建立 token
    const token = jwt.sign(
      { userId: user.user_id, role: user.role_name },
      process.env.JWT_SECRET,
      { expiresIn: "72h" }
    );

    const [favorites] = await pool.query(
      "SELECT product_id FROM favorites WHERE user_id = ?",
      [user.user_id]
    );
    const [carts] = await pool.query(
      `
      SELECT ci.special_code
      FROM carts c
      JOIN cart_items ci ON c.id = ci.cart_id
      WHERE c.user_id = ?
      `,
      [user.user_id]
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role_name,
        phone :user.phone,
        token: token,
        favorites: favorites.map((f) => f.product_id),
        carts: carts
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});


// 修改使用者資訊
router.put('/update', async (req, res) => {
  const { id, username, email, password ,phone } = req.body;
  console.log(req.body);

  if (!id || !username || !email ||!phone) {
    return res.status(400).json({ message: '缺少必要欄位' });
  }

  try {
    let sql = `UPDATE users SET username = ?, email = ?, phone =?`;
    const params = [username, email, phone];

    if (password) {
      // 如果有提供新密碼，順便更新
      sql += `, password = ?`;
      params.push(password);
    }

    sql += ` WHERE id = ?`;
    params.push(id);

    const [put] = await pool.query(sql, params);

    return res.status(200).json({ message: '更新成功' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: '更新失敗' });
  }
});

router.get("/all_user", async (req, res) => {
  try {
    const [user] = await pool.execute(
      `
      SELECT * FROM users 
      LEFT JOIN users_roles ON users.id = users_roles.user_id 
      LEFT JOIN roles ON users_roles.role_id = roles.id 
      `);

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Express route（例如 routes/user.ts）
router.get("/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const [user] = await pool.execute(
      `
      SELECT * FROM users 
      LEFT JOIN users_roles ON users.id = users_roles.user_id 
      LEFT JOIN roles ON users_roles.role_id = roles.id 
      WHERE users.id = ?
      `,
      [userId]);
    
    const [favorites] = await pool.query(
      "SELECT product_id FROM favorites WHERE user_id = ?",
      [userId]
    );
    const [carts] = await pool.query(
      `
      SELECT ci.special_code , ci.quantity
      FROM carts c
      JOIN cart_items ci ON c.id = ci.cart_id
      WHERE c.user_id = ?
    `,
      [userId]
    );

    if (!user.length)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      id: user[0].user_id,
      username: user[0].username,
      email: user[0].email,
      role: user[0].role,
      favorites: favorites.map((f) => f.product_id),
      carts: carts
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

module.exports = router;
