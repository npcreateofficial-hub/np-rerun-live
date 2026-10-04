import { apiData, createVideo } from '../../_mock/store';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('file');
  const rawTitle = form.get('title');
  const rawLiveChannelId = form.get('liveChannelId');
  const fileName = file instanceof File ? file.name : null;
  const title = String(rawTitle || fileName?.replace(/\.mp4$/i, '') || 'วิดีโอใหม่');
  const liveChannelId = String(rawLiveChannelId || '') || null;
  const sizeMb = file instanceof File ? Number((file.size / 1024 / 1024).toFixed(2)) : null;
  const safeName = `${Date.now()}-${(fileName || `${title}.mp4`).replace(/[^\w.-]+/g, '_')}`;

  if (file instanceof File) {
    const bytes = await file.arrayBuffer();
    await writeFile(path.join(process.cwd(), 'public', 'uploads', safeName), Buffer.from(bytes));
  }

  return apiData(createVideo({
    title,
    liveChannelId,
    sourceUrl: `/uploads/${safeName}`,
    file: null,
    fileName: safeName,
    sizeMb,
  }));
}
