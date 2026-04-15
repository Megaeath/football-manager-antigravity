🏃 ตารางเทียบค่าพลัง Pace (1-20) กับระยะทางที่เคลื่อนที่ได้
ค่าพลัง (Pace) ความเร็ว (Units / Sec) 1 วินาที ขยับได้ (Points) วิ่งเต็มสนาม 100 เมตร ใช้เวลา (วินาที) ระดับความเร็ว (Rating)
20 10.0 10.0 10.0 World Class (Mbappé)
19 9.8 9.8 10.2 Extremely Fast
18 9.5 9.5 10.5 Very Fast
17 9.3 9.3 10.8 Fast
16 9.0 9.0 11.1 Professional Speed
15 8.8 8.8 11.4 Good
14 8.5 8.5 11.8 Above Average
13 8.3 8.3 12.0 Average
12 8.0 8.0 12.5 Average
11 7.8 7.8 12.8 Average
10 7.5 7.5 13.3 Baseline (นักเตะทั่วไป)
9 7.3 7.3 13.7 Slightly Slow
8 7.0 7.0 14.2 Slow
7 6.8 6.8 14.7 Slow
6 6.5 6.5 15.4 Heavy
5 6.3 6.3 15.8 Very Heavy
4 6.0 6.0 16.7 Target Man / Slow DF
3 5.8 5.8 17.2 Injured / Very Slow
2 5.5 5.5 18.2 Static
1 5.0 5.0 20.0 Minimum Movement
📊 สรุป 9 ข้อ: การนำค่าในตารางไปใช้ในโค้ด

1. Linear Progression: ผมใช้สูตร $Speed = 5 + (Pace \times 0.25)$ เพื่อให้ค่าพลัง 1 และ 20 ไม่ต่างกันจนเกินไป (ห่างกัน 2 เท่า) เพื่อความสมดุลของเกม
2. Distance Calculation: ในทุกๆ Tick ของ Game Loop (เช่น 60 FPS) ระยะทางที่ขยับคือ (Speed * deltaTime)
3. Acceleration Impact: อย่าลืมว่าตารางนี้คือ Top Speed นักเตะที่มี Accel ต่ำ จะต้องใช้เวลา 2-3 วินาทีกว่าจะทำได้ตามความเร็วในตารางนี้
4. Dribbling Penalty: เมื่อมีบอล ให้คูณความเร็วในตารางด้วย 0.85 (ลดลง 15%) เพื่อให้กองหลังมีโอกาสไล่ตามทัน
5. Diagonal Movement: หากวิ่งเฉียง ความเร็วรวมต้องถูกหารด้วย $\sqrt{2}$ (ประมาณ 1.41) เพื่อไม่ให้วิ่งเฉียงเร็วกว่าวิ่งทางตรง (ใช้ Pythagoras ช่วย)
6. Stamina Factor: ช่วงท้ายเกม (นาที 70+) ความเร็วในตารางควรถูกลดทอนลงตามค่า Stamina ที่เหลืออยู่
