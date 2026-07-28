# Demo Prompts — Session 1 (คัดลอกใช้ตามลำดับ)

## Prompt 1 · Explore

คุณคือ senior data analyst ของแบรนด์ beauty e-commerce ในประเทศไทย ข้าพเจ้าแนบไฟล์ข้อมูลลูกค้า 300 ราย (คอลัมน์: channel, category, recency, orders, spend, consent) กรุณาสำรวจข้อมูลและสรุปข้อค้นพบสำคัญ 5 ประการต่อการวางแผนการตลาด ตอบเป็นภาษาไทย พร้อมตัวเลขอ้างอิงจากข้อมูลจริงทุกข้อ

## Prompt 2 · Analyze (RFM)

จากข้อมูลเดิม กรุณาจัดทำ RFM segmentation (ใช้ recency_days, total_orders, total_spend_thb) แบ่งลูกค้าเป็น 4-5 segments ตั้งชื่อ segment เป็นภาษาไทยที่ทีมการตลาดจดจำง่าย ตอบเป็นตาราง: ชื่อ segment / จำนวน / ลักษณะเด่น / มูลค่าต่อธุรกิจ พร้อมอธิบายเกณฑ์การแบ่ง

## Prompt 3 · Recommend + Artifact

เลือก segment ที่มีศักยภาพสร้างรายได้เพิ่มสูงสุด 1 กลุ่ม จัดทำแผนแคมเปญ: เป้าหมาย ช่องทาง (อ้างอิง main_channel และ line_oa_member ของกลุ่ม) ข้อความตัวอย่าง 2 รูปแบบ และ KPI ที่ควรวัด โดยคำนึงถึง pdpa_marketing_consent จากนั้นสร้าง interactive dashboard สรุปภาพรวมทั้งหมด

---

## Vibe Coding สาธิตสด (สไลด์ 28 ในเด็ค 81 สไลด์ — ซ้อมให้คล่อง)

เปลี่ยนสีปุ่มใน utm_builder.html เป็นสีเขียว แล้วเพิ่มปุ่ม reset ที่ล้างทุกช่องกรอก
