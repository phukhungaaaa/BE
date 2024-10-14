const express = require("express");
const multer = require("multer");
const {
    login,
    postImage,
    postVideo,
} = require("./locketService.js");

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // Dùng multer để tải lên tạm thời

// Đăng nhập
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const userData = await login(email, password);
        res.json(userData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Tải lên ảnh
router.post("/upload/image", upload.single("image"), async (req, res) => {
    try {
        const { userId, idToken, caption, topBgColor, bottomBgColor, textColor } = req.body;
        const image = req.file;

        if (!image) {
            return res.status(400).json({ message: "Image file is required" });
        }

        await postImage(userId, idToken, image, caption, topBgColor, bottomBgColor, textColor);
        res.status(201).json({ message: "Image uploaded successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Tải lên video
router.post("/upload/video", upload.single("video"), async (req, res) => {
    try {
        const { userId, idToken, caption, topBgColor, bottomBgColor, textColor } = req.body;
        const video = req.file;

        if (!video) {
            return res.status(400).json({ message: "Video file is required" });
        }

        await postVideo(userId, idToken, video, caption, topBgColor, bottomBgColor, textColor);
        res.status(201).json({ message: "Video uploaded successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
