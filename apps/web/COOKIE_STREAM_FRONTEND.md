# Cookie-based Shopee stream frontend

Frontend flow นี้ไม่รับ Partner ID, Partner Key, RTMP URL, Stream Key หรือ Live Session ID จากผู้ใช้

## API ที่หน้าเว็บเรียก

### เพิ่มบัญชี

1. `POST /api/live-channels/check-cookie`
2. `POST /api/live-channels`

Payload:

```json
{
  "platform": "SHOPEE",
  "cookie": "SPC_EC=...; SPC_ST=...;",
  "proxyId": null
}
```

### เริ่มไลฟ์

`POST /api/reruns/start`

```json
{
  "liveChannelId": "live-channel-id",
  "videoId": "ready-video-id",
  "title": "ชื่อรอบรีรัน"
}
```

Backend ต้องทำต่อเองตามลำดับ:

1. ตรวจ Cookie/Session
2. สร้าง Shopee Live Session
3. อัปโหลด/ตั้งค่ารูปหน้าปก
4. ปักสินค้าเข้าตะกร้า
5. ดึง RTMP push URL และ stream key
6. เปิด FFmpeg
7. เริ่ม Live Session
8. บันทึก `liveSessionId` และสถานะ LIVE

## จุดที่ปรับ

- หน้าเพิ่มบัญชีเหลือ Cookie + Proxy
- เอา Live URL / Session ID ออกจากฟอร์มเพิ่มบัญชี
- เอาช่องกรอก RTMP / Stream Key ออกจากหน้ารีรัน
- ปุ่มเริ่มเปลี่ยนเป็น “สร้างสตรีมและขึ้นไลฟ์”
- หน้าแก้ไขบัญชีอธิบายการสร้าง Session/RTMP อัตโนมัติ
- หน้า Accounts ตรวจสถานะ Cookie ก่อนส่งคำสั่งเริ่มไลฟ์
