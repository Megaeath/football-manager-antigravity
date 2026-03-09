# 💰 Transfer Bid Management System - Implementation Complete

**Date**: March 8, 2026  
**Feature**: Incoming Bid Management with Accept/Reject/Negotiate

---

## 📋 Overview

เพิ่มระบบจัดการข้อเสนอซื้อนักเตะที่เข้ามายังทีมผู้เล่น ผู้เล่นสามารถตอบรับ/ปฏิเสธ/ต่อรองราคาได้ผ่านหน้า News Center พร้อมกับ AI ที่สามารถตัดสินใจตอบรับราคาที่เจรจาต่อได้

---

## ✨ Features Implemented

### 1. **API Endpoints** (2 New Routes)

#### `/api/market/incoming-bids` (GET)
- **Purpose**: ดึงรายการข้อเสนอที่รอดำเนินการ (PENDING bids) สำหรับทีมผู้เล่น
- **Parameters**: `teamId` (query string)
- **Returns**: 
  ```typescript
  {
    success: true,
    bids: IncomingBid[],
    count: number
  }
  ```

#### `/api/market/manage-bid` (POST)
- **Purpose**: จัดการข้อเสนอ (Accept/Reject/Negotiate)
- **Body**:
  ```typescript
  {
    bidId: string,
    action: 'ACCEPT' | 'REJECT' | 'NEGOTIATE',
    counterAmount?: number  // Required for NEGOTIATE
  }
  ```
- **Actions**:
  - **ACCEPT**: ยอมรับข้อเสนอ → สถานะเปลี่ยนเป็น ACCEPTED
  - **REJECT**: ปฏิเสธข้อเสนอ → สถานะเปลี่ยนเป็น REJECTED
  - **NEGOTIATE**: เสนอราคาสูงขึ้น
    - ตรวจสอบงบของ AI team
    - ถ้า AI มีเงินพอ → ยอมรับราคาใหม่ (update bid amount, keep PENDING)
    - ถ้า AI ไม่มีเงินพอ → ปฏิเสธอัตโนมัติ

---

### 2. **News Page Enhancement** (`/news`)

#### New Features:
1. **Incoming Offers Section**
   - แสดงข้อเสนอที่เข้ามาทั้งหมด (PENDING bids)
   - ข้อมูลที่แสดง:
     - ชื่อนักเตะ, ตำแหน่ง, อายุ
     - ทีมที่เสนอซื้อ
     - จำนวนเงินที่เสนอ
     - วันที่หมดอายุข้อเสนอ
   - สีพื้นหลังพิเศษ (gradient with primary color)
   - Border สีโดดเด่น

2. **Action Buttons** (3 ปุ่ม)
   - **✅ Accept** (สีเขียว) - ยอมรับข้อเสนอ
   - **💰 Negotiate** (สีส้ม) - ต่อรองราคา
   - **❌ Reject** (สีแดง) - ปฏิเสธข้อเสนอ

3. **Confirmation Modal**
   - เปิดเมื่อกดปุ่มใดปุ่มหนึ่ง
   - แสดงรายละเอียดการดำเนินการ
   - **สำหรับ Accept**:
     - แสดงจำนวนเงินที่จะได้รับ
     - แจ้งว่านักเตะจะโอนไปทีมใหม่
   - **สำหรับ Reject**:
     - คำเตือนว่าจะปฏิเสธถาวร
   - **สำหรับ Negotiate**:
     - Input field สำหรับใส่ราคาที่ต้องการ
     - Default: +15% จากราคาเดิม
     - Validation: ต้องสูงกว่าราคาเดิม
     - แสดงคำเตือนถ้าราคาสูงเกินความสามารถของ AI (based on reputation)
   - **Confirm/Cancel Buttons**
     - ป้องกันการกดผิด

4. **Badge Notification**
   - แสดงจำนวนข้อเสนอที่รอดำเนินการ
   - แสดงที่หัวข้อ "News Center"

---

### 3. **Sidebar Enhancement**

#### Badge Notification on News Icon
- แสดง badge สีแดงด้านขวาของเมนู "ข่าวสาร"
- แสดงจำนวนข้อเสนอที่รอดำเนินการ
- Auto-refresh ทุก 30 วินาที
- Styling:
  - Background: `#ef4444` (แดงสด)
  - Box shadow สำหรับความโดดเด่น
  - Position: absolute ด้านขวาของเมนู

---

## 🎯 User Flow

### Flow 1: Accept Offer
```
1. ผู้เล่นเข้าหน้า /news
2. เห็นข้อเสนอ + badge แจ้งเตือน
3. กดปุ่ม "✅ Accept"
4. Modal ขึ้นแสดงรายละเอียด
5. กด "Confirm"
6. ระบบ:
   - เปลี่ยนสถานะ bid → ACCEPTED
   - สร้างข่าว (News)
   - รีเฟรชหน้า → ข้อเสนอหายไป
7. เมื่อ window ปิด (1 เดือน):
   - นักเตะโอนไปทีมใหม่
   - เงินถูกโอนระหว่างทีม
```

### Flow 2: Reject Offer
```
1. ผู้เล่นกดปุ่ม "❌ Reject"
2. Modal แสดงคำเตือน
3. กด "Confirm"
4. ระบบ:
   - เปลี่ยนสถานะ bid → REJECTED
   - สร้างข่าว
   - ข้อเสนอหายไป
5. นักเตะอยู่ในทีมต่อ
```

### Flow 3: Negotiate (AI มีเงินพอ)
```
1. ผู้เล่นกดปุ่ม "💰 Negotiate"
2. Modal แสดง input field
3. ใส่ราคาที่ต้องการ (เช่น +15% = 1,150,000)
4. กด "Confirm"
5. ระบบตรวจสอบงบ AI:
   - AI team มีเงิน 2,000,000
   - ราคาที่เจรจา: 1,150,000
   - ✅ มีเงินพอ!
6. ระบบ:
   - อัพเดท bid.amount → 1,150,000
   - สถานะยังเป็น PENDING
   - สร้างข่าว "Counter-Offer Accepted"
7. เมื่อ window ปิด:
   - นักเตะโอนไปทีมใหม่
   - เงิน 1,150,000 ถูกโอน
```

### Flow 4: Negotiate (AI ไม่มีเงินพอ)
```
1. ผู้เล่นกดปุ่ม "💰 Negotiate"
2. ใส่ราคา 5,000,000
3. กด "Confirm"
4. ระบบตรวจสอบงบ AI:
   - AI team มีเงิน 2,000,000
   - ราคาที่เจรจา: 5,000,000
   - ❌ ไม่มีเงินพอ!
5. ระบบ:
   - เปลี่ยนสถานะ bid → REJECTED อัตโนมัติ
   - สร้างข่าว "Negotiation Failed"
   - แจ้งผู้เล่นว่า AI ไม่มีเงินพอ
6. ข้อเสนอถูกปฏิเสธ
```

---

## 🔧 Technical Implementation

### Database Schema (No Changes Needed)
ใช้ `Bid` model ที่มีอยู่แล้ว:
```prisma
model Bid {
  id          String   @id @default(cuid())
  playerId    String
  fromTeamId  String   // ทีมที่เสนอซื้อ
  toTeamId    String   // ทีมที่ถูกเสนอ (userTeam)
  amount      Int      // จำนวนเงิน (สามารถอัพเดทได้เมื่อ negotiate)
  status      String   // PENDING | ACCEPTED | REJECTED
  createdAt   DateTime
  windowEnds  DateTime
  ...
}
```

### API Response Handling

#### Success Response (Accept)
```json
{
  "success": true,
  "message": "Bid accepted. John Doe will transfer to Blue FC when the window closes."
}
```

#### Success Response (Negotiate - AI Accepted)
```json
{
  "success": true,
  "message": "Blue FC accepted your counter-offer of $1,150,000!",
  "newAmount": 1150000
}
```

#### Failure Response (Negotiate - AI Cannot Afford)
```json
{
  "success": false,
  "message": "Blue FC cannot afford $5,000,000. Bid rejected.",
  "aiRejected": true
}
```

---

## 📊 UI Components

### IncomingBid Card
```tsx
<div className="card" style={{
  padding: '1.5rem',
  border: '2px solid var(--primary)',
  background: 'linear-gradient(135deg, var(--bg) 0%, rgba(var(--primary-rgb), 0.05) 100%)'
}}>
  {/* Player info + amount + buttons */}
</div>
```

### Modal
- Overlay: `rgba(0,0,0,0.7)`
- Card: Max-width 500px, centered
- Click outside to close
- Click inside card: prevent propagation

### Buttons
- **Accept**: `#10b981` (green)
- **Negotiate**: `#f59e0b` (amber)
- **Reject**: `#ef4444` (red)

---

## 🎨 Styling Details

### Badge (Sidebar)
```css
background: #ef4444
color: white
font-size: 0.7rem
padding: 0.15rem 0.5rem
border-radius: 99px
box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4)
position: absolute
right: 12px
```

### Badge (News Header)
```css
background: var(--primary)
color: white
font-size: 0.75rem
padding: 0.25rem 0.75rem
border-radius: 99px
```

---

## 🧪 Testing Scenarios

### Test 1: Accept Bid
1. ส่ง bid จาก AI team มายัง user team
2. User เข้าหน้า /news
3. กด Accept → ตรวจสอบว่า modal ขึ้น
4. Confirm → ตรวจสอบว่า bid.status = ACCEPTED
5. ตรวจสอบ news ถูกสร้าง

### Test 2: Reject Bid
1. กด Reject → modal ขึ้น
2. Confirm → bid.status = REJECTED
3. ข้อเสนอหายจากหน้า /news

### Test 3: Negotiate (AI Accept)
1. กด Negotiate
2. ใส่ราคา 1,500,000 (AI มีเงิน 3,000,000)
3. Confirm
4. ตรวจสอบ:
   - bid.amount = 1,500,000
   - bid.status = PENDING (ยังคงรอ)
   - news: "Counter-Offer Accepted"

### Test 4: Negotiate (AI Reject)
1. กด Negotiate
2. ใส่ราคา 10,000,000 (AI มีเงิน 2,000,000)
3. Confirm
4. ตรวจสอบ:
   - bid.status = REJECTED
   - แสดง error message
   - news: "Negotiation Failed"

### Test 5: Badge Notification
1. สร้าง bid 3 รายการ
2. เข้า sidebar → ต้องเห็น badge "3" ที่เมนู "ข่าวสาร"
3. Accept 1 bid
4. Badge เปลี่ยนเป็น "2"

---

## 🚀 Performance Considerations

1. **Sidebar Badge**: 
   - Auto-refresh ทุก 30 วินาที
   - ไม่ block UI
   - Cleanup interval on unmount

2. **News Page**:
   - Fetch เมื่อเปิดหน้า
   - Re-fetch หลังจาก action สำเร็จ
   - Loading state ป้องกัน double-click

3. **Modal**:
   - Stop propagation บน card
   - Disable buttons เมื่อ processing
   - Close modal หลัง success

---

## 📝 Files Modified/Created

### New Files (2)
1. `/src/app/api/market/incoming-bids/route.ts` - Get incoming bids
2. `/src/app/api/market/manage-bid/route.ts` - Manage bid actions

### Modified Files (2)
1. `/src/app/news/page.tsx` - Enhanced with bid management UI
2. `/src/components/Sidebar.tsx` - Added badge notification

---

## 🎯 Future Enhancements (Optional)

1. **Multi-Bid Comparison**
   - แสดงข้อเสนอทั้งหมดสำหรับนักเตะคนเดียว
   - เปรียบเทียบราคา + reputation ของแต่ละทีม

2. **Player Preference**
   - นักเตะมี preference ว่าอยากไปทีมไหน
   - อิงจาก reputation, wages, playing time

3. **Negotiation History**
   - แสดงประวัติการต่อรอง
   - Track ว่ามีการ counter กี่ครั้ง

4. **Push Notifications**
   - แจ้งเตือนเมื่อมีข้อเสนอเข้ามา
   - Browser notification API

5. **Bid Expiry Countdown**
   - แสดงเวลานับถอยหลัง
   - Update real-time

---

## ✅ Checklist

- [x] API สำหรับดึงข้อเสนอที่เข้ามา
- [x] API สำหรับจัดการ bid (Accept/Reject/Negotiate)
- [x] UI แสดงข้อเสนอในหน้า /news
- [x] ปุ่ม Accept/Reject/Negotiate
- [x] Modal confirmation
- [x] Negotiate input field + validation
- [x] AI logic สำหรับตอบรับราคา counter
- [x] Badge notification ใน header
- [x] Badge notification ใน sidebar
- [x] Auto-refresh badge count
- [x] News creation สำหรับทุก action
- [x] Error handling
- [x] Loading states
- [x] Responsive design
- [x] TypeScript types

---

## 🎉 Summary

ระบบจัดการข้อเสนอซื้อนักเตะเสร็จสมบูรณ์แล้ว! ผู้เล่นสามารถ:
- ✅ เห็นข้อเสนอที่เข้ามาทั้งหมดในหน้า /news
- ✅ ตอบรับ/ปฏิเสธ/ต่อรองราคาได้
- ✅ ได้รับ notification badge เมื่อมีข้อเสนอใหม่
- ✅ AI จะตอบรับราคา counter ถ้ามีเงินพอ
- ✅ Modal confirmation ป้องกันการกดผิด

**Status**: ✅ Ready for Production  
**Build**: No errors  
**TypeScript**: All types defined  
**UI/UX**: Responsive + Mobile-friendly

