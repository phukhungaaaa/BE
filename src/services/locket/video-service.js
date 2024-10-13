const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const { logInfo, logError } = require("../logger.service.js");
const { createFolderIfNotExist } = require("../../helpers/utils.js");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const unlinkFile = (filePath) => {
    fs.unlink(filePath, (err) => {
        if (err) {
            logError("unlinkFile", err);
        }
    });
};

const thumbnailData = async (
    videoPath,
    imageFormat = "jpeg",
    maxWidth = 640,
    quality = 75
) => {
    return new Promise((resolve, reject) => {
        try {
            createFolderIfNotExist(path.join(__dirname, "thumbnails"));
            const tempFilePath = path.join(
                __dirname,
                "thumbnails",
                `thumbnail_${Date.now()}.${imageFormat}`
            );

            ffmpeg(videoPath)
                .on("end", () => {
                    fs.readFile(tempFilePath, (err, data) => {
                        if (err) {
                            logError("thumbnailData", err);
                            reject(err);
                        }

                        // Xoá file tạm sau khi đọc xong
                        unlinkFile(tempFilePath);

                        logInfo(
                            "thumbnailData",
                            "Thumbnail created successfully"
                        );
                        resolve(data);
                    });
                })
                .on("error", (err) => {
                    logError("thumbnailData", err);
                    reject(err);
                })
                .screenshots({
                    timestamps: ["50%"],
                    filename: path.basename(tempFilePath),
                    folder: path.join(__dirname, "thumbnails"),
                    size: `${maxWidth}x?`,
                    quality: quality,
                });
        } catch (e) {
            logError("thumbnailData", e);
            reject(e);
        }
    });
};

// Hàm này sẽ trả về thumbnail dưới dạng buffer
const getThumbnail = async (videoPath) => {
    try {
        const thumbnailBuffer = await thumbnailData(videoPath);
        return thumbnailBuffer; // Trả về buffer của thumbnail
    } catch (error) {
        logError("getThumbnail", error);
        throw error;
    }
};

module.exports = {
    thumbnailData,
    getThumbnail, // Xuất khẩu hàm getThumbnail
};
