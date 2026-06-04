import { getUploadInfo } from '@/services/api';

export async function uploadFileToCosBySts(params: {
  module: string;
  scene: string;
  file: File;
}) {
  const { module, scene, file } = params;
  const info = await getUploadInfo({ module, scene, filename: file.name });

  const putRes = await fetch(info.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      Authorization: info.authorization,
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
