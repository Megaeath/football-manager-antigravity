'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetGameWithSelectedTeam, updateYellowSuspensionThreshold } from '../actions';

type TeamOption = {
    id: string;
    name: string;
};

export default function SettingsClient({ teams, currentUserTeamName, yellowSuspensionThreshold }: { teams: TeamOption[]; currentUserTeamName: string; yellowSuspensionThreshold: number }) {
    const router = useRouter();
    const [step, setStep] = useState<'idle' | 'confirm' | 'choose'>('idle');
    const [loading, setLoading] = useState(false);
    const [selectedTeamName, setSelectedTeamName] = useState(currentUserTeamName || teams[0]?.name || '');
    const [yellowThreshold, setYellowThreshold] = useState(yellowSuspensionThreshold || 4);
    const [message, setMessage] = useState('');

    const handleSaveDisciplineSettings = async () => {
        setLoading(true);
        setMessage('กำลังบันทึกกฎโทษแบนใบเหลือง...');
        try {
            await updateYellowSuspensionThreshold(yellowThreshold);
            setMessage(`บันทึกแล้ว: ครบ ${yellowThreshold} ใบเหลือง = แบน 1 นัด`);
            router.refresh();
        } catch (error) {
            console.error('Failed to update yellow suspension threshold', error);
            setMessage('บันทึกกฎโทษแบนไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    const handleStartNewGame = async () => {
        if (!selectedTeamName) {
            setMessage('กรุณาเลือกทีมที่จะเล่นก่อนเริ่มเกมใหม่');
            return;
        }

        setLoading(true);
        setMessage('กำลังเริ่มเกมใหม่...');

        try {
            const result = await resetGameWithSelectedTeam(selectedTeamName);
            setMessage(`เริ่มเกมใหม่สำเร็จ! ทีมที่เลือก: ${result.userTeamName || 'Unknown'}`);
            router.push('/squad');
            router.refresh();
        } catch (error) {
            console.error('Failed to reset game', error);
            setMessage('เกิดข้อผิดพลาดในการเริ่มเกมใหม่');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{ maxWidth: '760px' }}>
            <h2 style={{ marginTop: 0 }}>⚙️ ตั้งค่าเกม</h2>
            <p style={{ color: 'var(--muted)' }}>
                เมนูนี้ใช้สำหรับเริ่มเกมใหม่ทั้งหมด โดยรีเซ็ตข้อมูลฤดูกาลและทีมกลับไปที่ Season 1
            </p>

            <div style={{ marginTop: '1rem', border: '1px solid #fecaca', background: '#fff1f2', borderRadius: '10px', padding: '1rem' }}>
                <h3 style={{ marginTop: 0, color: '#0369a1' }}>🟨 กฎโทษแบนใบเหลืองสะสม</h3>
                <p style={{ marginBottom: '0.75rem', color: '#334155' }}>
                    ตั้งค่าจำนวนใบเหลืองสะสมที่ทำให้นักเตะติดโทษแบนอัตโนมัติ (ค่าแนะนำ: 4)
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <input
                        type="number"
                        min={1}
                        max={10}
                        value={yellowThreshold}
                        onChange={(e) => setYellowThreshold(Math.max(1, Math.min(10, Number(e.target.value) || 4)))}
                        disabled={loading}
                        style={{ width: '90px', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px' }}
                    />
                    <span style={{ color: '#475569', fontSize: '0.9rem' }}>ใบเหลือง = แบน 1 นัด</span>
                    <button className="btn btn-primary" disabled={loading} onClick={handleSaveDisciplineSettings}>
                        บันทึกกฎ
                    </button>
                </div>
            </div>

            <div style={{ marginTop: '1rem', border: '1px solid #fecaca', background: '#fff1f2', borderRadius: '10px', padding: '1rem' }}>
                <h3 style={{ marginTop: 0, color: '#b91c1c' }}>🧨 เริ่มเกมใหม่ (New Game)</h3>
                <p style={{ marginBottom: '0.75rem', color: '#7f1d1d' }}>
                    การทำรายการนี้จะลบข้อมูลเกมเดิมทั้งหมด เช่น ตารางคะแนน ผลการแข่งขัน ตลาดซื้อขาย ข่าวสาร และสถิติ
                </p>

                {step === 'idle' && (
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setStep('confirm');
                            setMessage('');
                        }}
                    >
                        เริ่มเกมใหม่
                    </button>
                )}

                {step === 'confirm' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary"
                            style={{ background: '#b91c1c', borderColor: '#b91c1c' }}
                            onClick={() => setStep('choose')}
                        >
                            Confirm
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setStep('idle');
                                setMessage('ยกเลิกแล้ว');
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {step === 'choose' && (
                    <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '360px' }}>
                        <label style={{ fontWeight: 600 }}>เลือกทีมที่จะคุมในเกมใหม่</label>
                        <select
                            value={selectedTeamName}
                            onChange={(e) => setSelectedTeamName(e.target.value)}
                            style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white' }}
                            disabled={loading}
                        >
                            {teams.map((team) => (
                                <option key={team.id} value={team.name}>
                                    {team.name}
                                </option>
                            ))}
                        </select>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                className="btn btn-primary"
                                style={{ background: '#b91c1c', borderColor: '#b91c1c' }}
                                onClick={handleStartNewGame}
                                disabled={loading}
                            >
                                {loading ? 'กำลังรีเซ็ต...' : 'ยืนยันเริ่มเกมใหม่'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    setStep('idle');
                                    setMessage('ยกเลิกแล้ว');
                                }}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {message && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: loading ? '#1d4ed8' : 'var(--muted)' }}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
}
