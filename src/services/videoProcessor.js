const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Resize vuông 500x500 như cũ
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

// Nén kiểu Messenger: scale về 640p, CRF 30, giữ chất lượng
const compressLikeMessenger = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf", "scale='min(640,iw)':-2",
        "-c:v", "libx264",
        "-crf", "30",
        "-preset", "veryfast",
        "-tune", "film",
        "-profile:v", "main",
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-b:a", "48k",
        "-ac", "1"
      ])
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .save(outputPath);
  });
};

// Hàm chính: resize, nếu >5MB thì nén
const resizeAndMaybeCompress = async (inputPath) => {
  const resizedPath = path.join(TEMP_DIR, `resized_${Date.now()}.mp4`);
  await resizeVideo(inputPath, resizedPath);

  const resizedSize = fs.statSync(resizedPath).size;
  console.log(`[Resize] Size: ${(resizedSize / 1024 / 1024).toFixed(2)} MB`);

  if (resizedSize <= MAX_SIZE) {
    return { finalPath: resizedPath, shouldClean: [] };
  }

  const compressedPath = path.join(TEMP_DIR, `messenger_${Date.now()}.mp4`);
  await compressLikeMessenger(resizedPath, compressedPath);

  return { finalPath: compressedPath, shouldClean: [resizedPath] };
};

module.exports = {
  resizeAndMaybeCompress,
};
