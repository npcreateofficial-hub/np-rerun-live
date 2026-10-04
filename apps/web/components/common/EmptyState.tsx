export function EmptyState({ title='ยังไม่มีข้อมูล', description='เมื่อมีข้อมูล ระบบจะแสดงที่ส่วนนี้' }: { title?: string; description?: string }) {
  return <div className="rounded-2xl border border-dashed border-line p-10 text-center"><b>{title}</b><p className="mt-2 text-sm text-[#9d968d]">{description}</p></div>;
}
