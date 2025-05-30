const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

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

const compressToExactSize = async (inputPath, targetSize) => {
  let minCrf = 18;
  let maxCrf = 35;
  let bestFitPath = null;
  let bestFitSize = 0;

  while (minCrf <= maxCrf) {
    const midCrf = Math.floor((minCrf + maxCrf) / 2);
    const tempOutput = path.join(TEMP_DIR, `compress_${midCrf}_${Date.now()}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', 'scale=500:500',
          '-vcodec', 'libx264',
          '-crf', `${midCrf}`,
          '-preset', 'fast',
          '-acodec', 'aac',
          '-b:a', '128k'
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(tempOutput);
    });

    const size = fs.statSync(tempOutput).size;
    console.log(`[CRF ${midCrf}] Output size: ${(size / 1024 / 1024).toFixed(2)} MB`);

    if (size > targetSize) {
      // Lớn hơn → nén mạnh hơn
      minCrf = midCrf + 1;
      if (bestFitPath) fs.unlinkSync(bestFitPath);
      bestFitPath = tempOutput;
      bestFitSize = size;
    } else {
      // Nhỏ hơn → bỏ, vì yêu cầu không được nhỏ hơn 5MB
      fs.unlinkSync(tempOutput);
      maxCrf = midCrf - 1;
    }
  }

  if (!bestFitPath) throw new Error("Không thể nén về đúng 5MB (video sau resize quá nhẹ)");

  return bestFitPath;
};

const resizeAndMaybeCompress = async (inputPath) => {
  const resizedPath = path.join(TEMP_DIR, `resized_${Date.now()}.mp4`);
  await resizeVideo(inputPath, resizedPath);

  const resizedSize = fs.statSync(resizedPath).size;

  console.log(`[Resize] Size: ${(resizedSize / 1024 / 1024).toFixed(2)} MB`);

  if (resizedSize <= MAX_SIZE) {
    // Không cần nén nữa
    return { finalPath: resizedPath, shouldClean: [] };
  }

  // Phải nén
  const compressedPath = await compressToExactSize(resizedPath, MAX_SIZE);
  return { finalPath: compressedPath, shouldClean: [resizedPath] };
};

module.exports = { resizeAndMaybeCompress };
