import { FolderClosed } from 'lucide-react';
import type { StorageFolder } from '@/types/storage';

export function StorageFolderList({ folders }: { folders: StorageFolder[] }) {
  return (
    <section className="mt-8 rounded-[16px] bg-[#10100f]/45 p-6">
      <h2 className="mb-4 text-[18px] font-extrabold text-[#f7f1e7]">โฟลเดอร์</h2>
      {folders.length ? (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {folders.map((folder) => (
            <article key={folder.id} className="rounded-xl border border-[#4b3615] bg-[#0d0d0c] p-4 text-[#f7f1e7]">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[#201b12] text-[#e3aa3a]"><FolderClosed size={20} /></div>
              <b>{folder.name}</b>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#5b4118] p-6 text-center text-[#9d968d]">ยังไม่มีโฟลเดอร์</div>
      )}
    </section>
  );
}
