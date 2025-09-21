const axios = require("axios");

exports.getAvatar = async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Thiếu url" });
  }

  try {
    // Fetch ảnh từ Firebase
    const response = await axios.get(url, { responseType: "arraybuffer" });

    res.set("Content-Type", response.headers["content-type"] || "image/webp");
    res.set("Cache-Control", "public, max-age=3600");
    res.set("Cross-Origin-Resource-Policy", "cross-origin"); // fix COEP

    return res.send(response.data);
  } catch (error) {
    console.error("Lỗi proxy avatar:", error.message);
    return res.status(500).json({ error: "Không fetch được avatar" });
  }
};
