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
            "x-goog-upload-content-type": "image/webp",
        };

        const data = JSON.stringify({
            name: `users/${userId}/moments/thumbnails/${imageName}`,
            contentType: "image/*",
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
            throw new Error(
                `Failed to upload image: ${uploadResponse.statusText}`
            );
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
            throw new Error(
                `Failed to get download token: ${getResponse.statusText}`
            );
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

const postImage = async (userId, idToken, image, caption, topBgColor, bottomBgColor, textColor) => {
    try {
        logInfo("postImage", "Start");
        const imageUrl = await uploadImageToFirebaseStorage(
            userId,
            idToken,
            image
        );

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
                            background: {
                                material_blur: "ultra_thin",
                                colors: [topBgColor, bottomBgColor],
                            },
                        },
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
            throw new Error(
                `Failed to create post: ${postResponse.statusText}`
            );
        }

        logInfo("postImage", "End");
    } catch (error) {
        logError("postImage", error.message);
        throw error;
    }
};

//#endregion

//#region Video handlers
const postVideo = async (userId, idToken, video, caption, topBgColor, bottomBgColor, textColor) => {
    try {
        logInfo("postVideo", "Start");
        const videoAsBuffer = fs.readFileSync(video.path);
        const thumbnailUrl = await uploadThumbnailFromVideo(
            userId,
            idToken,
            video
        );

        if (!thumbnailUrl) {
            throw new Error("Failed to upload thumbnail");
        }

        const videoUrl = await uploadVideoToFirebaseStorage(
            userId,
            idToken,
            videoAsBuffer
        );

        if (!videoUrl) {
            throw new Error("Failed to upload video");
        }

        const postHeaders = {
            "content-type": "application/json",
            authorization: `Bearer ${idToken}`,
        };

        const data = {
            data: {
                thumbnail_url: thumbnailUrl,
                video_url: videoUrl,
                caption: caption,
                sent_to_all: true,
                overlays: [
                    {
                        data: {
                            text: caption,
                            text_color: textColor,
                            type: "standard",
                            background: {
                                material_blur: "ultra_thin",
                                colors: [topBgColor, bottomBgColor],
                            },
                        },
                        overlay_id: "caption:standard",
                        overlay_type: "caption",
                    },
                ],
            },
        };

        const response = await fetch(constants.CREATE_POST_URL, {
            method: "POST",
            headers: postHeaders,
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`Failed to create post: ${response.statusText}`);
        }

        logInfo("postVideo", "End");
    } catch (error) {
        logError("postVideo", error.message);
        throw error;
    } finally {
        fs.unlinkSync(video.path);
    }
};

//
const uploadThumbnailFromVideo = async (userId, idToken, video) => {
    const thumbnailImage = await videoService.getThumbnail(video.path);
    return await uploadImageToFirebaseStorage(userId, idToken, thumbnailImage);
};

const uploadVideoToFirebaseStorage = async (userId, idToken, videoBuffer) => {
    try {
        logInfo("uploadVideoToFirebaseStorage", "Start");

        const videoName = `${Date.now()}_vtd182.mp4`;
        const url = `https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2F${userId}%2Fmoments%2Fvideos%2F${videoName}?uploadType=resumable&name=users%2F${userId}%2Fmoments%2Fvideos%2F${videoName}`;

        const initHeaders = {
            "content-type": "application/json; charset=UTF-8",
            authorization: `Bearer ${idToken}`,
            "x-goog-upload-protocol": "resumable",
            accept: "*/*",
            "x-goog-upload-command": "start",
            "x-goog-upload-content-length": `${videoBuffer.length}`,
            "x-goog-upload-content-type": "video/mp4",
        };

        const data = JSON.stringify({
            name: `users/${userId}/moments/videos/${videoName}`,
            contentType: "video/*",
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

        const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: constants.UPLOADER_HEADERS,
            body: videoBuffer,
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload video: ${uploadResponse.statusText}`);
        }

        const getUrl = `https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2F${userId}%2Fmoments%2Fvideos%2F${videoName}`;
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

        logInfo("uploadVideoToFirebaseStorage", "End");

        return `${getUrl}?alt=media&token=${downloadToken}`;
    } catch (error) {
        logError("uploadVideoToFirebaseStorage", error.message);
        throw error;
    }
};

//#endregion

module.exports = {
    login,
    postImage,
    postVideo,
};
