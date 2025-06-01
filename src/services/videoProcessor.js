const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "../../temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Lấy thông tin video gốc bằng ffprobe
const getVideoInfo = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === "video");
      const audioStream = metadata.streams.find(s => s.codec_type === "audio");
      resolve({
        codec: videoStream?.codec_name || "libx264",
        bitrate: videoStream?.bit_rate ? parseInt(videoStream.bit_rate) : null,
        fps: eval(videoStream?.r_frame_rate || "30"),
        audioBitrate: audioStream?.bit_rate ? parseInt(audioStream.bit_rate) : 32000
      });
    });
  });
};

// Bộ filter scale + crop đảm bảo 500x500px, khung rộng nhất, không méo, không viền
const smartCropFilter = "scale='if(gt(iw/ih,1),ceil(500*iw/ih/2)*2,500)':'if(gt(iw/ih,1),500,ceil(500*ih/iw/2)*2)',crop=500:500:(in_w-500)/2:(in_h-500)/2'";

// Crop-only logic
const cropOnly = (inputPath, outputPath, codec = "libx264", crf = 24, audioBitrate = 128000) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf", smartCropFilter,
        "-vcodec", codec,
        "-crf", `${crf}`,
        "-preset", "fast",
        "-acodec", "aac",
        "-b:a", `${Math.floor(audioBitrate / 1000)}k`
      ])
      .on("end", resolve)
      .on("error", reject)
      .save(outputPath);
  });
};

// Encode logic
const compress = (inputPath, outputPath, crf, fps, audioBitrate = "32k") => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf", smartCropFilter,
        "-r", `${fps}`,
        "-vcodec", "libx264",
        "-crf", `${crf}`,
        "-preset", "veryfast",
        "-tune", "film",
        "-profile:v", "main",
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

// Hàm chính xử lý resize + compress
const resizeAndMaybeCompress = async (inputPath) => {
  let shouldClean = [];
  const originalSize = fs.statSync(inputPath).size;

  if (originalSize <= MAX_SIZE) {
    const croppedPath = path.join(TEMP_DIR, `cropped_${Date.now()}.mp4`);
    console.log(`[Crop-only] Gốc ≤ 5MB (${(originalSize / 1024 / 1024).toFixed(2)} MB), crop.`);

    const info = await getVideoInfo(inputPath);
    const codec = info.codec === "hevc" ? "libx265" : "libx264";
    const crf = 24;
    const audioBitrate = info.audioBitrate || 32000;

    await cropOnly(inputPath, croppedPath, codec, crf, audioBitrate);
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

  const fpsOptions = [30, 29, 28, 27, 26, 25, 24];
  const crfOptions = Array.from({ length: 12 }, (_, i) => 24 + i);
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
  throw new Error("❌ Unable to compress video to 5MB or less.");
};

module.exports = {
  resizeAndMaybeCompress
};
