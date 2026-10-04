export function formatMoney(value: number) { return `฿${value.toLocaleString('th-TH')}`; }
export function formatMb(value: number) { return `${value.toLocaleString('th-TH', { maximumFractionDigits: 2 })} MB`; }
export function formatDate(value: string) { return new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
