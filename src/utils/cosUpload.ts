import { getUploadInfo } from '@/services/api';

async function assertMediaDuration(file: File, scene: string) {
  if (scene !== 'audio' && scene !== 'video') return;
  const url = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const media = document.createElement(scene === 'audio' ? 'audio' : 'video');
      media.preload = 'metadata';
      media.onloadedmetadata = () => resolve(Number(media.duration || 0));
      media.onerror = () => reject(new Error('无法读取媒体时长，请更换文件格式'));
      media.src = url;
    });
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('无法读取媒体时长，请更换文件格式');
    if (duration > 60) throw new Error(`${scene === 'audio' ? '语音' : '视频'}时长不能超过 60 秒`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadFileToCosBySts(params: {
  module: string;
  scene: string;
  file: File;
}) {
  const { module, scene, file } = params;
  const imageScenes = new Set(['avatar', 'cover', 'image', 'profile-images', 'anti-cheat', 'assessment-results']);
  const maxBytes = scene === 'avatar'
    ? 1 * 1024 * 1024
    : imageScenes.has(scene)
      ? 2 * 1024 * 1024
      : scene === 'audio'
        ? 5 * 1024 * 1024
        : scene === 'video'
          ? 20 * 1024 * 1024
          : 8 * 1024 * 1024;
  if (!file?.size) throw new Error('无法识别文件大小');
  if (file.size > maxBytes) throw new Error(`文件不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`);
  if (imageScenes.has(scene) && file.type && !file.type.startsWith('image/')) throw new Error('该位置仅支持图片文件');
  if (scene === 'audio' && file.type && !file.type.startsWith('audio/')) throw new Error('语音介绍仅支持音频文件');
  if (scene === 'video' && file.type && !file.type.startsWith('video/')) throw new Error('视频介绍仅支持视频文件');
  await assertMediaDuration(file, scene);
  const info = await getUploadInfo({ module, scene, filename: file.name, fileSize: file.size, mimeType: file.type });

  const putRes = await fetch(info.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      Authorization: info.authorization,
      'Content-Type': file.type || 'application/octet-stream',
    },
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '');
    throw new Error(`COS 上传失败(${putRes.status}) ${text?.slice(0, 180)}`);
  }

  return {
    url: info.fileUrl,
    cloudPath: info.cloudPath,
  };
}
