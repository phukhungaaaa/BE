const express = require("express");
const multer = require("multer");
const router = express.Router();
const locketService = require("./locketService");

// Thiết lập multer để xử lý file uploads
const upload = multer({ dest: "uploads/" }); // Thư mục tạm để lưu file uploads

// Route đăng nhập
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const userData = await locketService.login(email, password);
        res.json(userData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route đăng bài hình ảnh
router.post("/post-image", upload.single("image"), async (req, res) => {
    const { userId, idToken, caption, topBgColor, bottomBgColor, textColor } = req.body;
    const image = req.file; // Nhận file hình ảnh từ request
    try {
        await locketService.postImage(userId, idToken, image, caption, topBgColor, bottomBgColor, textColor);
        res.status(200).send("Image posted successfully");
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route đăng bài video
router.post("/post-video", upload.single("video"), async (req, res) => {
    const { userId, idToken, caption, topBgColor, bottomBgColor, textColor } = req.body;
    const video = req.file; // Nhận file video từ request
    try {
        await locketService.postVideo(userId, idToken, video, caption, topBgColor, bottomBgColor, textColor);
        res.status(200).send("Video posted successfully");
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Xuất router để sử dụng trong file chính
module.exports = router;
