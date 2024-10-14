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
            const { userId, idToken, caption, topBgColor, bottomBgColor, textColor } = req.body; // Nhận thông tin màu sắc
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
                // Gọi đến locketService với màu sắc
                await locketService.postImage(
                    userId,
                    idToken,
                    images[0],
                    caption,
                    topBgColor, // Truyền màu sắc cho postImage
                    bottomBgColor,
                    textColor
                );
            } else {
                if (videos[0].size > 10 * 1024 * 1024) { // Kiểm tra kích thước video
                    return res.status(400).json({
                        message: "Video size exceeds 10MB",
                    });
                }

                // Gọi đến locketService với màu sắc
                await locketService.postVideo(
                    userId,
                    idToken,
                    videos[0],
                    caption,
                    topBgColor, // Truyền màu sắc cho postVideo
                    bottomBgColor,
                    textColor
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
