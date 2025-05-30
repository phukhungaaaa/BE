const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const compressImageToMax1MB = async (inputPath) => {
  const outputPath = path.join(TEMP_DIR, `compressed_${Date.now()}.jpg`);
  let quality = 85;

  while (quality >= 40) {
    await sharp(inputPath)
      .jpeg({ quality })
      .toFile(outputPath);

    const size = fs.statSync(outputPath).size;
    if (size <= 1 * 1024 * 1024) return { finalPath: outputPath };

    fs.unlinkSync(outputPath);
    quality -= 10;
  }

  throw new Error("Không thể nén ảnh xuống ≤1MB");
};

module.exports = { compressImageToMax1MB };
