import { FileVideo, Trash2 } from 'lucide-react';
import type { StorageFile } from '@/types/storage';

function formatMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('th-TH');
}

export function StorageFileTable({ files, onDelete }: { files: StorageFile[]; onDelete: (id: string) => void }) {
  if (!files.length) {
    return (
      <div className="mt-8 rounded-[16px] border border-dashed border-[#5b4118] bg-[#0d0d0c] p-10 text-center text-[#9d968d]">
        ยังไม่มีไฟล์ในพื้นที่จัดเก็บ
      </div>
    );
  }

  return (
    <div className="mt-8 overflow-hidden rounded-[16px] border border-[#4b3615] bg-[#0d0d0c]">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-[#151412] text-[#9d968d]">
          <tr>
            <th className="px-5 py-4">ชื่อไฟล์</th>
            <th className="px-5 py-4">ประเภท</th>
            <th className="px-5 py-4">ขนาด</th>
            <th className="px-5 py-4">วันที่อัปโหลด</th>
            <th className="px-5 py-4 text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#4b3615] text-[#e7ded2]">
          {files.map((file) => (
            <tr key={file.id} className="hover:bg-[#151411]/[0.02]">
              <td className="px-5 py-4 font-bold text-[#f7f1e7]"><span className="inline-flex items-center gap-2"><FileVideo size={16} className="text-[#e3aa3a]" />{file.name}</span></td>
              <td className="px-5 py-4">{file.mimeType || '-'}</td>
              <td className="px-5 py-4">{formatMb(file.sizeBytes)}</td>
              <td className="px-5 py-4">{formatDate(file.createdAt)}</td>
              <td className="px-5 py-4 text-right">
                <button onClick={() => onDelete(file.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#201b12] text-[#ff9aa8] hover:bg-[#2a1828]" aria-label="ลบไฟล์">
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
