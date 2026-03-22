'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';
import { TRAINING } from '@/lib/constants/uiLabels';

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

  const playersSorted = useMemo(() => {
    if (!data?.players) return [];

    const getPositionOrder = (pos: string) => {
      const first = pos.charAt(0).toUpperCase();
      if (first === 'G') return 0;
      if (first === 'D') return 1;
      if (first === 'M' || first === 'A') return 2;
      if (first === 'F') return 3;
      return 4;
    };

    const withPower = data.players.map((p) => {
      const attrs = toPlayerAttributes({
        handling: p.handling, tackling: p.tackling, passing: p.passing, shooting: p.shooting,
        heading: p.heading, dribbling: p.dribbling, crossing: p.crossing, setPieces: p.setPieces,
        throw: p.throw, aggression: p.aggression, positioning: p.positioning, vision: p.vision,
        bravery: p.bravery, leadership: p.leadership, teamwork: p.teamwork, composure: p.composure,
        pace: p.pace, acceleration: p.acceleration, stamina: p.stamina, strength: p.strength,
        agility: p.agility, balance: p.balance
      });
      const natPos = p.naturalPosition.split('_')[0];
      const power = calculatePlayerPower({ attributes: attrs, targetPosition: natPos, condition: 100, exp: p.exp || 0 }).powerWithExp;
      return { ...p, power };
    });

    return withPower.sort((a, b) => {
      const posA = getPositionOrder(a.naturalPosition);
      const posB = getPositionOrder(b.naturalPosition);
      if (posA !== posB) return posA - posB;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

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
      setMessage(`✅ Slot ${slotIndex} saved successfully`);
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
      setMessage(`✅ Upgraded to Level ${json.level}`);
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, 'Failed to upgrade facility'));
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem' }}>🏋️ Loading training data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-center" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
        ❌ Training data unavailable
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Header */}
      <div className="hero-gradient">
        <h1 className="text-2xl md:text-4xl" style={{ margin: 0 }}>🏋️ {TRAINING.TITLE}</h1>
        <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>Develop your players through focused training</p>
      </div>

      {/* Facility Card */}
      <Card>
        <CardHeader>
          <CardTitle>🏟️ {TRAINING.FACILITY_LEVEL}</CardTitle>
        </CardHeader>
        <div style={{ 
          padding: '1.5rem', 
          background: 'var(--primary-light)', 
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Current Level</div>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              Lv.{data.team.trainingFacilityLevel}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              Weekly Fee: <strong>{formatCurrency(data.team.facility.weeklyFee)}</strong> | Max Gain: <strong>+{data.team.facility.maxGain.toFixed(2)}</strong>
            </div>
            <div style={{ fontSize: '0.85rem', color: data.team.canAffordNextWeek ? 'var(--success)' : 'var(--danger)', marginTop: '0.5rem' }}>
              {data.team.canAffordNextWeek ? '✅ Enough funds for next week' : '⚠️ Insufficient funds for next weekly training'}
            </div>
          </div>
          
          {data.team.nextFacility ? (
            <div style={{ textAlign: 'right' }}>
              {(() => {
                const canAfford = data.team.balance >= data.team.nextFacility.upgradeCost;
                return (
                  <>
                    {!canAfford && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>
                        Need {formatCurrency(data.team.nextFacility.upgradeCost)} — Balance: {formatCurrency(data.team.balance)}
                      </div>
                    )}
                    <Button
                      variant="primary"
                      onClick={() => setShowUpgradeModal(true)}
                      disabled={!canAfford}
                      style={{ minWidth: '200px' }}
                    >
                      ⬆️ {TRAINING.UPGRADE} ({formatCurrency(data.team.nextFacility.upgradeCost)})
                    </Button>
                  </>
                );
              })()}
            </div>
          ) : (
            <div style={{ 
              padding: '1rem 2rem', 
              background: 'var(--success)', 
              color: 'white', 
              borderRadius: '10px',
              textAlign: 'center',
              fontWeight: '600'
            }}>
              ✅ {TRAINING.MAX_LEVEL}
            </div>
          )}
        </div>
      </Card>

      {/* Training Slots */}
      <Card>
        <CardHeader>
          <CardTitle>📋 {TRAINING.TRAINING_SLOTS} ({data.slots.length}/5)</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.slots.map((slot) => {
            const selectedPlayer = slot.playerId ? playersById.get(slot.playerId) : null;
            const effectiveVal = selectedPlayer && slot.focusAttribute ? selectedPlayer.effectiveAttributes?.[slot.focusAttribute] : null;

            return (
              <div 
                key={slot.id} 
                className="card"
                style={{ 
                  padding: '1rem',
                  border: slot.isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                  opacity: slot.isActive ? 1 : 0.7
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Slot {slot.slotIndex}</span>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    padding: '2px 8px', 
                    borderRadius: '10px',
                    background: slot.isActive ? 'var(--success)' : 'var(--border)',
                    color: slot.isActive ? 'white' : 'var(--muted)',
                    fontWeight: '600'
                  }}>
                    {slot.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <select
                    value={slot.playerId || ''}
                    onChange={(e) => handleSlotChange(slot.slotIndex, { playerId: e.target.value || null })}
                    disabled={savingSlot === slot.slotIndex}
                    className="select"
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Select Player --</option>
                    {playersSorted.map((p) => {
                      const isAlreadySelected = selectedPlayerIds.has(p.id) && p.id !== slot.playerId;
                      return (
                        <option key={p.id} value={p.id} disabled={isAlreadySelected}>
                          {p.name} | {p.naturalPosition} | Age:{p.age} | ⚡{p.power}{isAlreadySelected ? ' [IN USE]' : ''}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    value={slot.focusAttribute || ''}
                    onChange={(e) => handleSlotChange(slot.slotIndex, { focusAttribute: e.target.value || null })}
                    disabled={savingSlot === slot.slotIndex}
                    className="select"
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Select Attribute --</option>
                    {data.trainableAttributes.map((attr) => (
                      <option key={attr} value={attr}>{data.trainableAttributeLabels[attr] || attr}</option>
                    ))}
                  </select>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Last Gain: <span style={{ color: 'var(--success)', fontWeight: '600' }}>+{Number(slot.lastGain || 0).toFixed(2)}</span>
                  {slot.focusAttribute && effectiveVal !== null && (
                    <span> | Effective {data.trainableAttributeLabels[slot.focusAttribute] || slot.focusAttribute}: <strong style={{ color: 'var(--foreground)' }}>{Number(effectiveVal).toFixed(2)}</strong></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Weekly Status */}
      <Card>
        <CardHeader>
          <CardTitle>📊 {TRAINING.WEEKLY_STATUS}</CardTitle>
        </CardHeader>
        <div className="grid-auto-fit-sm" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'var(--primary-light)', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Current Week</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              {data.weekly.currentWeekKey}
            </div>
          </div>
          <div style={{ padding: '1rem', background: 'var(--primary-light)', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Last Status</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>
              {data.weekly.lastStatus || 'N/A'}
            </div>
          </div>
          <div style={{ padding: '1rem', background: 'var(--primary-light)', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Last Fee</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              {formatCurrency(data.weekly.lastChargedFee)}
            </div>
          </div>
        </div>
      </Card>

      {/* Message Display */}
      {message && (
        <div className="card" style={{ 
          padding: '1rem', 
          borderColor: message.includes('✅') || message.includes('saved') || message.includes('Upgraded') ? 'var(--success)' : 'var(--danger)',
          background: message.includes('✅') || message.includes('saved') || message.includes('Upgraded') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: message.includes('✅') || message.includes('saved') || message.includes('Upgraded') ? 'var(--success)' : 'var(--danger)',
          fontWeight: '600'
        }}>
          {message}
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && data.team.nextFacility && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0, 0, 0, 0.5)', 
          display: 'grid', 
          placeItems: 'center', 
          zIndex: 1000 
        }}>
          <Card style={{ width: 'min(560px, 92vw)', padding: '2rem' }}>
            <CardHeader>
              <CardTitle>Confirm Facility Upgrade</CardTitle>
            </CardHeader>
            <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
              <p style={{ marginBottom: '1rem' }}>
                Upgrade <strong>Lv.{data.team.trainingFacilityLevel}</strong> → <strong>Lv.{data.team.nextFacility.level}</strong>
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                <li>Upgrade Cost: <strong style={{ color: 'var(--foreground)' }}>{formatCurrency(data.team.nextFacility.upgradeCost)}</strong></li>
                <li>Your Balance: <strong style={{ color: data.team.balance >= data.team.nextFacility.upgradeCost ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(data.team.balance)}</strong></li>
                <li>After Upgrade: <strong style={{ color: 'var(--foreground)' }}>{formatCurrency(data.team.balance - data.team.nextFacility.upgradeCost)}</strong></li>
                <li>New Weekly Fee: <strong>{formatCurrency(data.team.nextFacility.weeklyFee)}</strong></li>
                <li>New Max Gain: <strong>+{data.team.nextFacility.maxGain.toFixed(2)}</strong></li>
              </ul>
              {data.team.balance < data.team.nextFacility.upgradeCost && (
                <div style={{ 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid var(--danger)', 
                  color: 'var(--danger)', 
                  fontSize: '0.9rem',
                  marginTop: '1rem'
                }}>
                  ⚠️ Insufficient funds. You need {formatCurrency(data.team.nextFacility.upgradeCost - data.team.balance)} more.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <Button variant="ghost" size="sm" onClick={() => setShowUpgradeModal(false)} disabled={upgrading}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleUpgrade}
                disabled={upgrading || data.team.balance < data.team.nextFacility.upgradeCost}
              >
                {upgrading ? '⏳ Upgrading...' : '✅ Confirm Upgrade'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function formatCurrency(num: number) {
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(0)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}
