const locketService = require("../services/locket/locket-service.js");

class LocketController {
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const user = await locketService.login(email, password);
            return res.status(200).json({ user });
        } catch (error) {
            next(error);
        }
    }

    async uploadMedia(req, res, next) {
        try {
            const { userId, idToken, caption, topBgColor, bottomBgColor, textColor } = req.body;  // Nhận thêm màu từ request
            const { images, videos } = req.files;

            if (!images && !videos) {
                return res.status(400).json({
                    message: "No media found",
                });
            }

            if (images && videos) {
                return res.status(400).json({
                    message: "Only one type of media is allowed",
                });
            }

            if (images) {
                // Gửi màu sắc cùng với hình ảnh đến locketService
                await locketService.postImage(
                    userId,
                    idToken,
                    images[0],
                    caption,
                    topBgColor,      // Gửi thêm màu nền phần trên
                    bottomBgColor,   // Gửi thêm màu nền phần dưới
                    textColor        // Gửi thêm màu chữ
                );
            } else {
                if (videos[0].size > 10 * 1024 * 1024) {
                    return res.status(400).json({
                        message: "Video size exceeds 10MB",
                    });
                }

                // Gửi màu sắc cùng với video đến locketService
                await locketService.postVideo(
                    userId,
                    idToken,
                    videos[0],
                    caption,
                    topBgColor,      // Gửi thêm màu nền phần trên
                    bottomBgColor,   // Gửi thêm màu nền phần dưới
                    textColor        // Gửi thêm màu chữ
                );
            }

            return res.status(200).json({
                message: "Upload media successfully",
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new LocketController();
