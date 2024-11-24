const axios = require("axios");

exports.getProfile = async (req, res) => {
  const { token, uid } = req.body;

  if (!token || !uid) {
    return res.status(400).json({ error: "Missing token or uid" });
  }

  try {
    const response = await axios.post(
      "https://api.locketcamera.com/fetchUserV2",
      {
        data: { user_uid: uid },
      },
      {
        headers: {
          Accept: "*/*",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Client-Version": "iOS/FirebaseSDK/10.23.1/FirebaseCore-iOS",
          "X-Firebase-GMPID": "1:641029076083:ios:cc8eb46290d69b234fa606",
          "X-Ios-Bundle-Identifier": "com.locket.Locket",
          "X-Firebase-AppCheck":
            "eyJraWQiOiJNbjVDS1EiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",
        },
      }
    );

    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || null,
    });
  }
};