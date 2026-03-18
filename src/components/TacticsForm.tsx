'use client';

import { useState } from 'react';

type PlanTacticData = {
    mentality: string;
    passing: string;
    tackling: string;
    attacking_focus: string;
    creative_freedom: string;
};

type TacticsFormProps = {
    plan: 'normal' | 'behind' | 'leading';
    data: PlanTacticData;
    onUpdate?: (formData: PlanTacticData) => void;
    readOnly?: boolean;
};

export default function TacticsForm({ plan, data, onUpdate, readOnly = false }: TacticsFormProps) {
    const [formData, setFormData] = useState(data);
    const [saved, setSaved] = useState(false);

    const planLabel = {
        normal: '📋 แผนปกติ (Normal)',
        behind: '⬆️ แผนตามไป (Behind)',
        leading: '⬇️ แผนนำหน้า (Leading)'
    }[plan];

    const planDescription = {
        normal: 'Used when match is level - Balanced approach',
        behind: 'Used when team is behind - Attacking focus',
        leading: 'Used when team is leading - Defensive focus'
    }[plan];

    const handleChange = (field: string, value: string) => {
        const updated = { ...formData, [field]: value };
        setFormData(updated);
        setSaved(false);
    };

    const handleSave = async () => {
        if (onUpdate) {
            await onUpdate(formData);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    return (
        <div style={{ padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '600' }}>{planLabel}</h3>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{planDescription}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {/* Mentality */}
                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '0.9rem' }}>
                        💪 จิตใจ
                    </label>
                    <select
                        value={formData.mentality}
                        onChange={(e) => handleChange('mentality', e.target.value)}
                        disabled={readOnly}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            background: readOnly ? 'var(--muted-bg)' : 'white',
                            cursor: readOnly ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <option>ULTRA_DEFENSIVE</option>
                        <option>DEFENSIVE</option>
                        <option>NORMAL</option>
                        <option>ATTACKING</option>
                        <option>ALL_OUT_ATTACK</option>
                    </select>
                </div>

                {/* Passing */}
                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '0.9rem' }}>
                        🎯 การส่งบอล
                    </label>
                    <select
                        value={formData.passing}
                        onChange={(e) => handleChange('passing', e.target.value)}
                        disabled={readOnly}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            background: readOnly ? 'var(--muted-bg)' : 'white',
                            cursor: readOnly ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <option>SHORT</option>
                        <option>MIXED</option>
                        <option>DIRECT</option>
                    </select>
                </div>

                {/* Tackling */}
                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '0.9rem' }}>
                        🛡️ การป้องกัน
                    </label>
                    <select
                        value={formData.tackling}
                        onChange={(e) => handleChange('tackling', e.target.value)}
                        disabled={readOnly}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            background: readOnly ? 'var(--muted-bg)' : 'white',
                            cursor: readOnly ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <option>SOFT</option>
                        <option>NORMAL</option>
                        <option>HARD</option>
                    </select>
                </div>

                {/* Attacking Focus */}
                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '0.9rem' }}>
                        🔥 จุดโจมตี
                    </label>
                    <select
                        value={formData.attacking_focus}
                        onChange={(e) => handleChange('attacking_focus', e.target.value)}
                        disabled={readOnly}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            background: readOnly ? 'var(--muted-bg)' : 'white',
                            cursor: readOnly ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <option>MIXED</option>
                        <option>CENTER</option>
                        <option>WINGS</option>
                    </select>
                </div>

                {/* Creative Freedom */}
                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '0.9rem' }}>
                        🎨 อิสระสร้างสรรค์
                    </label>
                    <select
                        value={formData.creative_freedom}
                        onChange={(e) => handleChange('creative_freedom', e.target.value)}
                        disabled={readOnly}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            background: readOnly ? 'var(--muted-bg)' : 'white',
                            cursor: readOnly ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <option>RESTRICTED</option>
                        <option>NORMAL</option>
                        <option>MAXIMUM</option>
                    </select>
                </div>
            </div>

            {!readOnly && (
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {saved && <span style={{ color: 'green', fontSize: '0.9rem' }}>✓ บันทึกแล้ว</span>}
                    <button
                        onClick={handleSave}
                        className="btn btn-primary"
                        style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                    >
                        💾 บันทึก
                    </button>
                </div>
            )}
        </div>
    );
}
