'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';

type TrainingState = {
  team: {
    id: string;
    name: string;
    balance: number;
    trainingFacilityLevel: number;
    facility: { level: number; upgradeCost: number; weeklyFee: number; maxGain: number };
    nextFacility: { level: number; upgradeCost: number; weeklyFee: number; maxGain: number } | null;
    canAffordNextWeek: boolean;
  };
  slots: Array<{
    id: string;
    slotIndex: number;
    playerId: string | null;
    focusAttribute: string | null;
    isActive: boolean;
    lastGain: number;
    player: { id: string; name: string; naturalPosition: string; tacticalPosition: string | null } | null;
  }>;
  players: Array<{
    id: string;
    name: string;
    naturalPosition: string;
    tacticalPosition: string | null;
    age: number;
    condition: number;
    exp: number;
    effectiveAttributes: Record<string, number>;
    // All attributes for power calculation
    handling: number;
    tackling: number;
    passing: number;
    shooting: number;
    heading: number;
    dribbling: number;
    crossing: number;
    setPieces: number;
    throw: number;
    aggression: number;
    positioning: number;
    vision: number;
    bravery: number;
    leadership: number;
    teamwork: number;
    composure: number;
    pace: number;
    acceleration: number;
    stamina: number;
    strength: number;
    agility: number;
    balance: number;
  }>;
  trainableAttributes: string[];
  trainableAttributeLabels: Record<string, string>;
  weekly: {
    currentWeekKey: number;
    lastStatus: string | null;
    lastChargedFee: number;
    lastProcessedAt: string | null;
  };
};

const cardStyle: CSSProperties = {
  background: 'linear-gradient(160deg, rgba(2, 6, 23, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  borderRadius: 14,
  padding: 16,
  color: '#e2e8f0'
};

export default function TrainingClient() {
  const [data, setData] = useState<TrainingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [message, setMessage] = useState<string>('');

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const fetchState = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/training', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to fetch training data');
      setData(json);
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, 'Failed to fetch training data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const playersById = useMemo(() => {
    const map = new Map<string, TrainingState['players'][number]>();
    for (const p of data?.players || []) map.set(p.id, p);
    return map;
  }, [data]);

  // Get all players with power calculation, sorted by position
  const playersSorted = useMemo(() => {
    if (!data?.players) return [];
    
    const getPositionOrder = (pos: string) => {
      const first = pos.charAt(0).toUpperCase();
      if (first === 'G') return 0; // GK
      if (first === 'D') return 1; // DF, DL, DR, DMC, etc.
      if (first === 'M' || first === 'A') return 2; // MF, ML, MR, MC, AMC, etc.
      if (first === 'F') return 3; // FW, FWL, FWR, FWC, etc.
      return 4; // unknown
    };

    const withPower = data.players.map((p) => {
      // Use same calculation as player modal API
      const attrs = toPlayerAttributes({
        handling: p.handling,
        tackling: p.tackling,
        passing: p.passing,
        shooting: p.shooting,
        heading: p.heading,
        dribbling: p.dribbling,
        crossing: p.crossing,
        setPieces: p.setPieces,
        throw: p.throw,
        aggression: p.aggression,
        positioning: p.positioning,
        vision: p.vision,
        bravery: p.bravery,
        leadership: p.leadership,
        teamwork: p.teamwork,
        composure: p.composure,
        pace: p.pace,
        acceleration: p.acceleration,
        stamina: p.stamina,
        strength: p.strength,
        agility: p.agility,
        balance: p.balance
      });
      const natPos = p.naturalPosition.split('_')[0];
      const power = calculatePlayerPower({
        attributes: attrs,
        targetPosition: natPos,
        condition: 100,
        exp: p.exp || 0
      }).powerWithExp;
      return { ...p, power };
    });

    return withPower.sort((a, b) => {
      const posA = getPositionOrder(a.naturalPosition);
      const posB = getPositionOrder(b.naturalPosition);
      if (posA !== posB) return posA - posB;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  // Get selected player IDs from all slots
  const selectedPlayerIds = useMemo(() => {
    return new Set((data?.slots || []).map((s) => s.playerId).filter(Boolean) as string[]);
  }, [data]);

  const handleSlotChange = async (slotIndex: number, patch: { playerId?: string | null; focusAttribute?: string | null }) => {
    if (!data) return;
    setSavingSlot(slotIndex);
    setMessage('');
    try {
      const slot = data.slots.find((s) => s.slotIndex === slotIndex);
      const payload = {
        playerId: patch.playerId !== undefined ? patch.playerId : (slot?.playerId || null),
        focusAttribute: patch.focusAttribute !== undefined ? patch.focusAttribute : (slot?.focusAttribute || null)
      };

      const res = await fetch(`/api/training/slots/${slotIndex}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to save training slot');
      await fetchState();
      setMessage(`Slot ${slotIndex} saved`);
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, 'Failed to save training slot'));
    } finally {
      setSavingSlot(null);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    setMessage('');
    try {
      const res = await fetch('/api/training/facility/upgrade', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to upgrade facility');
      setShowUpgradeModal(false);
      await fetchState();
      setMessage(`Upgraded to level ${json.level}`);
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, 'Failed to upgrade facility'));
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 16, color: '#94a3b8' }}>Loading training...</div>;
  }

  if (!data) {
    return <div style={{ padding: 16, color: '#fca5a5' }}>Training data unavailable</div>;
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: '#22c55e' }}>Training Facility Lv.{data.team.trainingFacilityLevel}</h2>
            <div style={{ color: '#94a3b8', marginTop: 8 }}>
              Weekly Fee: {data.team.facility.weeklyFee.toLocaleString()} | Max Gain: +{data.team.facility.maxGain.toFixed(2)}
            </div>
            <div style={{ color: data.team.canAffordNextWeek ? '#86efac' : '#fca5a5', marginTop: 6 }}>
              {data.team.canAffordNextWeek ? '✅ Enough funds for next week' : '⚠️ Insufficient funds for next weekly training'}
            </div>
          </div>
          {data.team.nextFacility && (
            <div style={{ textAlign: 'right' }}>
              {(() => {
                const canAfford = data.team.balance >= data.team.nextFacility.upgradeCost;
                return (
                  <>
                    {!canAfford && (
                      <div style={{ fontSize: '0.78rem', color: '#fca5a5', marginBottom: 6 }}>
                        ⚠️ Need ${data.team.nextFacility.upgradeCost.toLocaleString()} — balance ${data.team.balance.toLocaleString()}
                      </div>
                    )}
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      disabled={!canAfford}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: `1px solid ${canAfford ? 'rgba(34,197,94,.6)' : 'rgba(239,68,68,.6)'}`,
                        background: canAfford ? 'rgba(34,197,94,.2)' : 'rgba(148,163,184,.15)',
                        color: canAfford ? '#e2e8f0' : '#94a3b8',
                        cursor: canAfford ? 'pointer' : 'not-allowed'
                      }}
                    >
                      Upgrade Facility
                    </button>
                  </>
                );
              })()}
            </div>
          )}
          {!data.team.nextFacility && (
            <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(148,163,184,.2)', background: 'rgba(148,163,184,.1)', color: '#64748b', fontSize: '0.9rem' }}>
              Max Level
            </div>
          )}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Training Slots (max 5)</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {data.slots.map((slot) => {
            const selectedPlayer = slot.playerId ? playersById.get(slot.playerId) : null;
            const effectiveVal = selectedPlayer && slot.focusAttribute ? selectedPlayer.effectiveAttributes?.[slot.focusAttribute] : null;

            return (
              <div key={slot.id} style={{ border: '1px solid rgba(148,163,184,.2)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong>Slot {slot.slotIndex}</strong>
                  <span style={{ color: slot.isActive ? '#86efac' : '#fca5a5' }}>{slot.isActive ? '● Active' : '● Inactive'}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <select
                    value={slot.playerId || ''}
                    onChange={(e) => handleSlotChange(slot.slotIndex, { playerId: e.target.value || null })}
                    disabled={savingSlot === slot.slotIndex}
                    style={{ padding: 8, borderRadius: 8, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
                  >
                    <option value="">-- Select player --</option>
                    {playersSorted.map((p) => {
                      const isAlreadySelected = selectedPlayerIds.has(p.id) && p.id !== slot.playerId;
                      return (
                        <option key={p.id} value={p.id} disabled={isAlreadySelected}>
                          {p.name} | {p.naturalPosition} | Age:{p.age} | Power:{p.power}{isAlreadySelected ? ' [IN USE]' : ''}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    value={slot.focusAttribute || ''}
                    onChange={(e) => handleSlotChange(slot.slotIndex, { focusAttribute: e.target.value || null })}
                    disabled={savingSlot === slot.slotIndex}
                    style={{ padding: 8, borderRadius: 8, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
                  >
                    <option value="">-- Select attribute --</option>
                    {data.trainableAttributes.map((attr) => (
                      <option key={attr} value={attr}>{data.trainableAttributeLabels[attr] || attr}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 13 }}>
                  Last gain: <span style={{ color: '#86efac' }}>+{Number(slot.lastGain || 0).toFixed(2)}</span>
                  {slot.focusAttribute && effectiveVal !== null ? (
                    <> | Effective {data.trainableAttributeLabels[slot.focusAttribute] || slot.focusAttribute}: <strong>{Number(effectiveVal).toFixed(2)}</strong></>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Weekly Status</h3>
        <div style={{ color: '#94a3b8' }}>
          Last status: <strong>{data.weekly.lastStatus || 'N/A'}</strong><br />
          Last charged fee: {Number(data.weekly.lastChargedFee || 0).toLocaleString()}<br />
          Last processed at: {data.weekly.lastProcessedAt ? new Date(data.weekly.lastProcessedAt).toLocaleString() : '-'}
        </div>
      </div>

      {!!message && (
        <div style={{ ...cardStyle, borderColor: 'rgba(16,185,129,.4)', color: '#bbf7d0' }}>{message}</div>
      )}

      {showUpgradeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.7)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div style={{ ...cardStyle, width: 'min(560px, 92vw)' }}>
            <h3 style={{ marginTop: 0 }}>Confirm Facility Upgrade</h3>
            {data.team.nextFacility ? (
              <>
                <p style={{ color: '#cbd5e1' }}>
                  Upgrade Lv.{data.team.trainingFacilityLevel} → Lv.{data.team.nextFacility.level}
                </p>
                <ul style={{ color: '#94a3b8' }}>
                  <li>Upgrade Cost: <strong style={{ color: '#e2e8f0' }}>${data.team.nextFacility.upgradeCost.toLocaleString()}</strong></li>
                  <li>Your Balance: <strong style={{ color: data.team.balance >= data.team.nextFacility.upgradeCost ? '#86efac' : '#fca5a5' }}>${data.team.balance.toLocaleString()}</strong></li>
                  <li>After Upgrade: <strong style={{ color: '#e2e8f0' }}>${(data.team.balance - data.team.nextFacility.upgradeCost).toLocaleString()}</strong></li>
                  <li>New Weekly Fee: {data.team.nextFacility.weeklyFee.toLocaleString()}</li>
                  <li>New Max Gain: +{data.team.nextFacility.maxGain.toFixed(2)}</li>
                </ul>
                {data.team.balance < data.team.nextFacility.upgradeCost && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.5)', color: '#fca5a5', fontSize: '0.9rem' }}>
                    ⚠️ Insufficient funds. You need ${(data.team.nextFacility.upgradeCost - data.team.balance).toLocaleString()} more.
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: '#94a3b8' }}>Facility is already max level.</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowUpgradeModal(false)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #475569', background: 'transparent', color: '#e2e8f0' }}
                disabled={upgrading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpgrade}
                style={{
                  padding: '8px 12px', borderRadius: 8,
                  border: '1px solid #22c55e',
                  background: 'rgba(34,197,94,.25)',
                  color: '#e2e8f0',
                  opacity: (upgrading || !data.team.nextFacility || data.team.balance < data.team.nextFacility.upgradeCost) ? 0.5 : 1
                }}
                disabled={upgrading || !data.team.nextFacility || data.team.balance < data.team.nextFacility.upgradeCost}
              >
                {upgrading ? 'Upgrading...' : 'Confirm Upgrade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
