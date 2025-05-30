const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const resizeAndMaybeCompress = async (inputPath) => {
  const resizedPath = path.join(TEMP_DIR, `resized_${Date.now()}.mp4`);

  // Step 1: Resize 500x500 với CRF 18
  await new Promise((resolve, reject) => {
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
      .save(resizedPath);
  });

  const stats = fs.statSync(resizedPath);
  if (stats.size <= 5 * 1024 * 1024) {
    return { finalPath: resizedPath, shouldClean: [] };
  }

  // Nếu sau resize > 5MB, bắt đầu nén CRF tăng dần
  let crf = 20;
  const maxCrf = 35;
  let compressedPath = '';

  while (crf <= maxCrf) {
    const outputPath = path.join(TEMP_DIR, `compressed_${crf}_${Date.now()}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg(resizedPath)
        .outputOptions([
          '-vf', 'scale=500:500',
          '-vcodec', 'libx264',
          '-crf', `${crf}`,
          '-preset', 'fast',
          '-acodec', 'aac',
          '-b:a', '96k'
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    const size = fs.statSync(outputPath).size;
    if (size <= 5 * 1024 * 1024) {
      compressedPath = outputPath;
      break;
    } else {
      fs.unlinkSync(outputPath);
    }

    crf += 2;
  }

  if (!compressedPath) throw new Error("Không thể nén video xuống 5MB");

  return { finalPath: compressedPath, shouldClean: [resizedPath] };
};

module.exports = { resizeAndMaybeCompress };
