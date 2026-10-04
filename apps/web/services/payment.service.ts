import { api } from '@/lib/api';
import type { CreatePaymentPayload, PaymentItem } from '@/types/payment';

export const paymentService = {
  list() {
    return api<PaymentItem[]>('/payments');
  },
  create(payload: CreatePaymentPayload) {
    return api<PaymentItem>('/payments', { method: 'POST', body: JSON.stringify(payload) });
  },
  uploadSlip(payload: { amountBaht: number; slip: File }) {
    const form = new FormData();
    form.append('amountBaht', String(payload.amountBaht));
    form.append('slip', payload.slip);
    return api<PaymentItem>('/payments/slip', { method: 'POST', body: form });
  },
};

