#!/bin/bash
echo "🔄 Fixing component files..."

# Fix TacticsForm.tsx
sed -i '' 's/ใช้เมื่อเกมเสมอกัน - สมดุลระหว่างการโจมตีและการป้องกัน/Used when match is level - Balanced approach/g' src/components/TacticsForm.tsx
sed -i '' 's/ใช้เมื่อทีมตามไป - เน้นการโจมตีมากขึ้น/Used when team is behind - Attacking focus/g' src/components/TacticsForm.tsx
sed -i '' 's/ใช้เมื่อทีมนำหน้า - เน้นการป้องกัน/Used when team is leading - Defensive focus/g' src/components/TacticsForm.tsx

# Fix PlayerModal.tsx
sed -i '' 's/กำลังโหลดข้อมูล/Loading data/g' src/components/PlayerModal.tsx
sed -i '' 's/• อายุ \${player.age} ปี/• \${player.age} years old/g' src/components/PlayerModal.tsx
sed -i '' 's/การย้ายทีม/Transfer History/g' src/components/PlayerModal.tsx
sed -i '' 's/ประตู/Goals/g' src/components/PlayerModal.tsx
sed -i '' 's/แอสซิสต์/Assists/g' src/components/PlayerModal.tsx
sed -i '' 's/เล่นแล้ว/Minutes Played/g' src/components/PlayerModal.tsx
sed -i '' 's/นัดเล่น/Matches Played/g' src/components/PlayerModal.tsx
sed -i '' 's/พื้นที่การเล่น (คลิกเพื่อกรอง)/Field Zones (click to filter)/g' src/components/PlayerModal.tsx
sed -i '' 's/ไม่มีข้อมูลการแข่งขันในฤดูกาลนี้/No matches this season/g' src/components/PlayerModal.tsx
sed -i '' 's/ยังไม่มีประวัติการแข่งขันในฤดูกาลนี้/No match history this season/g' src/components/PlayerModal.tsx
sed -i '' 's/ประวัติการย้ายทีม/Transfer History/g' src/components/PlayerModal.tsx
sed -i '' 's/ไม่มีประวัติการย้ายทีม/No transfer history/g' src/components/PlayerModal.tsx
sed -i '' 's/สถิติตามฤดูกาล/Seasonal Statistics/g' src/components/PlayerModal.tsx
sed -i '' 's/ทีม/Team/g' src/components/PlayerModal.tsx
sed -i '' 's/ลงเล่น/Appearances/g' src/components/PlayerModal.tsx
sed -i '' 's/ยังไม่มีสถิติการเล่น/No statistics yet/g' src/components/PlayerModal.tsx

# Fix NextProcessButton.tsx
sed -i '' 's/มีการแข่งขันทีมของคุณในวันนี้! กรุณาดำเนินการต่อที่สนามแข่ง/You have a match today! Please proceed to the match page/g' src/components/NextProcessButton.tsx
sed -i '' 's/กำลังประมวลผลการแข่งขัน/Processing match/g' src/components/NextProcessButton.tsx
sed -i '' 's/กำลังประมวลผล/Processing/g' src/components/NextProcessButton.tsx
sed -i '' 's/🏁 ไปวันถัดไป (Next Process)/🏁 Advance to Next Day/g' src/components/NextProcessButton.tsx

# Fix Breadcrumbs.tsx
sed -i '' "s/'จัดการทีม'/'Squad'/g" src/components/Breadcrumbs.tsx
sed -i '' "s/'จำลองการแข่ง'/'Match'/g" src/components/Breadcrumbs.tsx
sed -i '' "s/'ผลการแข่งขัน'/'Fixtures'/g" src/components/Breadcrumbs.tsx
sed -i '' "s/'สถิติผู้เล่น'/'Player Stats'/g" src/components/Breadcrumbs.tsx
sed -i '' "s/'ตารางคะแนน'/'League Table'/g" src/components/Breadcrumbs.tsx
sed -i '' "s/'ข้อมูลทีม'/'Team Info'/g" src/components/Breadcrumbs.tsx

# Fix TransferTab.tsx
sed -i '' "s/คุณแน่ใจหรือไม่ที่จะปล่อยตัว \${playerName} ออกจากทีมฟรี/Are you sure you want to release \${playerName} as a free agent/g" src/components/TransferTab.tsx

# Fix TacticsTabs.tsx
sed -i '' 's/กำลังโหลด/Loading/g' src/components/TacticsTabs.tsx
sed -i '' 's/ไม่สามารถโหลดแผนการเล่น/Failed to load tactics/g' src/components/TacticsTabs.tsx

# Fix PlayerSearchModal.tsx
sed -i '' 's/กำลังโหลด/Loading/g' src/components/PlayerSearchModal.tsx

echo "✅ Component files fixed!"
