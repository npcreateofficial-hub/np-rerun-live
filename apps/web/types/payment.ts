export type PaymentStatus = 'PENDING' | 'PAID' | 'REJECTED';

export type PaymentItem = {
  id: string;
  userId: string;
  amountBaht: number;
  method: string | null;
  status: PaymentStatus | string;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
  slipImageUrl?: string | null;
};

export type CreatePaymentPayload = {
  amountBaht: number;
  method: string;
  reference?: string | null;
};

