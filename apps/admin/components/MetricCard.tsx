export function MetricCard({ label, value, hint, danger = false }: { label: string; value: string; hint: string; danger?: boolean }) {
  return (
    <div className={`rounded-[12px] border p-5 shadow-[0_18px_44px_rgba(0,0,0,.18)] ${danger ? 'border-[#8f1d23] bg-[#321014]' : 'border-[#274262] bg-gradient-to-br from-[#071320] to-[#060b12]'}`}>
      <p className="text-[12px] font-black text-[#95a9c4]">{label}</p>
      <p className="mt-2 text-[28px] font-black text-[#f7f1e7]">{value}</p>
      <p className="mt-2 text-[12px] font-semibold text-[#7f96b2]">{hint}</p>
    </div>
  );
}
