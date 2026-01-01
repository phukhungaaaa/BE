const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const axios = require("axios");
const envFile =
    process.env.NODE_ENV === "production"
        ? ".env.production"
        : ".env.development";

dotenv.config({ path: envFile });

const cors = require("cors");
const { logInfo } = require("./src/services/logger.service.js");

// Routers
const routes = require("./src/routes");
const errorHandler = require("./src/helpers/error-handler.js");

const app = express();
app.use(
    cors({
        origin: ["http://localhost:10000", "https://luckit-api.onrender.com"],
        methods: ["GET", "POST"],

        // Nhằm cho phép client gửi cookie lên server
        credentials: true,
    })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Nạp các route vào ứng dụng
routes(app);

// Middleware xử lý lỗi
app.use(errorHandler);

const PORT = process.env.PORT;

app.listen(PORT, () => {
    logInfo("main.js", `Server backend is running at localhost:${PORT}`);
});

// Ping server mỗi 5 phút
setInterval(() => {
    axios.get(`https://luckit-api.onrender.com/locket/ping`, { timeout: 10000 }) // 10 giây timeout
        .then(() => {
            logInfo("Ping", `Pinged server at localhost:${PORT}/locket/ping`);
        })
        .catch((error) => {
            console.error("Ping failed:", error.message);
        });
}, 300000); // 5 phút (300,000 ms)
