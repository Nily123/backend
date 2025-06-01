require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// 中介軟體
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// API 路由
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes.js");
const favRoutes = require("./routes/favorite.js");
const cartRoutes = require("./routes/cart.js");
const vendorRoutes =require("./routes/vendor.js");
const orderRoutes = require("./routes/order.js");
const exploreRoutes =require("./routes/explore.js");
const activityRoutes =require("./routes/activity.js");


app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/favorites",favRoutes);
app.use("/api/carts",cartRoutes);
app.use("/api/vendors",vendorRoutes);
app.use("/api/orders",orderRoutes);
app.use("/api/explores",exploreRoutes);
app.use("/api/activities", activityRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
