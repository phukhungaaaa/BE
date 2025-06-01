const ffmpeg = require("fluent-ffmpeg"); 
const fs = require("fs");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "../../temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Lấy thông tin video gốc
const getVideoInfo = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === "video");
      const audioStream = metadata.streams.find(s => s.codec_type === "audio");
      resolve({
        codec: videoStream?.codec_name || "libx264",
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        bitrate: videoStream?.bit_rate ? parseInt(videoStream.bit_rate) : null,
        fps: eval(videoStream?.r_frame_rate || "30"),
        audioBitrate: audioStream?.bit_rate ? parseInt(audioStream.bit_rate) : 32000
      });
    });
  });
};

// Crop hình vuông trung tâm, auto scale nếu quá to
const cropOnly = (inputPath, outputPath, info, crf = 24) => {
  return new Promise((resolve, reject) => {
    const crop = "crop='min(iw\\,ih)':'min(iw\\,ih)':(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2";
    const scale = Math.max(info.width, info.height) > 1080 ? ",scale=720:720" : "";
    const filter = crop + scale;

    ffmpeg(inputPath)
      .outputOptions([
        "-vf", filter,
        "-vcodec", info.codec === "hevc" ? "libx265" : "libx264",
        "-crf", `${crf}`,
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-acodec", "aac",
        "-b:a", `${Math.floor(info.audioBitrate / 1000)}k`,
        "-movflags", "+faststart"
      ])
      .on("end", resolve)
      .on("error", reject)
      .save(outputPath);
  });
};

// Nén có crop
const compress = (inputPath, outputPath, crf, fps, audioBitrate = "32k") => {
  return new Promise((resolve, reject) => {
    const crop = "crop='min(iw\\,ih)':'min(iw\\,ih)':(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2";
    const filter = `${crop},scale=720:720`;

    ffmpeg(inputPath)
      .outputOptions([
        "-vf", filter,
        "-r", `${fps}`,
        "-vcodec", "libx264",
        "-crf", `${crf}`,
        "-preset", "veryfast",
        "-tune", "film",
        "-profile:v", "main",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-acodec", "aac",
        "-b:a", audioBitrate,
        "-ac", "1"
      ])
      .on("end", resolve)
      .on("error", reject)
      .save(outputPath);
  });
};

// Hàm chính
const resizeAndMaybeCompress = async (inputPath) => {
  let shouldClean = [];
  const originalSize = fs.statSync(inputPath).size;
  const info = await getVideoInfo(inputPath);

  // Nếu gốc đã nhỏ hơn 5MB
  if (originalSize <= MAX_SIZE) {
    const croppedPath = path.join(TEMP_DIR, `cropped_${Date.now()}.mp4`);
    console.log(`[Crop-only] Gốc ≤ 5MB (${(originalSize / 1024 / 1024).toFixed(2)} MB), crop.`);

    // Xử lý CRF nhẹ dựa vào bitrate
    const crf = info.bitrate && info.bitrate < 400_000 ? 28 : 24;
    await cropOnly(inputPath, croppedPath, info, crf);

    const croppedSize = fs.statSync(croppedPath).size;
    console.log(`[Crop-only] Sau crop: ${(croppedSize / 1024 / 1024).toFixed(2)} MB`);

    if (croppedSize <= MAX_SIZE) {
      return { finalPath: croppedPath, shouldClean };
    } else {
      console.log(`[Crop-only] Sau crop vẫn > 5MB → tiếp tục nén.`);
      shouldClean.push(croppedPath);
      inputPath = croppedPath;
    }
  }

  // Nén
  const fpsOptions = [30, 28, 26, 24];
  const crfOptions = Array.from({ length: 10 }, (_, i) => 24 + i);
  const audioBitrate = "32k";

  let lastOutput = null;

  for (const crf of crfOptions) {
    for (const fps of fpsOptions) {
      const outputPath = path.join(
        TEMP_DIR,
        `compressed_${fps}fps_crf${crf}_${Date.now()}.mp4`
      );

      console.log(`[Try] fps=${fps} | crf=${crf}`);

      try {
        await compress(inputPath, outputPath, crf, fps, audioBitrate);
        const size = fs.statSync(outputPath).size;

        console.log(`[Result] ${(size / 1024 / 1024).toFixed(2)} MB @ fps=${fps} crf=${crf}`);

        if (size <= MAX_SIZE) {
          if (lastOutput && fs.existsSync(lastOutput)) fs.unlinkSync(lastOutput);
          return { finalPath: outputPath, shouldClean };
        } else {
          if (lastOutput && fs.existsSync(lastOutput)) fs.unlinkSync(lastOutput);
          lastOutput = outputPath;
        }
      } catch (err) {
        console.error(`[Error] fps=${fps}, crf=${crf}: ${err.message}`);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      }
    }
  }

  if (lastOutput && fs.existsSync(lastOutput)) fs.unlinkSync(lastOutput);
  throw new Error("❌ Không thể nén video xuống 5MB.");
};

module.exports = {
  resizeAndMaybeCompress
};
