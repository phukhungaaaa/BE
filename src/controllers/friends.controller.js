const axios = require("axios");

const getFriends = async (req, res) => {
  const { token, uid } = req.body;

  if (!token || !uid) {
    return res.status(400).json({ error: "Token và UID là bắt buộc." });
  }

  try {
    // Gọi Firestore lấy danh sách bạn
    const friendsResponse = await axios.get(
      `https://firestore.googleapis.com/v1/projects/locket-4252a/databases/(default)/documents/users/${uid}/friends`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const friends = friendsResponse.data.documents || [];
    const userUids = friends.map((friend) => {
      const path = friend.name || "";
      return path.split("/").pop();
    });

    // Lấy thông tin từng bạn bè
    const fetchUserPromises = userUids.map((userUid) =>
      axios.post(
        "https://api.locketcamera.com/fetchUserV2",
        {
          data: { user_uid: userUid },
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
              "eyJraWQiOiJNbjVDS1EiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxOjY0MTAyOTA3NjA4Mzppb3M6Y2M4ZWI0NjI5MGQ2OWIyMzRmYTYwNiIsImF1ZCI6WyJwcm9qZWN0c1wvNjQxMDI5MDc2MDgzIiwicHJvamVjdHNcL2xvY2tldC00MjUyYSJdLCJwcm92aWRlciI6ImRldmljZV9jaGVja19kZXZpY2VfaWRlbnRpZmljYXRpb24iLCJpc3MiOiJodHRwczpcL1wvZmlyZWJhc2VhcHBjaGVjay5nb29nbGVhcGlzLmNvbVwvNjQxMDI5MDc2MDgzIiwiZXhwIjoxNzIyMTY3ODk4LCJpYXQiOjE3MjIxNjQyOTgsImp0aSI6ImlHUGlsT1dDZGg4Mll3UTJXRC1neEpXeWY5TU9RRFhHcU5OR3AzTjFmRGcifQ.lqTOJfdoYLpZwYeeXtRliCdkVT7HMd7_Lj-d44BNTGuxSYPIa9yVAR4upu3vbZSh9mVHYS8kJGYtMqjP-L6YXsk_qsV_gzKC2IhVAV6KbPDRHdevMfBC6fRiOSVn7vt749GVFdZqAuDCXhCILsaMhvgDBgZoDilgAPtpNwyjz-VtRB7OdOUbuKTCqdoSOX0SJWVUMyuI8nH0-unY--YRctunK8JHZDxBaM_ahVggYPWBCpzxq9Yeq8VSPhadG_tGNaADStYPaeeUkZ7DajwWqH5ze6ESpuFNgAigwPxCM735_ZiPeD7zHYwppQA9uqTWszK9v9OvWtFCsgCEe22O8awbNbuEBTKJpDQ8xvZe8iEYyhfUPncER3S-b1CmuXR7tFCdTgQe5j7NGWjFvN_CnL7D2nudLwxWlpqwASCHvHyi8HBaJ5GpgriTLXAAinY48RukRDBi9HwEzpRecELX05KTD2lTOfQCjKyGpfG2VUHP5Xm36YbA3iqTDoDXWMvV",
          },
        }
      )
    );

    const fetchUserResponses = await Promise.all(fetchUserPromises);

    const friendsInfo = fetchUserResponses.map((response) => {
      const data = response.data.result.data;
      const name = `${data.first_name || ""} ${data.last_name || ""}`.trim();

      return {
        uid: data.uid,
        name: name || "No Name",
        username: data.username || "No Username",
        profile_picture_url: data.profile_picture_url || null,
        badge: data.badge || null,
      };
    });

    res.json(friendsInfo);
  } catch (error) {
    console.error("❌ Error fetching friends info:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Headers:", error.response.headers);
      console.error("Data:", error.response.data);
    } else if (error.request) {
      console.error("No response received:", error.request);
    } else {
      console.error("Setup error:", error.message);
    }

    res.status(500).json({
      error: "Đã xảy ra lỗi khi lấy thông tin bạn bè.",
      details: error.response?.data || error.message || "Unknown error",
    });
  }
};

module.exports = { getFriends };
