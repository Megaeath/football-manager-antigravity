# PROMPT: Swiss Model Tournament System Specification

จงใช้ข้อมูลด้านล่างนี้เป็นข้อกำหนดหลักในการสร้างระบบบอลถ้วย (Tournament) สำหรับ 60 ทีม โดยใช้ระบบ Swiss Model เป็นหลักก่อนเข้าสู่รอบ Knockout

---

## 1. Swiss Model Logic (Phase 1: Qualification)

- **Total Teams:** 60 ทีม (ไม่แบ่งกลุ่ม แต่อยู่ในตารางคะแนนเดียว 1-60)
- **Number of Rounds:** กำหนดให้แข่งทั้งหมด **8 รอบ (8 Rounds)** ต่อทีม
- **Pairing Algorithm (หัวใจสำคัญ):**
    1. **Round 1:** สุ่มจับคู่ทั้งหมด 30 คู่
    2. **Round 2 เป็นต้นไป:** ทีมที่มีคะแนน (Points) เท่ากันหรือใกล้เคียงกันต้องเจอกันเอง (เช่น ทีม 3 แต้ม เจอ 3 แต้ม)
    3. **Legal Match Rule:** ห้ามทีมเดิมเจอกันซ้ำเกิน 1 ครั้งในรอบ Swiss (ต้องเช็ก Match History เสมอ)
    4. **Bye Rule:** หากมีจำนวนทีมคี่ (ซึ่งในที่นี้ 60 ทีมเป็นคู่จึงไม่มีปัญหา) ทีมที่ได้ Bye จะได้ 3 แต้มอัตโนมัติ
- **Ranking & Tie-breakers:** หากคะแนนเท่ากัน ให้ใช้เกณฑ์ตัดสินตามลำดับ:
    1. **Buchholz System:** ผลรวมคะแนนของคู่ต่อสู้ทั้งหมดที่ทีมนั้นเคยเจอมา (ทีมที่เจอคู่แข่งโหดกว่าจะได้อันดับสูงกว่า)
    2. **Goal Difference (GD)**
    3. **Goals For (GF)**

---

## 2. Transition to Knockout (Phase 2)

- เมื่อจบครบ 8 รอบ ทีมที่อยู่อันดับ **1 - 16** ในตาราง Swiss จะผ่านเข้าสู่รอบ **Round of 16**
- **Knockout Rules:** แข่งนัดเดียวจบ (Single Elimination)
- **Extra Logic:** หากเสมอใน 90 นาที ต้องมีต่อเวลาพิเศษ (Extra Time) และยิงจุดโทษ (Penalty Shootout)

---

## 3. Database Schema Requirements

- **Table `swiss_standings`:** เก็บ id_team, played, win, draw, loss, points, gd, gf, buchholz_score
- **Table `swiss_matches`:** เก็บ round_number, home_team_id, away_team_id, score_home, score_away, status (pending/finished)
- **Table `match_history`:** เก็บ record คู่ที่เคยเจอกันแล้วเพื่อป้องกันการจับคู่ซ้ำในระบบ Swiss

---

## 4. UX/UI Design Guidelines (Mobile First)

### 4.1 Live Swiss Table

- **Visual Cut-off:** แสดงเส้นแบ่งสีแดงหรือเรืองแสงที่ **อันดับ 16** เพื่อให้ผู้เล่นรู้สถานะการเข้ารอบชัดเจน
- **Player Focus:** Pin ทีมของผู้เล่นไว้ที่แถบสว่างหรือ Floating Bar เมื่อผู้เล่นไถหน้าจอลงลึก
- **Form Indicator:** แสดงสัญลักษณ์ W-D-L-W-W ของ 5 นัดล่าสุดในตาราง

### 4.2 Matchmaking & Progress

- **Next Match View:** เนื่องจากระบบ Swiss ไม่รู้ล่วงหน้าว่ารอบหน้าจะเจอใคร UI ต้องแสดงสถานะ "Waiting for all matches to finish" ก่อนจะทำการ Draw รอบถัดไป
- **Tournament Path:** ทำเป็น Horizontal Stepper (8 Dots) เพื่อบอกว่าตอนนี้ผู้เล่นอยู่ที่รอบไหน (เช่น Round 4/8)

### 4.3 Bracket View (Final 16)

- เมื่อเข้าสู่รอบ 16 ทีม ให้เปลี่ยน UI เป็นแบบสายการแข่ง (Tree Bracket) ที่สามารถ Pan และ Zoom ได้

---

## 5. Technical Constraints for AI

- **Algorithm Complexity:** การจับคู่ในรอบ Swiss ต้องมีระบบ Re-roll หรือ Backtracking หากเกิดกรณีที่ทีมคะแนนเท่ากันเคยเจอกันหมดแล้ว
- **Stat Consistency:** ค่าพลังนักเตะในแมตช์ต้องใช้ `Math.floor()` ตามกฎหลักของโปรเจกต์
- **Performance:** การคำนวณ Buchholz Score ต้องอัปเดตทุกครั้งที่จบแต่ละรอบ (เพราะคะแนนคู่แข่งเปลี่ยน)

---

**Task:** จงสร้างไฟล์ `SwissTournament.ts` สำหรับจัดการ Logic การจับคู่ (Pairing) และ `SwissTable.tsx` สำหรับแสดงผลตารางคะแนนตามข้อกำหนดนี้
