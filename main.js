const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const envFile =
    process.env.NODE_ENV === "production"
        ? ".env.production"
        : ".env.development";

dotenv.config({ path: envFile });

const fetch = require("node-fetch"); // Dùng để gửi yêu cầu HTTP
const cors = require("cors");
const { logInfo } = require("./src/services/logger.service.js");

// Routers
const routes = require("./src/routes");
const errorHandler = require("./src/helpers/error-handler.js");

const app = express();
app.use(
    cors({
        origin: ["http://localhost:10000", "https://locket.pw"],
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
    // Ping server mỗi 5 phút để giữ cho nó không bị "ngủ"
    setInterval(() => {
        fetch(`http://localhost:${PORT}`)
            .then(res => logInfo("main.js", `Ping result: ${res.status}`))
            .catch(err => logInfo("main.js", `Ping error: ${err.message}`));
    }, 5 * 60 * 1000); // 5 phút
});