const constants = require("./constants");
const fs = require("fs");
const { logInfo, logError } = require("../logger.service.js");
const crypto = require("crypto");

const videoService = require("./video-service.js");
const { decryptLoginData } = require("./security-service.js");

const login = async (email, password) => {
    logInfo("login Locket", "Start");
    const { decryptedEmail, decryptedPassword } = decryptLoginData(
        email,
        password
    );

    const requestData = JSON.stringify({
        email: decryptedEmail,
        password: decryptedPassword,
        returnSecureToken: true,
        clientType: "CLIENT_TYPE_IOS",
    });

    try {
        const response = await fetch(constants.LOGIN_URL, {
            method: "POST",
            headers: constants.LOGIN_HEADERS,
            body: requestData,
        });

        if (!response.ok) {
            throw new Error(`Login failed: ${response.statusText}`);
        }

        const data = await response.json();

        logInfo("login Locket", "End");
        return data;
    } catch (error) {
        logError("login Locket", error.message);
        throw error;
    }
};

//#region Image handlers

const uploadImageToFirebaseStorage = async (userId, idToken, image) => {
    try {
        logInfo("uploadImageToFirebaseStorage", "Start");
        const imageName = `${Date.now()}_vtd182.webp`;

        const url = `https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2F${userId}%2Fmoments%2Fthumbnails%2F${imageName}?uploadType=resumable&name=users%2F${userId}%2Fmoments%2Fthumbnails%2F${imageName}`;
        const initHeaders = {
            "content-type": "application/json; charset=UTF-8",
            authorization: `Bearer ${idToken}`,
            "x-goog-upload-protocol": "resumable",
            accept: "*/*",
            "x-goog-upload-command": "start",
            "x-goog-upload-content-length": `${image.size || image.length}`,
            "accept-language": "vi-VN,vi;q=0.9",
            "x-firebase-storage-version": "ios/10.13.0",
            "user-agent":
                "com.locket.Locket/1.43.1 iPhone/17.3 hw/iPhone15_3 (GTMSUF/1)",
            "x-goog-upload-content-type": "image/webp",
            "x-firebase-gmpid": "1:641029076083:ios:cc8eb46290d69b234fa609",
        };

        const data = JSON.stringify({
            name: `users/${userId}/moments/thumbnails/${imageName}`,
            contentType: "image/*",
            bucket: "",
            metadata: { creator: userId, visibility: "private" },
        });

        const response = await fetch(url, {
            method: "POST",
            headers: initHeaders,
            body: data,
        });

        if (!response.ok) {
            throw new Error(`Failed to start upload: ${response.statusText}`);
        }

        const uploadUrl = response.headers.get("X-Goog-Upload-URL");

        let imageBuffer;
        if (image instanceof Buffer) {
            imageBuffer = image;
        } else {
            imageBuffer = fs.readFileSync(image.path);
        }

        let uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: constants.UPLOADER_HEADERS,
            body: imageBuffer,
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
        }

        const getUrl = `https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2F${userId}%2Fmoments%2Fthumbnails%2F${imageName}`;
        const getHeaders = {
            "content-type": "application/json; charset=UTF-8",
            authorization: `Bearer ${idToken}`,
        };

        const getResponse = await fetch(getUrl, {
            method: "GET",
            headers: getHeaders,
        });

        if (!getResponse.ok) {
            throw new Error(`Failed to get download token: ${getResponse.statusText}`);
        }

        const downloadToken = (await getResponse.json()).downloadTokens;
        logInfo("uploadImageToFirebaseStorage", "End");

        return `${getUrl}?alt=media&token=${downloadToken}`;
    } catch (error) {
        logError("uploadImageToFirebaseStorage", error.message);
        throw error;
    } finally {
        if (image.path) {
            fs.unlinkSync(image.path);
        }
    }
};

const postImage = async (userId, idToken, image, caption, textColor, upperBackgroundColor, lowerBackgroundColor) => {
    try {
        logInfo("postImage", "Start");
        const imageUrl = await uploadImageToFirebaseStorage(userId, idToken, image);

        const postHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
        };

        const postData = JSON.stringify({
            data: {
                thumbnail_url: imageUrl,
                caption: caption,
                sent_to_all: true,
                overlays: [
                    {
                        data: {
                            text: caption,
                            text_color: textColor,
                            type: "standard",
                            max_lines: {
                                "@type": "type.googleapis.com/google.protobuf.Int64Value",
                                value: "4",
                            },
                            background: {
                                material_blur: "ultra_thin",
                                colors: [upperBackgroundColor, lowerBackgroundColor], // Sử dụng cả hai màu nền
                            },
                        },
                        alt_text: caption,
                        overlay_id: "caption:standard",
                        overlay_type: "caption",
                    },
                ],
            },
        });

        const postResponse = await fetch(constants.CREATE_POST_URL, {
            method: "POST",
            headers: postHeaders,
            body: postData,
        });

        if (!postResponse.ok) {
            throw new Error(`Failed to create post: ${postResponse.statusText}`);
        }

        logInfo("postImage", "End");
    } catch (error) {
        logError("postImage", error.message);
        throw error;
    }
};

//#endregion

//#region Video handlers
const getMd5Hash = (str) => {
    return crypto.createHash("md5").update(str).digest("hex");
};

const uploadThumbnailFromVideo = async (userId, idToken, video) => {
    try {
        const thumbnailBytes = await videoService.thumbnailData(
            video.path,
            "jpeg",
            128,
            75
        );

        return await uploadImageToFirebaseStorage(userId, idToken, thumbnailBytes);
    } catch (error) {
        logError("uploadThumbnailFromVideo", error.message);
        return null;
    }
};

const uploadVideoToFirebaseStorage = async (userId, idToken, video) => {
    try {
        const videoName = `${Date.now()}_vtd182.mp4`;
        const videoBuffer = fs.readFileSync(video.path); // Đọc file video

        const url = `https://firebasestorage.googleapis.com/v0/b/locket-video/o/users%2F${userId}%2Fmoments%2Fvideos%2F${videoName}?uploadType=resumable&name=users%2F${userId}%2Fmoments%2Fvideos%2F${videoName}`;

        const initHeaders = {
            "content-type": "application/json; charset=UTF-8",
            authorization: `Bearer ${idToken}`,
            "x-goog-upload-protocol": "resumable",
            "x-goog-upload-content-length": `${videoBuffer.length}`,
            "x-firebase-gmpid": "1:641029076083:ios:cc8eb46290d69b234fa609",
            "user-agent":
                "com.locket.Locket/1.43.1 iPhone/17.3 hw/iPhone15_3 (GTMSUF/1)",
        };

        const requestData = JSON.stringify({
            name: `users/${userId}/moments/videos/${videoName}`,
            contentType: "video/mp4",
            metadata: {
                creator: userId,
                visibility: "private",
            },
        });

        // Bắt đầu upload
        const response = await fetch(url, {
            method: "POST",
            headers: initHeaders,
            body: requestData,
        });

        if (!response.ok) {
            throw new Error(`Failed to start upload: ${response.statusText}`);
        }

        const uploadUrl = response.headers.get("X-Goog-Upload-URL");

        // Upload video
        const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "content-type": "video/mp4",
            },
            body: videoBuffer,
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload video: ${uploadResponse.statusText}`);
        }

        logInfo("uploadVideoToFirebaseStorage", "End");
        return `https://firebasestorage.googleapis.com/v0/b/locket-video/o/users%2F${userId}%2Fmoments%2Fvideos%2F${videoName}`;
    } catch (error) {
        logError("uploadVideoToFirebaseStorage", error.message);
        throw error;
    } finally {
        if (video.path) {
            fs.unlinkSync(video.path);
        }
    }
};

const postVideo = async (userId, idToken, video, caption, textColor, upperBackgroundColor, lowerBackgroundColor) => {
    try {
        logInfo("postVideo", "Start");

        // Tải thumbnail từ video
        const thumbnailUrl = await uploadThumbnailFromVideo(userId, idToken, video);
        if (!thumbnailUrl) {
            throw new Error("Failed to upload thumbnail");
        }

        // Upload video
        const videoUrl = await uploadVideoToFirebaseStorage(userId, idToken, video);

        const postHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
        };

        const postData = JSON.stringify({
            data: {
                video_url: videoUrl,
                thumbnail_url: thumbnailUrl,
                caption: caption,
                sent_to_all: true,
                overlays: [
                    {
                        data: {
                            text: caption,
                            text_color: textColor,
                            type: "standard",
                            max_lines: {
                                "@type": "type.googleapis.com/google.protobuf.Int64Value",
                                value: "4",
                            },
                            background: {
                                material_blur: "ultra_thin",
                                colors: [upperBackgroundColor, lowerBackgroundColor], // Sử dụng cả hai màu nền
                            },
                        },
                        alt_text: caption,
                        overlay_id: "caption:standard",
                        overlay_type: "caption",
                    },
                ],
            },
        });

        const postResponse = await fetch(constants.CREATE_POST_URL, {
            method: "POST",
            headers: postHeaders,
            body: postData,
        });

        if (!postResponse.ok) {
            throw new Error(`Failed to create post: ${postResponse.statusText}`);
        }

        logInfo("postVideo", "End");
    } catch (error) {
        logError("postVideo", error.message);
        throw error;
    }
};

//#endregion

module.exports = {
    login,
    postImage,
    postVideo,
};
