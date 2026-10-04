import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError, asyncHandler, ok } from '../http';
import { requireAuth, type AuthedRequest } from '../auth';
import { createUploadImage } from '../uploads';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

const createPaymentBody = z.object({
  amountBaht: z.coerce.number().min(1, 'จำนวนเงินต้องมากกว่า 0'),
  method: z.string().min(1).max(80).default('PROMPTPAY'),
  reference: z.string().max(200).optional().nullable(),
});

const slipPaymentBody = z.object({
  amountBaht: z.coerce.number().min(1, 'จำนวนเงินต้องมากกว่า 0'),
  reference: z.string().max(200).optional().nullable(),
});

const slipUpload = createUploadImage();

paymentsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const payments = await prisma.payment.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return ok(res, payments);
  }),
);

paymentsRouter.post(
  '/slip',
  slipUpload.single('slip'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = slipPaymentBody.parse(req.body);
    const file = req.file;
    if (!file) throw new AppError('กรุณาแนบสลิปโอนเงิน', 400);

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new AppError('ไม่พบผู้ใช้', 404);

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        amountBaht: body.amountBaht,
        method: 'BANK_TRANSFER',
        reference: body.reference || `SLIP-${Date.now()}`,
        status: 'PENDING',
        slipImageUrl: `/uploads/${path.basename(file.path)}`,
      },
    });

    return ok(res, payment, 'ส่งสลิปให้แอดมินตรวจสอบแล้ว', 201);
  }),
);

paymentsRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = createPaymentBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new AppError('ไม่พบผู้ใช้', 404);

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        amountBaht: body.amountBaht,
        method: body.method,
        reference: body.reference || `TOPUP-${Date.now()}`,
        status: 'PENDING',
      },
    });

    return ok(res, payment, 'สร้างรายการเติมเงินสำเร็จ กรุณารอเจ้าหน้าที่ตรวจสอบ', 201);
  }),
);

