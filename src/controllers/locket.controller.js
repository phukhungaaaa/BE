const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "../../temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Lấy thông tin video
const getVideoInfo = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === "video");
      const audioStream = metadata.streams.find(s => s.codec_type === "audio");
      resolve({
        width: videoStream.width,
        height: videoStream.height,
        fps: eval(videoStream.r_frame_rate || "30"),
        duration: metadata.format.duration,
        audioBitrate: audioStream?.bit_rate ? parseInt(audioStream.bit_rate) : 32000
      });
    });
  });
};

// Nén và crop theo cấu hình
const compressAndCrop = (inputPath, outputPath, scale, fps, crf, audioBitrate) => {
  const filter = `crop='min(iw\\,ih)':'min(iw\\,ih)':(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2,scale=${scale}:${scale}`;
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf", filter,
        "-r", `${fps}`,
        "-vcodec", "libx264",
        "-crf", `${crf}`,
        "-preset", "veryfast",
        "-tune", "film",
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

// Ước tính thông số phù hợp duy nhất cho video
const estimateTargetParams = (info) => {
  const { duration, width, height } = info;
  const resolution = Math.min(width, height);
  const scale = resolution >= 720 ? 720 : resolution;

  const videoBitrate = Math.floor((MAX_SIZE * 8) / duration) - 32000; // Chừa 32kbps cho audio
  const crf = videoBitrate > 800000 ? 24 : videoBitrate > 600000 ? 26 : 28;
  const fps = duration < 10 ? 30 : duration < 30 ? 24 : 20;

  return { scale, crf, fps, audioBitrate: "32k" };
};

// Hàm chính
const resizeAndMaybeCompress = async (inputPath) => {
  const info = await getVideoInfo(inputPath);
  const { scale, crf, fps, audioBitrate } = estimateTargetParams(info);

  const outputPath = path.join(
    TEMP_DIR,
    `final_${scale}p_${fps}fps_crf${crf}_${Date.now()}.mp4`
  );

  console.log(`[Compress] scale=${scale}, fps=${fps}, crf=${crf}, audio=${audioBitrate}`);

  await compressAndCrop(inputPath, outputPath, scale, fps, crf, audioBitrate);
  const finalSize = fs.statSync(outputPath).size;

  if (finalSize <= MAX_SIZE) {
    return { finalPath: outputPath, shouldClean: [] };
  }

  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  throw new Error("❌ Compressed video exceeds 5MB.");
};

module.exports = {
  resizeAndMaybeCompress
};
