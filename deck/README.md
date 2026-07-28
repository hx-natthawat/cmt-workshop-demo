# deck — สไลด์เด็คงาน AI for MarTech Workshop

เด็ค HTML ไฟล์เดียว (`index.html`) เสิร์ฟผ่าน Cloudflare Pages ที่โดเมนจริงของงาน

## ปลายทาง

| อย่าง | ค่า |
|------|-----|
| โดเมนจริง | <https://cmt2026.harmonyx.co> |
| Pages alias | <https://cmt2026.pages.dev> |
| Pages project | `cmt2026` |
| Cloudflare account | Harmonyx · `60b088834829272a6ee94498be2ea356` |
| Zone | `harmonyx.co` |

## Redeploy

```bash
cd deck
./deploy.sh                     # deploy index.html ปัจจุบัน
./deploy.sh /path/to/new.html   # อัปเดต index.html จากไฟล์ใหม่ก่อน แล้ว deploy
```

ต้อง `wrangler login` ไว้ก่อน (บัญชี Harmonyx) — สคริปต์ตั้ง `CLOUDFLARE_ACCOUNT_ID` ให้เอง

## Custom domain (ตั้งครั้งเดียว — ทำไปแล้ว)

โดเมน `cmt2026.harmonyx.co` ผูกกับ Pages project `cmt2026` เรียบร้อย ต้องมี DNS record นี้ใน zone `harmonyx.co`:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `cmt2026` | `cmt2026.pages.dev` | Proxied (เมฆส้ม) |

> หมายเหตุ: wrangler OAuth token เพิ่ม custom domain ให้ Pages ได้ แต่ **สร้าง DNS record ไม่ได้** (ไม่มี scope `dns_records:edit`) — record ข้างบนสร้างผ่าน dashboard ครั้งเดียวจบ

## Cache

โดเมนจริงเสิร์ฟผ่าน Cloudflare CDN — หลัง deploy อาจเห็นเวอร์ชันเก่าค้างชั่วครู่
- รอไม่กี่นาทีให้ edge cache หมดอายุ หรือ hard refresh (Cmd+Shift+R)
- อยากให้เปลี่ยนทันทีก่อนขึ้นเวที: dashboard → `harmonyx.co` → Caching → Configuration → **Purge Everything**

## หมายเหตุ

- `index.html` ในโฟลเดอร์นี้คือ **source of truth** ของเด็คที่ deploy — แก้ที่นี่หรือใช้ `./deploy.sh <ไฟล์ใหม่>` ก็อปทับ
- `deploy.sh` / `README.md` ไม่ถูก deploy ขึ้นไปเสิร์ฟ (สคริปต์ stage เฉพาะ `index.html`)
