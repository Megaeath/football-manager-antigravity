# Requirement: Specialist Training System (Permanent Stat Boost) - Revised

## 1. Core Concept

ระบบฝึกซ้อมพิเศษสำหรับนักเตะแบบเจาะจง Attribute (Permanent Boost) ที่มีการหักค่าใช้จ่ายรายสัปดาห์ และเพิ่มพลังแบบสุ่มทุกวันจันทร์ โดยระดับความสามารถในการฝึกจะขึ้นอยู่กับเลเวลของ Facility (สนามฝึก)

---

## 2. Infrastructure & Costs (Leveling Table)

ระบบเลเวลสนามฝึก (Lv.1 - Lv.9) กำหนดเพดานการสุ่มเพิ่มพลังและค่าใช้จ่ายรายสัปดาห์ดังนี้:

| Level | Upgrade Cost (ราคาอัพเกรด) | Weekly Fee (ค่าจ้างโค้ช/สัปดาห์) | Max Gain Range (สุ่มสูงสุด) |
| :--- | :--- | :--- | :--- |
| 1 | 0 | 40,000 | 0.10 |
| 2 | 5,000,000 | 60,000 | 0.15 |
| 3 | 7,500,000 | 90,000 | 0.20 |
| 4 | 15,000,000 | 135,000 | 0.25 |
| 5 | 30,000,000 | 202,500 | 0.30 |
| 6 | 60,000,000 | 303,750 | 0.35 |
| 7 | 120,000,000 | 455,625 | 0.40 |
| 8 | 240,000,000 | 683,438 | 0.45 |
| 9 | 480,000,000 | 1,025,156 | 0.50 |

---

## 3. Training Logic & Execution

* **Slot Limitation:** ฝึกนักเตะได้สูงสุด **5 คนพร้อมกัน** (1 คน เลือกฝึกได้ 1 Attribute)
* **Weekly Update (Week Boundary):** ระบบจะทำงานเมื่อเข้า boundary รายสัปดาห์ใน game loop โดยมีลำดับขั้นตอนดังนี้:
    1. **Financial Validation:** ตรวจสอบยอดเงินคงเหลือเทียบกับ Weekly Fee
    2. **Processing:** หักเงินและสุ่มค่าพลัง (`random(0.1, MaxGain)`) หากเงินไม่พอจะ **skip ทั้งสัปดาห์** (ไม่หักเงิน, ไม่บวกพลัง)
    3. **Stat Update:** ค่าพลังที่สุ่มได้จะถูกบวกเข้าที่ Attribute หลักของนักเตะโดยตรง
* **Stat Cap:** ค่าพลังสูงสุดตันที่ **20.00**

---

## 4. Decimal & Calculation Rules (Critical)

* **Training Display:** ในหน้า Training เท่านั้นที่แสดงผล Attribute เป็นทศนิยม 2 ตำแหน่ง (เช่น Shooting: 14.52)
* **Global Logic (Match & Others):** ในระบบการคำนวณ Match Engine, การแสดงผลหน้า Squad หรือหน้าจออื่นๆ ให้ใช้ **"เลขจำนวนเต็มเท่านั้น" โดยวิธีตัดเศษทิ้ง (Floor)**
  * *ตัวอย่าง:* หากนักเตะมีค่า Shooting 14.99 ในหน้า Training -> ในการแข่งจริงจะถูกคำนวณด้วยค่า 14 เท่านั้น
  * *จุดประสงค์:* เพื่อให้การฝึกทศนิยมทุกๆ 0.1 มีความหมายเมื่อมันสะสมจนครบจำนวนเต็ม

---

## 5. UX/UI & Interaction Design (Mobile First)

ใช้ Style Guide: **Modern Dark Stadium** (Emerald Primary, Slate-950 Background)

### 5.1 Modal & Confirmation

* **Upgrade Facility:** เมื่อกดปุ่ม Upgrade ต้องมี **Modal Confirm** เด้งขึ้นมาเพื่อยืนยันการจ่ายเงินก้อนใหญ่ พร้อมสรุปรายละเอียดเลเวลถัดไป
* **Attribute Selection (Auto-Save):** การเลือกหรือเปลี่ยน Attribute ใน Dropdown ของนักเตะแต่ละคน **ไม่ต้องมีปุ่ม Confirm** ให้ใช้ระบบ `OnChange` เพื่อบันทึกลงฐานข้อมูลทันทีเมื่อมีการเลือกใหม่ เพื่อลดจำนวนคลิก (Smooth UX)

### 5.2 Layout Components

* **Facility Dashboard:** แสดง Level, รายจ่ายต่อสัปดาห์ และปุ่มอัพเกรด
* **Training Slots (5 Positions):** - แสดงชื่อ, รูป, ตำแหน่งนักเตะ
  * Dropdown Attribute (Auto-save on change)
  * สถานะไฟ (เขียว/แดง) และ Log พลังที่เพิ่มล่าสุด (เช่น +0.32)

---

## 6. Technical Guidance

* **Precision:** ใน Database ต้องเก็บค่าเป็น `Decimal(4,2)` หรือ `Float`
* **Display Logic:** - `page === 'training' ? stat.toFixed(2) : Math.floor(stat)`
* **Event Handling:** พัฒนา API สำหรับอัปเดต `training_focus` แบบทันทีเมื่อ UI ส่ง Event OnChange

---

## 7. Phase 1 Scope (Current)

* ฝั่ง process รายสัปดาห์ทำกับ **User Team เท่านั้น**
* ใช้ ledger รายสัปดาห์เพื่อกันการประมวลผลซ้ำ (`teamId + weekKey`)
