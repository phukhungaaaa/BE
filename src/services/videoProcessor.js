const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "../../temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Resize vuông 500x500
const resizeVideo = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        "scale='if(gt(iw,ih),-1,500)':'if(gt(ih,iw),-1,500)',crop=500:500",
        "-vcodec",
        "libx264",
        "-crf",
        "18",
        "-preset",
        "fast",
        "-acodec",
        "aac",
        "-b:a",
        "128k"
      ])
      .on("end", resolve)
      .on("error", reject)
      .save(outputPath);
  });
};

// Nén thông minh: thử nhiều CRF, scale và fps
const compressUntilUnderSize = async (inputPath, targetSizeBytes) => {
  const crfRange = [24, 26, 28, 30, 32, 35];
  const scaleOptions = [640, 480, 360];

  let lastOutput = null;

  for (const scale of scaleOptions) {
    for (const crf of crfRange) {
      const tempOutput = path.join(
        TEMP_DIR,
        `compressed_${scale}px_crf${crf}_${Date.now()}.mp4`
      );
      console.log(`[Compress] Trying scale=${scale}px, CRF=${crf}...`);

      try {
        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .outputOptions([
              `-vf`,
              `scale='min(${scale},iw)':-2`,
              "-r",
              "24", // giảm fps xuống 24
              "-c:v",
              "libx264",
              "-crf",
              `${crf}`,
              "-preset",
              "veryfast",
              "-tune",
              "film",
              "-profile:v",
              "main",
              "-movflags",
              "+faststart",
              "-c:a",
              "aac",
              "-b:a",
              "48k",
              "-ac",
              "1"
            ])
            .on("end", resolve)
            .on("error", reject)
            .save(tempOutput);
        });

        const size = fs.statSync(tempOutput).size;
        console.log(
          `[Compress] Result: ${(size / 1024 / 1024).toFixed(2)} MB`
        );

        if (size <= targetSizeBytes) {
          if (lastOutput && fs.existsSync(lastOutput))
            fs.unlinkSync(lastOutput);
          return {
            finalPath: tempOutput,
            shouldClean: []
          };
        } else {
          if (lastOutput && fs.existsSync(lastOutput))
            fs.unlinkSync(lastOutput);
          lastOutput = tempOutput;
        }
      } catch (err) {
        console.error(`[Compress] scale=${scale} CRF=${crf} failed:`, err.message);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      }
    }
  }

  throw new Error("Unable to compress video under 5MB, even with max compression.");
};

// Hàm chính
const resizeAndMaybeCompress = async (inputPath) => {
  const resizedPath = path.join(TEMP_DIR, `resized_${Date.now()}.mp4`);
  await resizeVideo(inputPath, resizedPath);

  const resizedSize = fs.statSync(resizedPath).size;
  console.log(
    `[Resize] Output size: ${(resizedSize / 1024 / 1024).toFixed(2)} MB`
  );

  if (resizedSize <= MAX_SIZE) {
    console.log("[Resize] File already under 5MB, using resized video.");
    return { finalPath: resizedPath, shouldClean: [] };
  }

  try {
    const { finalPath, shouldClean } = await compressUntilUnderSize(
      resizedPath,
      MAX_SIZE
    );
    return { finalPath, shouldClean: [resizedPath, ...shouldClean] };
  } catch (err) {
    console.error("[Error] Compression failed:", err.message);
    throw err;
  }
};

module.exports = {
  resizeAndMaybeCompress
};
