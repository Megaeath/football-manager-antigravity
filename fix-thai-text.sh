#!/bin/bash
# Thai to English replacement script for Football Manager project

echo "🔄 Converting remaining Thai text to English..."

# Fix match/page.tsx
sed -i '' 's/กำลังโหลดสนามแข่ง/Loading match/g' src/app/match/page.tsx
sed -i '' 's/หน้าประตู/Attacking Third/g' src/app/match/page.tsx
sed -i '' 's/กำลังประมวลผลการแข่งขัน/Processing match/g' src/app/match/page.tsx
sed -i '' 's/วันแข่งขัน (Match Day)/Match Day/g' src/app/match/page.tsx
sed -i '' 's/จำลองทีมอื่นและไปวันถัดไป/Simulate other teams and advance/g' src/app/match/page.tsx
sed -i '' 's/ไปยังวันถัดไป (Next Process)/Advance to next day/g' src/app/match/page.tsx
sed -i '' 's/ไม่มีการแข่งขันในวันนี้/No matches today/g' src/app/match/page.tsx
sed -i '' 's/จัดทีมก่อนเริ่มแข่ง/Configure team before match/g' src/app/match/page.tsx
sed -i '' 's/จัดทีมก่อนแข่ง/Configure team/g' src/app/match/page.tsx
sed -i '' 's/เริ่มแข่ง/Start Match/g' src/app/match/page.tsx

# Fix squad/page.tsx
sed -i '' 's/จัดการทีม (Squad Management)/Squad Management/g' src/app/squad/page.tsx
sed -i '' 's/ทีมปัจจุบัน/Current Team/g' src/app/squad/page.tsx
sed -i '' 's/วางแผนการเล่นและกำหนดกลยุทธ์/Plan tactics and strategy/g' src/app/squad/page.tsx

# Fix squad/SquadClient.tsx
sed -i '' 's/Preset \${key}: ไม่มีตัวที่จัดตำแหน่งอยู่/Preset \${key}: No players assigned/g' src/app/squad/SquadClient.tsx
sed -i '' 's/พร้อมเริ่มแข่งแล้วใช่ไหม/Ready to start the match/g' src/app/squad/SquadClient.tsx
sed -i '' 's/คู่แข่ง/Opponent/g' src/app/squad/SquadClient.tsx
sed -i '' 's/ดูคู่แข่ง/View opponent/g' src/app/squad/SquadClient.tsx
sed -i '' 's/กำลังเริ่มเกม/Starting match/g' src/app/squad/SquadClient.tsx

# Fix player/[id]/page.tsx
sed -i '' 's/อายุ \${player.age} ปี/\${player.age} years old/g' src/app/player/\[id\]/page.tsx

# Fix player/[id]/PlayerContent.tsx
sed -i '' 's/ประวัติย้ายทีม/Transfer History/g' src/app/player/\[id\]/PlayerContent.tsx
sed -i '' 's/สถิติการเล่นรายฤดูกาล\/สโมสร/Seasonal\/Club Statistics/g' src/app/player/\[id\]/PlayerContent.tsx
sed -i '' 's/หน้าประตู/Attacking Third/g' src/app/player/\[id\]/PlayerContent.tsx
sed -i '' 's/ประตู/Goals/g' src/app/player/\[id\]/PlayerContent.tsx
sed -i '' 's/แอสซิสต์/Assists/g' src/app/player/\[id\]/PlayerContent.tsx
sed -i '' 's/เรตติ้ง/Rating/g' src/app/player/\[id\]/PlayerContent.tsx
sed -i '' 's/ไม่มีสถิติการเล่น/No match statistics/g' src/app/player/\[id\]/PlayerContent.tsx
sed -i '' 's/ไม่มีประวัติการย้ายทีม/No transfer history/g' src/app/player/\[id\]/PlayerContent.tsx
sed -i '' 's/ทีม/Team/g' src/app/player/\[id\]/PlayerContent.tsx
sed -i '' 's/ลงเล่น/Appearances/g' src/app/player/\[id\]/PlayerContent.tsx
sed -i '' 's/ยังไม่มีสถิติการเล่น/No statistics yet/g' src/app/player/\[id\]/PlayerContent.tsx

# Fix analysis/popularity/page.tsx
sed -i '' 's/ความดังของนักเตะตามตำแหน่ง/Player Popularity by Position/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/วิเคราะห์ความสมดุลของความดังในแต่ละตำแหน่ง/Analyzing popularity balance across positions/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/สรุปความดังตามตำแหน่ง/Popularity Summary by Position/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/ตำแหน่ง/Position/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/ชื่อ/Name/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/ทีม/Team/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/อายุ/Age/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/ประตู\/แอสซิสต์/Goals\/Assists/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/ความดังเฉลี่ย/ Average Popularity/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/ค่าเฉลี่ยความดังของทั้งตำแหน่ง/Average popularity for this position/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/ถ่วงน้ำหนัก/Weighted/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/คำนวณโดยพิจารณาจำนวนเกมที่เล่น/Calculated based on matches played/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/ช่วง/Range/g' src/app/analysis/popularity/page.tsx
sed -i '' 's/ค่าต่ำสุด-สูงสุดของความดังในตำแหน่ง/Min-max popularity in position/g' src/app/analysis/popularity/page.tsx

# Fix league/fixtures/page.tsx
sed -i '' 's/ผลการแข่งขัน (Fixtures \& Results)/Fixtures \& Results/g' src/app/league/fixtures/page.tsx
sed -i '' 's/ไม่พบข้อมูลการแข่งขัน/No matches found/g' src/app/league/fixtures/page.tsx

# Fix league/stats/page.tsx
sed -i '' 's/สถิติผู้เล่น (Player Stats)/Player Statistics/g' src/app/league/stats/page.tsx
sed -i '' 's/ดาวซัลโว (Top Scorers)/Top Scorers/g' src/app/league/stats/page.tsx

echo "✅ Conversion complete!"
echo "Please run 'npm run build' to verify."
