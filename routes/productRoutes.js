const express = require("express");
const pool = require("../config/db");
const router = express.Router();

// ../api/products

// 取得所有商品
router.get("/", async (req, res) => {
  try {
    const [products] = await pool.execute("SELECT * FROM products");
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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


module.exports = router;
