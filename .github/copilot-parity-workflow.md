# Copilot Parity Workflow (Cursor Agent)

## Purpose

This workflow helps you prompt Cursor agent to operate in a GitHub Copilot-like style for this repository.

## Default Operating Flow

1. Restate the task scope in one short sentence.
2. Read required docs in order:
   - `.github/personal-game-dev-skill.md`
   - `DOCUMENTATION_GUIDE.md`
   - `API_REFERENCE.md` (if API is affected)
   - `.github/copilot-instructions.md`
3. Reuse existing architecture/services/components first.
4. Implement the smallest correct patch.
5. Run verification (`npm run lint`, `npm run build`, or targeted checks).
6. Update impacted docs in the same task.
7. Return concise output: changed files, behavior impact, validation result, next risks.

## Prompt Templates

### 1) Feature Work

```text
ทำงานแบบ GitHub Copilot ตามกฎโปรเจกต์นี้:
- ทำการอ่านเอกสารตามลำดับที่กำหนดก่อน
- reuse โค้ดเดิมก่อนสร้างใหม่
- แก้แบบ minimal change
- อัปเดต docs ที่เกี่ยวข้องในงานเดียวกัน

งาน: <describe feature>
ข้อจำกัด: <constraints>
ผลลัพธ์ที่ต้องการ: <acceptance criteria>
```

### 2) Bug Fix

```text
ทำงานสไตล์ Copilot:
1) วิเคราะห์ root cause ก่อน
2) แก้ให้น้อยที่สุดและไม่พัง flow เดิม
3) เพิ่ม/อัปเดตการตรวจสอบที่จำเป็น
4) sync docs หาก behavior เปลี่ยน

ปัญหา: <bug description>
วิธี reproduce: <steps>
ผลลัพธ์ที่คาดหวัง: <expected result>
```

### 3) API Change

```text
ทำแบบ Copilot และถือว่า API เป็นงานสำคัญ:
- ตรวจ route/service เดิมก่อนเสมอ
- รักษา contract เดิมถ้าเป็นไปได้
- ถ้าเปลี่ยน contract ให้ update API_REFERENCE.md ทันที

งาน API: <endpoint/task>
input/output ที่ต้องการ: <schema>
compatibility requirement: <backward compatibility need>
```

## Definition of Done

- Implementation is complete and verified
- No architectural drift without explicit reason
- Documentation is aligned with final behavior
- Final report is clear and actionable
