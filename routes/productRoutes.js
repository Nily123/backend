const express = require("express");
const pool = require("../config/db");
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../utils/cloudinary');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });
// ../api/products

// 取得所有商品
// GET /products
router.get("/", async (req, res) => {
  try {
    // Step 1：撈出所有商品基本資訊
    const [products] = await pool.execute(
      `
      SELECT products.id, products.name, products.description, products.ingredients, products.is_active,products.special_code,
             vendors.name AS vendor_name,  vendors.id AS vendor_id
      FROM products
      INNER JOIN vendors ON vendors.id = products.vendor_id
      ORDER BY products.id;
      `
    );

    if (products.length === 0) {
      return res.status(404).json({ error: "No products found" });
    }

    // 商品 ID 清單
    const productIds = products.map((p) => p.id);

    // Step 2：撈出所有變體
    const [variants] = await pool.execute(
      `
      SELECT special_code, product_id, capacity, price
      FROM products_variants
      WHERE product_id IN (${productIds.map(() => '?').join(',')});
      `,
      productIds
    );

    // Step 3：撈所有共通圖片
    const [commonImages] = await pool.execute(
      `
      SELECT product_id, image_url, sequence
      FROM product_images_common
      WHERE product_id IN (${productIds.map(() => '?').join(',')})
      ORDER BY product_id, sequence ASC;
      `,
      productIds
    );

    // Step 4：撈所有變體圖片
    const specialCodes = variants.map((v) => v.special_code);
    const [variantImagesRaw] = await pool.execute(
      `
      SELECT special_code, image_url, sequence
      FROM product_images_variants
      WHERE special_code IN (${specialCodes.map(() => '?').join(',')})
      ORDER BY special_code, sequence ASC;
      `,
      specialCodes
    );

    // Step 5：整理資料結構
    const result = products.map((product) => {
      const productVariants = variants.filter(v => v.product_id === product.id);
      const productCommonImages = commonImages
        .filter(img => img.product_id === product.id)
        .map(img => img.image_url);

      const productVariantImages = productVariants.map((variant) => {
        const variantImgs = variantImagesRaw
          .filter(img => img.special_code === variant.special_code)
          .map(img => img.image_url);
        return {
          special_code: variant.special_code,
          images: variantImgs
        };
      });

      return {
        product,
        products_variants: productVariants,
        product_images_common: productCommonImages,
        product_images_variants: productVariantImages
      };
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//所有商品名稱
router.get("/product_name",async(req,res) =>{
  try{
    const [rows] = await pool.execute("select name from products");
    const product_names = rows.map(row => row.name);
    res.status(200).json(product_names);
  }catch(err){
    res.status(500).json({ error : 'fail catch product name'})
  }
});

//全部商品卡
router.get("/all_productcard", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        piv.*,
        p.name AS product_name,
        p.special_code AS special_code0,
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
      WHERE piv.sequence = 1;
    `);

    res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching all product cards:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//New5 商品卡
router.get("/new5", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
      piv.*,                        
      p.name AS product_name,       
      p.special_code as special_code0,
      p.description,
      p.ingredients,
      v.name AS vendor_name,        
      v.website,
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
      WHERE piv.sequence = 1
      order by product_id desc limit 5;
    `);

    res.status(200).json(rows);       
  } catch (err) {
    console.error("Error fetching all product cards:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//熱銷top5商品卡
router.get("/top5", async (req, res) => {
  console.log('0');
  try {
    const [rows] = await pool.execute(`
      SELECT 
        piv.*, 
        p.name AS product_name,
        p.description,
        p.ingredients,
        p.special_code as special_code0,
        v.name AS vendor_name,
        s.total_sold,
      (
          SELECT JSON_ARRAYAGG(JSON_OBJECT('capacity', pv.capacity, 'price', pv.price))
          FROM products_variants pv
          WHERE pv.product_id = p.id
        ) AS variant_prices
      FROM (
          SELECT 
            pv.product_id, 
            MIN(pv.special_code) AS special_code,
            SUM(i.sold) AS total_sold
          FROM inventory i
          LEFT JOIN products_variants pv ON pv.special_code = i.special_code
          GROUP BY pv.product_id
          ORDER BY total_sold DESC
          LIMIT 5
      ) AS s
      JOIN product_images_variants piv
        ON piv.special_code = s.special_code AND piv.sequence = 1
      JOIN products p
        ON piv.product_id = p.id
      JOIN vendors v
        ON p.vendor_id = v.id;
    `);
      console.log('1');
    res.status(200).json(rows);
  } catch (err) {
    console.log('12');
    console.error("Error fetching top 5 products:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST 單一圖片上傳
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: '未提供圖片檔案' });
    }

    // 上傳到 Cloudinary
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'RE', //指定 Cloudinary 資料夾
    });

    // 刪除暫存檔案
    fs.unlinkSync(file.path);

    // 回傳圖片網址
    res.status(200).json({ success: true, url: result.secure_url });
  } catch (err) {
    console.error('Cloudinary 上傳錯誤:', err);
    res.status(500).json({ error: '圖片上傳失敗' });
  }
});

// 上傳商品
router.post("/full", async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const { product, variants, product_images_common, product_images_variants } = req.body;

    // 1. 插入 products 並取得新 ID
    const [productResult] = await conn.execute(
      `INSERT INTO products (name, vendor_id, special_code, description, ingredients, gender, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        product.name,
        product.vendor_id,
        product.special_code,
        product.description,
        product.ingredients,
        product.gender,
        product.is_active,
      ]
    );
    const newProductId = productResult.insertId;

    // 2. 插入變體
    for (const variant of variants) {
      await conn.execute(
        `INSERT INTO products_variants (special_code, product_id, capacity, price)
         VALUES (?, ?, ?, ?)`,
        [variant.special_code, newProductId, variant.capacity, variant.price]
      );
    }

    // 3. 插入共通圖片
    for (const img of product_images_common) {
      await conn.execute(
        `INSERT INTO product_images_common (product_id, image_url, sequence)
         VALUES (?, ?, ?)`,
        [newProductId, img.image_url, img.sequence]
      );
    }

    // 4. 插入變體圖片
    for (const group of product_images_variants) {
      for (const img of group.images) {
        await conn.execute(
          `INSERT INTO product_images_variants (product_id, special_code, image_url, sequence)
           VALUES (?, ?, ?, ?)`,
          [newProductId, group.special_code, img.image_url, img.sequence]
        );
      }
    }

    await conn.commit();
    res.status(200).json({ success: true, product_id: newProductId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "新增商品失敗" });
  } finally {
    conn.release();
  }
});



// 取得特定商品
router.get("/:special_code", async (req, res) => {
  try {
    const specialCode = req.params.special_code;

    // Step 1：從變體查出 product_id
    const [product] = await pool.execute(
      `SELECT products.id, products.name, products.special_code, 
      products.description, products.ingredients, 
      vendors.name as vendor_name, vendors.slug as slug, vendors.id as vendor_id
      FROM products 
      inner join vendors on vendors.id = products.vendor_id
      WHERE special_code = ? ;
      `,
      [specialCode]
    );

    if (!product || product.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const productInfo = product[0];
    const productId = productInfo.id;

    // Step 2：撈出所有變體
    const [variants] = await pool.execute(
      `
      SELECT special_code, capacity, price
      FROM products_variants
      WHERE product_id = ?;
      `,
      [productId]
    );

    // Step 3：撈共通圖片
    const [commonImages] = await pool.execute(
      `
      SELECT image_url
      FROM product_images_common
      WHERE product_id = ?
      ORDER BY sequence ASC;
      `,
      [productId]
    );

    // Step 4：撈每個變體對應的圖片，並標記是對應哪個 special_code
    const variantImagePromises = variants.map((variant) =>
      pool
        .execute(
          `
          SELECT special_code, image_url
          FROM product_images_variants
          WHERE special_code = ?
          ORDER BY sequence ASC;
          `,
          [variant.special_code]
        )
        .then(([rows]) => ({
          special_code: variant.special_code,
          images: rows,
        }))
    );

    const variantImages = await Promise.all(variantImagePromises);

    // Step 5：回傳資料
    res.status(200).json({
      product_info: productInfo,
      products_variants: variants,
      product_images_common: commonImages,
      product_images_variants: variantImages,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 單一商品管理資料
router.get("/:id/full", async (req, res) => {
  const productId = req.params.id;

  try {
    // 1. 查詢商品主資訊
    const [[product]] = await pool.execute(
      `SELECT * FROM products WHERE id = ?`,
      [productId]
    );

    if (!product) {
      return res.status(404).json({ error: "商品不存在" });
    }

    // 2. 查詢所有變體
    const [variants] = await pool.execute(
      `SELECT * FROM products_variants WHERE product_id = ?`,
      [productId]
    );

    // 3. 查詢共通圖片
    const [commonImages] = await pool.execute(
      `SELECT * FROM product_images_common WHERE product_id = ? ORDER BY sequence ASC`,
      [productId]
    );

    // 4. 查詢變體對應的圖片（多筆）
    const variantImagePromises = variants.map((variant) =>
      pool
        .execute(
          `SELECT * FROM product_images_variants WHERE special_code = ? ORDER BY sequence ASC`,
          [variant.special_code]
        )
        .then(([rows]) => ({
          special_code: variant.special_code,
          images: rows,
        }))
    );
    const variantImages = await Promise.all(variantImagePromises);

    // 5. 回傳整合資料
    res.status(200).json({
      product,
      variants,
      product_images_common: commonImages,
      product_images_variants: variantImages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

// 更新商品
router.put("/:id/full", async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const productId = req.params.id;
    const { product, variants, product_images_common, product_images_variants } = req.body;

    // 1. 更新 products
    await conn.execute(
      `UPDATE products SET name = ?, vendor_id = ?, special_code = ?, description = ?, ingredients=?, gender = ?, is_active = ? WHERE id = ?`,
      [
        product.name,
        product.vendor_id,
        product.special_code,
        product.description,
        product.ingredients,
        product.gender,
        product.is_active,
        productId,
      ]
    );

    // 2. 清空原變體與插入新變體（可改成判斷式更新）
    await conn.execute(`DELETE FROM products_variants WHERE product_id = ?`, [productId]);
    for (const variant of variants) {
      await conn.execute(
        `INSERT INTO products_variants (special_code, product_id, capacity, price)
         VALUES (?, ?, ?, ?)`,
        [variant.special_code, productId, variant.capacity, variant.price]
      );
    }

    // 3. 清空與插入共通圖片
    await conn.execute(`DELETE FROM product_images_common WHERE product_id = ?`, [productId]);
    for (const img of product_images_common) {
      await conn.execute(
        `INSERT INTO product_images_common (product_id, image_url, sequence)
         VALUES (?, ?, ?)`,
        [productId, img.image_url, img.sequence]
      );
    }

    // 4. 清空與插入變體圖片
    await conn.execute(`DELETE FROM product_images_variants WHERE product_id = ?`, [productId]);
    for (const group of product_images_variants) {
      for (const img of group.images) {
        await conn.execute(
          `INSERT INTO product_images_variants (product_id, special_code, image_url, sequence)
           VALUES (?, ?, ?, ?)`,
          [productId, group.special_code, img.image_url, img.sequence]
        );
      }
    }

    await conn.commit();
    res.status(200).json({ success: true, product_id: productId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "更新商品失敗" });
  } finally {
    conn.release();
  }
});

//刪除商品
router.delete("/:id/full", async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const productId = req.params.id;

    // 1. 查詢所有變體以取得 special_code
    const [variants] = await conn.execute(
      `SELECT special_code FROM products_variants WHERE product_id = ?`,
      [productId]
    );

    const specialCodes = variants.map((v) => v.special_code);

    // 2. 刪除變體圖片（依 special_code）
    if (specialCodes.length > 0) {
      const placeholders = specialCodes.map(() => "?").join(",");
      await conn.execute(
        `DELETE FROM product_images_variants WHERE special_code IN (${placeholders})`,
        specialCodes
      );
    }

    // 3. 刪除共通圖片
    await conn.execute(`DELETE FROM product_images_common WHERE product_id = ?`, [productId]);

    // 4. 刪除變體
    await conn.execute(`DELETE FROM products_variants WHERE product_id = ?`, [productId]);

    // 5. 刪除主商品
    await conn.execute(`DELETE FROM products WHERE id = ?`, [productId]);

    await conn.commit();
    res.status(200).json({ success: true, message: "商品與相關資料已刪除" });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "刪除商品失敗" });
  } finally {
    conn.release();
  }
});


module.exports = router;
