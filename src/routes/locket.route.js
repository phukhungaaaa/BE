const Router = require("express");
const router = Router();
const locketController = require("../controllers/locket.controller.js");

// Middleware để upload media
const handleUpload = require("../middlewares/multipart-upload-support.middleware.js");
const MAX_IMAGE_COUNT = 1;
const MAX_VIDEO_COUNT = 1;

// Route login
router.post("/login", locketController.login);

// Route upload media
router.post(
    "/upload-media",
    handleUpload(MAX_IMAGE_COUNT, MAX_VIDEO_COUNT),
    locketController.uploadMedia
);

// Route ping
router.get("/ping", (req, res) => {
    res.status(200).send("pong");
});

// Route forgot password
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    // Kiểm tra email hợp lệ
    if (!email || !validateEmail(email)) {
        return res.status(400).json({ message: "Vui lòng nhập email hợp lệ để đặt lại mật khẩu" });
    }

    try {
        // Gửi yêu cầu đặt lại mật khẩu tới API của Locket
        const response = await fetch(
            `${process.env.REACT_APP_PASSWORD_RESET_URL}?key=${process.env.REACT_APP_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requestType: "PASSWORD_RESET",
                    email: email,
                }),
            }
        );

        if (response.ok) {
            return res.status(200).json({
                message: "Liên kết đặt lại mật khẩu đã được gửi, vui lòng kiểm tra email của bạn.",
            });
        } else {
            return res.status(404).json({ message: "Email này chưa đăng ký tài khoản Locket nào!" });
        }
    } catch (error) {
        return res.status(500).json({ message: "Đã xảy ra lỗi khi gửi yêu cầu đặt lại mật khẩu." });
    }
});

module.exports = router;