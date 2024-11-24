const Router = require("express");
const router = Router();
const locketController = require("../controllers/locket.controller.js");
const passwordController = require("../controllers/password.controller.js");
const friendsController = require("../controllers/friends.controller.js");
const profileController = require("../controllers/profile.controller.js");
const handleUpload = require("../middlewares/multipart-upload-support.middleware.js");
const MAX_IMAGE_COUNT = 1;
const MAX_VIDEO_COUNT = 1;

router.post("/login", locketController.login);

router.post(
    "/upload-media",
    handleUpload(MAX_IMAGE_COUNT, MAX_VIDEO_COUNT),
    locketController.uploadMedia
);

router.get("/ping", (req, res) => {
    res.status(200).send("pong");
});

router.post("/forgot-password", passwordController.forgotPassword);

router.post("/getFriends", friendsController.getFriends);

router.post("/profile", profileController.getProfile);

module.exports = router;