const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "../../temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const cropAndCompressWithCodec = async (inputPath) => {
  const outputPath = path.join(TEMP_DIR, `crop_hevc_${Date.now()}.mp4`);

  let crf = 28;
  const maxCrf = 36;

  while (crf <= maxCrf) {
    console.log(`[HEVC-CROP] Đang crop + encode bằng libx265 | crf=${crf}`);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-vf",
          "scale='if(gt(iw,ih),-1,500)':'if(gt(ih,iw),-1,500)',crop=500:500",
          "-vcodec", "libx265",
          "-crf", `${crf}`,
          "-preset", "slow",
          "-acodec", "aac",
          "-b:a", "32k",
          "-movflags", "+faststart"
        ])
        .on("end", resolve)
        .on("error", reject)
        .save(outputPath);
    });

    const size = fs.statSync(outputPath).size;
    console.log(`[HEVC-CROP] Kết quả: ${(size / 1024 / 1024).toFixed(2)} MB @ crf=${crf}`);

    if (size <= MAX_SIZE) {
      return { finalPath: outputPath, shouldClean: [] };
    } else {
      fs.unlinkSync(outputPath);
      crf += 1;
    }
  }

  throw new Error("❌ Không thể crop + encode video xuống dưới 5MB bằng libx265.");
};

module.exports = {
  resizeAndMaybeCompress: cropAndCompressWithCodec
};
