const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "../../temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Hàm xử lý encode: scale → crop trung tâm 500x500 → fps → crf → audio
const fullCompress = (inputPath, outputPath, scale, fps, crf, audioBitrate = "32k") => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf", `scale=${scale}:${scale},crop=500:500`,
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

// Hàm chính: vòng lặp scale → fps → crf
const resizeAndMaybeCompress = async (inputPath) => {
  const scaleOptions = [1080, 960, 840, 720, 640, 550, 500, 460, 420, 360];
  const fpsOptions = [30, 27, 24];
  const crfOptions = [24, 26, 28, 30, 32, 35];
  const audioBitrate = "32k";

  let lastOutput = null;

  for (const scale of scaleOptions) {
    for (const fps of fpsOptions) {
      for (const crf of crfOptions) {
        const outputPath = path.join(
          TEMP_DIR,
          `compressed_${scale}px_${fps}fps_crf${crf}_${Date.now()}.mp4`
        );

        console.log(`[Try] scale=${scale}px | fps=${fps} | crf=${crf}`);

        try {
          await fullCompress(inputPath, outputPath, scale, fps, crf, audioBitrate);
          const size = fs.statSync(outputPath).size;

          console.log(`[Result] ${(size / 1024 / 1024).toFixed(2)} MB @ scale=${scale} fps=${fps} crf=${crf}`);

          if (size <= MAX_SIZE) {
            if (lastOutput && fs.existsSync(lastOutput)) fs.unlinkSync(lastOutput);
            return { finalPath: outputPath, shouldClean: [] };
          } else {
            if (lastOutput && fs.existsSync(lastOutput)) fs.unlinkSync(lastOutput);
            lastOutput = outputPath;
          }
        } catch (err) {
          console.error(`[Error] Failed at scale=${scale}, fps=${fps}, crf=${crf}: ${err.message}`);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
      }
    }
  }

  throw new Error("❌ Unable to compress video to 5MB or less.");
};

module.exports = {
  resizeAndMaybeCompress
};
