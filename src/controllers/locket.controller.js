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
            const { userId, idToken, caption, topColor, bottomColor, textColor } = req.body;
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

            const captionColors = {
                topColor: topColor || '#FFFFFF',   // Mặc định nếu không có màu thì dùng màu trắng
                bottomColor: bottomColor || '#FFFFFF',
                textColor: textColor || '#000000'  // Mặc định màu chữ là đen
            };

            if (images) {
                await locketService.postImage(
                    userId,
                    idToken,
                    images[0],
                    caption,
                    captionColors // Truyền các màu sắc caption vào service
                );
            } else {
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
                    captionColors // Truyền các màu sắc caption vào service
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
