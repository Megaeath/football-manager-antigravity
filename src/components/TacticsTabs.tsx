'use client';

import { useState, useEffect, useCallback } from 'react';
import TacticsForm from './TacticsForm';

type TacticsEntity = {
    normalMentality: string;
    normalPassing: string;
    normalTackling: string;
    normalAttacking_focus: string;
    normalCreative_freedom: string;
    behindMentality: string;
    behindPassing: string;
    behindTackling: string;
    behindAttacking_focus: string;
    behindCreative_freedom: string;
    leadingMentality: string;
    leadingPassing: string;
    leadingTackling: string;
    leadingAttacking_focus: string;
    leadingCreative_freedom: string;
};

type PlanTacticData = {
    mentality: string;
    passing: string;
    tackling: string;
    attacking_focus: string;
    creative_freedom: string;
};

type TacticsTabsProps = {
    teamId: string;
    readOnly?: boolean;
    visiblePlans?: Array<'normal' | 'behind' | 'leading'>;
};

export default function TacticsTabs({ teamId, readOnly = false, visiblePlans = ['normal', 'behind', 'leading'] }: TacticsTabsProps) {
    const [activeTab, setActiveTab] = useState<'normal' | 'behind' | 'leading'>(visiblePlans[0] || 'normal');
    const [tactics, setTactics] = useState<TacticsEntity | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchTactics = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/team/${teamId}/tactics`);
            const data = await res.json();
            setTactics(data);
        } catch (e) {
            console.error('Failed to fetch tactics:', e);
        } finally {
            setLoading(false);
        }
    }, [teamId]);

    useEffect(() => {
        fetchTactics();
    }, [fetchTactics]);

    useEffect(() => {
        if (!visiblePlans.includes(activeTab)) {
            setActiveTab(visiblePlans[0] || 'normal');
        }
    }, [activeTab, visiblePlans]);

    const handleUpdate = async (formData: PlanTacticData) => {
        try {
            const prefix = activeTab === 'normal' ? 'normal' : activeTab === 'behind' ? 'behind' : 'leading';
            const updateData = {
                [`${prefix}Mentality`]: formData.mentality,
                [`${prefix}Passing`]: formData.passing,
                [`${prefix}Tackling`]: formData.tackling,
                [`${prefix}Attacking_focus`]: formData.attacking_focus,
                [`${prefix}Creative_freedom`]: formData.creative_freedom
            };

            const res = await fetch(`/api/team/${teamId}/tactics`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (res.ok) {
                const updated = await res.json();
                setTactics(updated);
            }
        } catch (e) {
            console.error('Failed to update tactics:', e);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!tactics) return <div>Failed to load tactics</div>;

    const tabData = {
        normal: {
            label: '📋 แผนปกติ',
            data: {
                mentality: tactics.normalMentality,
                passing: tactics.normalPassing,
                tackling: tactics.normalTackling,
                attacking_focus: tactics.normalAttacking_focus,
                creative_freedom: tactics.normalCreative_freedom
            }
        },
        behind: {
            label: '⬆️ แผนตามไป',
            data: {
                mentality: tactics.behindMentality,
                passing: tactics.behindPassing,
                tackling: tactics.behindTackling,
                attacking_focus: tactics.behindAttacking_focus,
                creative_freedom: tactics.behindCreative_freedom
            }
        },
        leading: {
            label: '⬇️ แผนนำหน้า',
            data: {
                mentality: tactics.leadingMentality,
                passing: tactics.leadingPassing,
                tackling: tactics.leadingTackling,
                attacking_focus: tactics.leadingAttacking_focus,
                creative_freedom: tactics.leadingCreative_freedom
            }
        }
    };

    const tabsToRender = visiblePlans.filter((tab) => tabData[tab]);

    return (
        <div>
            {/* Tab Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid var(--border)', paddingBottom: '12px' }}>
                {tabsToRender.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '10px 16px',
                            border: 'none',
                            background: activeTab === tab ? 'var(--primary)' : 'transparent',
                            color: activeTab === tab ? 'white' : 'var(--foreground)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: activeTab === tab ? '600' : '500',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {tabData[tab].label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <TacticsForm
                key={activeTab}
                plan={activeTab}
                data={tabData[activeTab].data}
                onUpdate={handleUpdate}
                readOnly={readOnly}
            />
        </div>
    );
}
