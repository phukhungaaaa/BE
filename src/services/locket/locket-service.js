const fetch = require("node-fetch");
const fs = require("fs");
const { logError, logInfo } = require("./logger.js");
const constants = require("./constants.js");

const login = async (email, password) => {
    try {
        logInfo("login", "Start");
        const response = await fetch(constants.LOGIN_URL, {
            method: "POST",
            body: JSON.stringify({ email, password }),
            headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
            throw new Error(`Login failed: ${response.statusText}`);
        }

        const data = await response.json();
        logInfo("login", "End");
        return data;
    } catch (error) {
        logError("login", error.message);
        throw error;
    }
};

const uploadImageToFirebaseStorage = async (userId, idToken, image) => {
    try {
        logInfo("uploadImageToFirebaseStorage", "Start");
        const imageName = Date.now() + "-" + image.originalname;
        const url = `https://firebasestorage.googleapis.com/upload/storage/v1/b/locket-image/o?uploadType=POST`;
        const headers = {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
            "x-firebase-gmpid": "1:641029076083:ios:cc8eb46290d69b234fa609",
        };

        const data = JSON.stringify({
            name: `users/${userId}/moments/images/${imageName}`,
            contentType: "image/*",
            bucket: "",
            metadata: { creator: userId, visibility: "private" },
        });

        const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: data,
        });

        if (!response.ok) {
            throw new Error(`Failed to start image upload: ${response.statusText}`);
        }

        const uploadUrl = response.headers.get("X-Goog-Upload-URL");

        // Giai đoạn 2: Tải ảnh lên
        const imageBuffer = fs.readFileSync(image.path);
        const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Length": imageBuffer.length,
                "Content-Type": image.mimetype,
            },
            body: imageBuffer,
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
        }

        const getUrl = `https://firebasestorage.googleapis.com/v0/b/locket-image/o/users%2F${userId}%2Fmoments%2Fimages%2F${imageName}`;
        const getHeaders = {
            "content-type": "application/json; charset=UTF-8",
            authorization: `Bearer ${idToken}`,
        };

        const getResponse = await fetch(getUrl, {
            method: "GET",
            headers: getHeaders,
        });

        if (!getResponse.ok) {
            throw new Error(`Failed to get image download URL: ${getResponse.statusText}`);
        }

        const downloadToken = (await getResponse.json()).downloadTokens;
        return `${getUrl}?alt=media&token=${downloadToken}`;
    } catch (error) {
        logError("uploadImageToFirebaseStorage", error.message);
        throw error;
    } finally {
        // Xoá file ảnh tạm
        if (image.path) {
            fs.unlinkSync(image.path);
        }
    }
};

const uploadVideoToFirebaseStorage = async (userId, idToken, video) => {
    try {
        logInfo("uploadVideoToFirebaseStorage", "Start");
        const videoName = Date.now() + "-" + video.originalname;
        const url = `https://firebasestorage.googleapis.com/upload/storage/v1/b/locket-video/o?uploadType=POST`;
        const headers = {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
            "x-firebase-gmpid": "1:641029076083:ios:cc8eb46290d69b234fa609",
        };

        const data = JSON.stringify({
            name: `users/${userId}/moments/videos/${videoName}`,
            contentType: "video/*",
            bucket: "",
            metadata: { creator: userId, visibility: "private" },
        });

        const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: data,
        });

        if (!response.ok) {
            throw new Error(`Failed to start video upload: ${response.statusText}`);
        }

        const uploadUrl = response.headers.get("X-Goog-Upload-URL");

        // Giai đoạn 2: Tải video lên
        const videoBuffer = fs.readFileSync(video.path);
        const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Length": videoBuffer.length,
                "Content-Type": "video/mp4",
            },
            body: videoBuffer,
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload video: ${uploadResponse.statusText}`);
        }

        const getUrl = `https://firebasestorage.googleapis.com/v0/b/locket-video/o/users%2F${userId}%2Fmoments%2Fvideos%2F${videoName}`;
        const getHeaders = {
            "content-type": "application/json; charset=UTF-8",
            authorization: `Bearer ${idToken}`,
        };

        const getResponse = await fetch(getUrl, {
            method: "GET",
            headers: getHeaders,
        });

        if (!getResponse.ok) {
            throw new Error(`Failed to get video download URL: ${getResponse.statusText}`);
        }

        const downloadToken = (await getResponse.json()).downloadTokens;
        return `${getUrl}?alt=media&token=${downloadToken}`;
    } catch (error) {
        logError("uploadVideoToFirebaseStorage", error.message);
        throw error;
    } finally {
        // Xoá file video tạm
        if (video.path) {
            fs.unlinkSync(video.path);
        }
    }
};

const postImage = async (
    userId,
    idToken,
    image,
    caption,
    topBgColor,
    bottomBgColor,
    textColor
) => {
    try {
        logInfo("postImage", "Start");
        const imageUrl = await uploadImageToFirebaseStorage(userId, idToken, image);

        const postHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
        };

        const postData = JSON.stringify({
            data: {
                image_url: imageUrl,
                caption: caption,
                sent_to_all: true,
                overlays: [
                    {
                        data: {
                            text: caption,
                            text_color: textColor, // Màu chữ
                            type: "standard",
                            max_lines: {
                                "@type": "type.googleapis.com/google.protobuf.Int64Value",
                                value: "4",
                            },
                            background: {
                                material_blur: "ultra_thin",
                                colors: [topBgColor, bottomBgColor], // Màu nền
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

const postVideo = async (
    userId,
    idToken,
    video,
    caption,
    topBgColor,
    bottomBgColor,
    textColor
) => {
    try {
        logInfo("postVideo", "Start");
        const videoUrl = await uploadVideoToFirebaseStorage(userId, idToken, video);

        const postHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
        };

        const postData = JSON.stringify({
            data: {
                video_url: videoUrl,
                caption: caption,
                sent_to_all: true,
                overlays: [
                    {
                        data: {
                            text: caption,
                            text_color: textColor, // Màu chữ
                            type: "standard",
                            max_lines: {
                                "@type": "type.googleapis.com/google.protobuf.Int64Value",
                                value: "4",
                            },
                            background: {
                                material_blur: "ultra_thin",
                                colors: [topBgColor, bottomBgColor], // Màu nền
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

module.exports = {
    login,
    uploadImageToFirebaseStorage,
    uploadVideoToFirebaseStorage,
    postImage,
    postVideo,
};
