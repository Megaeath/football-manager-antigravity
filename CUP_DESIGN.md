# Prompt: Football Manager Cup Tournament Specification

Objective: สร้างระบบฟุตบอลถ้วย (Hybrid Format) สำหรับ 60 ทีม โดยแบ่งเป็นรอบแบ่งกลุ่มและรอบนัดเดียวจบ (Knockout) เพื่อเพิ่มจำนวนนัดและสร้างความตื่นเต้น

1. Tournament Structure (60 Teams)
Phase 1: Group Stage (รอบแบ่งกลุ่ม)

แบ่ง 60 ทีมออกเป็น 12 กลุ่ม (กลุ่มละ 5 ทีม)

ระบบการแข่ง: พบกันหมดในกลุ่ม (Single Round Robin) ทีมละ 4 นัด

การให้คะแนน: ชนะ 3, เสมอ 1, แพ้ 0

การเข้ารอบ:

แชมป์กลุ่ม (12 ทีม) เข้ารอบ Knockout ทันที

อันดับ 2 ที่ดีที่สุด (Best Runner-ups) จำนวน 4 ทีม เข้ารอบเพื่อรวมให้ครบ 16 ทีม

Phase 2: Knockout Stage (รอบนัดเดียวจบ)

เริ่มจากรอบ 16 ทีม -> 8 ทีม -> 4 ทีม -> ชิงชนะเลิศ

Rule: หากเสมอในเวลา 90 นาที ต้องต่อเวลาพิเศษ (Extra Time) และยิงจุดโทษ (Penalty Shootout) เพื่อหาผู้ชนะเท่านั้น

1. Match Logic & Scheduling
Timing: แข่งขันทุกวันพุธ (Mid-week) เพื่อสลับกับบอลลีกวันเสาร์

Neutral Ground: รอบ Knockout ให้ใช้ระบบสุ่มเจ้าบ้าน หรือใช้สนามกลาง (ไม่มี Home Advantage)

Squad Management: - ความเหนื่อยล้า (Fatigue) และอาการบาดเจ็บจากบอลถ้วยต้องส่งผลต่อบอลลีก

สะสมใบเหลือง/ใบแดงแยกจากบอลลีก (Cup Suspension)

1. Database & State Management
Table tournament_groups: เก็บข้อมูลกลุ่ม (Group A-L), รายชื่อทีมในกลุ่ม และคะแนน (Table Standings)

Table tournament_matches: เก็บตารางแข่ง, ผลสกอร์ และสถานะนัด (Upcoming, Live, Finished)

Table tournament_bracket: เก็บโครงสร้างการประกบคู่รอบ Knockout (Seed 1 vs Seed 16, etc.)

1. UI/UX Requirements (Mobile First)
Group View: - หน้าจอแสดงตารางคะแนน 12 กลุ่ม (ใช้แนวนอนสไลด์สลับกลุ่ม หรือ Dropdown เลือกกลุ่ม)

Highlight ทีมของผู้เล่นด้วยสี Emerald-500

Bracket View:

แสดงสายการแข่งรอบ 16 ทีมสุดท้ายแบบ Tree Structure

สามารถใช้นิ้วลาก (Pan) และซูม (Zoom) ดูสายการแข่งได้

Path Glow: เมื่อแตะที่ทีมใดทีมหนึ่ง ให้เรืองแสงเส้นทางที่ทีมนั้นต้องผ่านไปจนถึงรอบชิง

Match Card:

แสดงสกอร์รวม และสกอร์จุดโทษ (ถ้ามี) เช่น Team A 1-1 Team B (P 4-5)

1. Technical Rules for AI Code Generation
Tie-breaker: กรณีแต้มเท่าในรอบกลุ่ม ให้วัดจาก 1. ผลต่างประตูได้เสีย 2. ประตูได้ 3. Head-to-Head

Seeding Logic: ในรอบ 16 ทีม ทีมที่เป็นแชมป์กลุ่มที่มีคะแนนสูงสุด 8 ทีมแรก จะถูกจัดเป็น "ทีมวาง" เพื่อไม่ให้เจอกันเองในรอบแรกของ Knockout

Status Update: เมื่อจบการแข่งวันพุธ ต้องอัปเดตสถานะผู้ชนะเข้าสู่รอบถัดไปอัตโนมัติ
