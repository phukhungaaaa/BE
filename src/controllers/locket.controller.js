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
            const { userId, idToken, caption, topBgColor, bottomBgColor, textColor } = req.body; // Nhận các tham số màu sắc
            const { images, videos } = req.files;

            // Kiểm tra xem có media nào không
            if (!images && !videos) {
                return res.status(400).json({
                    message: "No media found",
                });
            }

            // Kiểm tra xem chỉ cho phép một loại media
            if (images && videos) {
                return res.status(400).json({
                    message: "Only one type of media is allowed",
                });
            }

            // Xử lý upload hình ảnh
            if (images) {
                await locketService.postImage(
                    userId,
                    idToken,
                    images[0],
                    caption,
                    topBgColor,    // Gửi màu sắc
                    bottomBgColor, // Gửi màu sắc
                    textColor      // Gửi màu sắc
                );
            } else {
                // Xử lý upload video với giới hạn kích thước
                if (videos[0].size > 10 * 1024 * 1024) {
                    return res.status(400).json({
                        message: "Video size exceeds 10MB",
                    });
                }

                await locketService.postVideo(
                    userId,
                    idToken,
                    videos[0],
                    caption,
                    topBgColor,    // Gửi màu sắc
                    bottomBgColor, // Gửi màu sắc
                    textColor      // Gửi màu sắc
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
