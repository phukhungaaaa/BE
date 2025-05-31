const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Resize video vuông 500x500 như cũ
const resizeVideo = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vf', "scale='if(gt(iw,ih),-1,500)':'if(gt(ih,iw),-1,500)',crop=500:500",
        '-vcodec', 'libx264',
        '-crf', '18',
        '-preset', 'fast',
        '-acodec', 'aac',
        '-b:a', '128k'
      ])
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
};

// Nén video nhiều lần với CRF tăng dần (giữ chất lượng tốt nhất có thể)
const compressUntilUnderSize = async (inputPath, targetSizeBytes) => {
  let crf = 24;
  const maxCrf = 35;
  let lastOutput = null;

  while (crf <= maxCrf) {
    const tempOutput = path.join(TEMP_DIR, `compressed_crf${crf}_${Date.now()}.mp4`);
    console.log(`[Compress] Trying CRF ${crf}...`);

    try {
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            "-vf", "scale='min(640,iw)':-2",
            "-c:v", "libx264",
            `-crf`, `${crf}`,
            "-preset", "veryfast",
            "-tune", "film",
            "-profile:v", "main",
            "-movflags", "+faststart",
            "-c:a", "aac",
            "-b:a", "48k",
            "-ac", "1"
          ])
          .on("end", resolve)
          .on("error", reject)
          .save(tempOutput);
      });

      const size = fs.statSync(tempOutput).size;
      console.log(`[Compress] CRF ${crf} output size: ${(size / 1024 / 1024).toFixed(2)} MB`);

      if (size <= targetSizeBytes) {
        return { finalPath: tempOutput, shouldClean: lastOutput ? [lastOutput] : [] };
      } else {
        if (lastOutput && fs.existsSync(lastOutput)) fs.unlinkSync(lastOutput);
        lastOutput = tempOutput;
        crf += 2;
      }
    } catch (err) {
      console.error(`[Compress] CRF ${crf} failed:`, err.message);
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      crf += 2;
    }
  }

  throw new Error("Unable to compress video under 5MB");
};

// Hàm chính: Resize trước, nếu cần thì nén đến khi đủ nhỏ
const resizeAndMaybeCompress = async (inputPath) => {
  const resizedPath = path.join(TEMP_DIR, `resized_${Date.now()}.mp4`);
  await resizeVideo(inputPath, resizedPath);

  const resizedSize = fs.statSync(resizedPath).size;
  console.log(`[Resize] Output size: ${(resizedSize / 1024 / 1024).toFixed(2)} MB`);

  if (resizedSize <= MAX_SIZE) {
    console.log("[Resize] File already under 5MB, using resized video.");
    return { finalPath: resizedPath, shouldClean: [] };
  }

  try {
    const { finalPath, shouldClean } = await compressUntilUnderSize(resizedPath, MAX_SIZE);
    return { finalPath, shouldClean: [resizedPath, ...shouldClean] };
  } catch (err) {
    console.error("[Error] Compression failed:", err.message);
    throw err;
  }
};

module.exports = {
  resizeAndMaybeCompress,
};
