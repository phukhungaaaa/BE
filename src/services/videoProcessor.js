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

const getVideoDurationInSeconds = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
};

const compressWithBitrate = async (inputPath, outputPath, targetSizeBytes, durationSec) => {
  const audioBitrateKbps = 64;
  const totalBitrateKbps = Math.floor((targetSizeBytes * 8) / durationSec / 1000);
  const videoBitrateKbps = Math.max(100, totalBitrateKbps - audioBitrateKbps);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-b:v ${videoBitrateKbps}k`,
        `-b:a ${audioBitrateKbps}k`,
        '-vf scale=500:500',
        '-vcodec libx264',
        '-acodec aac',
        '-preset veryfast'
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
};

const compressToExactSize = async (inputPath, targetSize) => {
  let minCrf = 18;
  let maxCrf = 35;
  let bestFitPath = null;

  while (minCrf <= maxCrf) {
    const midCrf = Math.floor((minCrf + maxCrf) / 2);
    const tempOutput = path.join(TEMP_DIR, `crf_${midCrf}_${Date.now()}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf scale=500:500',
          '-vcodec libx264',
          `-crf ${midCrf}`,
          '-preset fast',
          '-acodec aac',
          '-b:a 96k'
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(tempOutput);
    });

    const size = fs.statSync(tempOutput).size;
    console.log(`[CRF ${midCrf}] Output size: ${(size / 1024 / 1024).toFixed(2)} MB`);

    if (size <= targetSize) {
      if (bestFitPath) fs.unlinkSync(bestFitPath);
      bestFitPath = tempOutput;
      maxCrf = midCrf - 1;
    } else {
      fs.unlinkSync(tempOutput);
      minCrf = midCrf + 1;
    }
  }

  if (bestFitPath) return bestFitPath;

  console.warn('[CRF] All CRF attempts failed. Falling back to bitrate...');
  return null;
};

const resizeAndMaybeCompress = async (inputPath) => {
  const resizedPath = path.join(TEMP_DIR, `resized_${Date.now()}.mp4`);
  await resizeVideo(inputPath, resizedPath);

  const resizedSize = fs.statSync(resizedPath).size;
  console.log(`[Resize] Size: ${(resizedSize / 1024 / 1024).toFixed(2)} MB`);

  if (resizedSize <= MAX_SIZE) {
    return { finalPath: resizedPath, shouldClean: [] };
  }

  const crfPath = await compressToExactSize(resizedPath, MAX_SIZE);

  if (crfPath) {
    return { finalPath: crfPath, shouldClean: [resizedPath] };
  }

  const fallbackPath = path.join(TEMP_DIR, `bitrate_${Date.now()}.mp4`);
  const duration = await getVideoDurationInSeconds(resizedPath);
  await compressWithBitrate(resizedPath, fallbackPath, MAX_SIZE, duration);

  return { finalPath: fallbackPath, shouldClean: [resizedPath] };
};

module.exports = { resizeAndMaybeCompress };
