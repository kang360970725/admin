import type { FFmpeg } from '@ffmpeg/ffmpeg';

export type VideoRotation = 0 | 90 | 180 | 270;

const CORE_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
const MAX_SOURCE_BYTES = 200 * 1024 * 1024;

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;
let progressListenerInstalled = false;
let activeProgress: ((percent: number) => void) | undefined;

async function getFfmpeg(onProgress?: (percent: number) => void) {
  activeProgress = onProgress;
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        import('@ffmpeg/util'),
      ]);
      const ffmpeg = ffmpegInstance || new FFmpeg();
      ffmpegInstance = ffmpeg;
      if (!progressListenerInstalled) {
        ffmpeg.on('progress', ({ progress }) => {
          if (Number.isFinite(progress))
            activeProgress?.(
              Math.max(1, Math.min(99, Math.round(progress * 100))),
            );
        });
        progressListenerInstalled = true;
      }
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${CORE_BASE_URL}/ffmpeg-core.js`,
          'text/javascript',
        ),
        wasmURL: await toBlobURL(
          `${CORE_BASE_URL}/ffmpeg-core.wasm`,
          'application/wasm',
        ),
      });
      return ffmpeg;
    })().catch((error) => {
      loadingPromise = null;
      throw error;
    });
  }
  return loadingPromise;
}

function sourceExtension(filename: string) {
  return filename.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || 'video';
}

function outputName(filename: string) {
  const base =
    filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-') ||
    'video';
  return `${base}.mp4`;
}

function videoFilter(rotation: VideoRotation) {
  const rotate =
    rotation === 90
      ? 'transpose=1'
      : rotation === 180
      ? 'hflip,vflip'
      : rotation === 270
      ? 'transpose=2'
      : '';
  const scale =
    'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2';
  return rotate ? `${rotate},${scale}` : scale;
}

export async function transcodeVideoForUpload(
  file: File,
  rotation: VideoRotation,
  onProgress?: (percent: number) => void,
) {
  if (!file?.size) throw new Error('无法识别视频文件');
  if (file.size > MAX_SOURCE_BYTES)
    throw new Error('原视频不能超过 200MB，请先压缩后再上传');
  onProgress?.(0);
  const ffmpeg = await getFfmpeg(onProgress);
  const { fetchFile } = await import('@ffmpeg/util');
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const input = `input-${token}.${sourceExtension(file.name)}`;
  const output = `output-${token}.mp4`;
  try {
    await ffmpeg.writeFile(input, await fetchFile(file));
    const exitCode = await ffmpeg.exec([
      '-i',
      input,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-vf',
      videoFilter(rotation),
      '-c:v',
      'libx264',
      '-profile:v',
      'baseline',
      '-level:v',
      '3.1',
      '-preset',
      'veryfast',
      '-crf',
      '26',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-profile:a',
      'aac_low',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-b:a',
      '96k',
      '-movflags',
      '+faststart',
      '-metadata:s:v:0',
      'rotate=0',
      output,
    ]);
    if (exitCode !== 0) throw new Error(`视频转码失败（错误码 ${exitCode}）`);
    const data = await ffmpeg.readFile(output);
    if (!(data instanceof Uint8Array) || !data.byteLength)
      throw new Error('视频转码结果为空');
    onProgress?.(100);
    return new File([data], outputName(file.name), { type: 'video/mp4' });
  } catch (error: any) {
    if (error?.message?.includes('视频转码')) throw error;
    throw new Error('视频转码失败，请更换视频格式或降低清晰度后重试');
  } finally {
    activeProgress = undefined;
    await ffmpeg.deleteFile(input).catch(() => undefined);
    await ffmpeg.deleteFile(output).catch(() => undefined);
  }
}
