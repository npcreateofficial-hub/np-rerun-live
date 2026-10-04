# NP LIVE API (RERUN backend)

Backend สำหรับระบบรีรันไลฟ์ — Express + TypeScript + Prisma (SQLite) + FFmpeg

## เริ่มใช้งาน (ครั้งแรก)

```powershell
cd apps/api
npm install
copy .env.example .env   # หรือใช้ .env ที่มีให้แล้ว
npm run setup            # prisma generate + db push + seed ข้อมูลตัวอย่าง
npm run dev              # เปิดเซิร์ฟเวอร์ที่ http://localhost:4000/api
```

บัญชีทดสอบหลัง seed: `demo@nplive.local` / `demo1234`

จากนั้นเปิด frontend อีกเทอร์มินัล:

```powershell
cd apps/web
npm run dev              # http://localhost:3000
```

## โหมด Shopee

ควบคุมด้วย `SHOPEE_LIVE_MODE` ใน `.env`

### MOCK (ค่าเริ่มต้น `false`)
ทุกอย่างทำงานครบ end-to-end โดยไม่ต้องแตะ Shopee จริง — ตรวจคุกกี้ผ่านเสมอถ้ารูปแบบถูก
และ "สร้าง session" จะคืน push target ปลายทางที่ตั้งค่าได้สำหรับทดสอบ FFmpeg:

```
SHOPEE_MOCK_RTMP_URL=rtmp://127.0.0.1:1935/live
SHOPEE_MOCK_STREAM_KEY=test_xxx
```

ชี้ไปที่ RTMP server ทดสอบของคุณเอง (เช่น nginx-rtmp / Restream) เพื่อทดสอบว่า
FFmpeg push วิดีโอขึ้นไลฟ์ได้จริง

### LIVE (`true`) — ต่อ Shopee จริง
ต้องกรอก endpoint จริงของ Shopee ที่จับจากเซสชัน seller ของคุณลงใน `.env`:

```
SHOPEE_ACCOUNT_INFO_URL=...     # ตรวจบัญชีจากคุกกี้
SHOPEE_CREATE_SESSION_URL=...   # สร้างห้องไลฟ์ + คืน push_url/stream_key
SHOPEE_END_SESSION_URL=...      # (ทางเลือก) ปิดห้องไลฟ์
SHOPEE_USER_AGENT=...
```

เพื่อความปลอดภัย ระบบจะส่งคุกกี้ไปเฉพาะ endpoint ที่เป็น `https://` และอยู่ใต้โดเมน
`*.shopee.co.th` เท่านั้น เช่น `seller.shopee.co.th`, `creator.shopee.co.th`,
หรือ `live.shopee.co.th` หากตั้งค่าเป็นโดเมนอื่น ระบบจะปฏิเสธก่อนส่ง request
เพื่อป้องกันคุกกี้รั่วไหล

จากนั้นปรับ mapping ฟิลด์ response ในไฟล์ `src/shopee.ts`
(ฟังก์ชัน `liveCheckCookie` / `liveCreateSession`) ให้ตรงกับที่ Shopee คืนมา

> หมายเหตุ: Shopee Live ไม่มี public API — ส่วน LIVE นี้ต้องใช้ endpoint ภายในซึ่ง
> อาจเปลี่ยนแปลงและอยู่ภายใต้ ToS ของ Shopee โปรดใช้ด้วยความรับผิดชอบ

## Flow การรีรัน

```
POST /api/reruns/start { liveChannelId, videoId, title }
  1. ตรวจสิทธิ์/คุกกี้/วิดีโอ READY/โควตา
  2. shopee.createSession(cookie) -> { liveSessionId, rtmpUrl/push_url, streamKey ถ้ามี }
  3. บันทึก session ลงบัญชี + rerun, ตั้ง isOnline = true
  4. FFmpeg push วิดีโอ (วนลูป) ไปยัง push_url ที่ Shopee คืนมา -> สถานะ LIVE
POST /api/reruns/:id/stop  -> หยุด FFmpeg + ปิด session
```

Frontend flow ไม่รับ `RTMP URL` หรือ `Stream Key` จากผู้ใช้ การขึ้นไลฟ์จริงต้องให้
`SHOPEE_CREATE_SESSION_URL` สร้างห้องและคืน `push_url` อัตโนมัติ

ต้องมี FFmpeg — โปรเจกต์ใช้ `ffmpeg-static` (มาพร้อม ไม่ต้องติดตั้งเอง)
หรือกำหนด `FFMPEG_PATH` เองใน `.env`
