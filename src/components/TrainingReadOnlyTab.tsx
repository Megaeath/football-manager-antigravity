'use client';

import { TRAINABLE_ATTRIBUTE_LABELS } from '@/lib/constants/training';

// ─── Types matching getTrainingState() response ───────────────────────────────
type FacilityConfig = {
  level: number;
  upgradeCost: number;
  weeklyFee: number;
  maxGain: number;
};

type SlotRow = {
  id: string;
  slotIndex: number;
  playerId: string | null;
  focusAttribute: string | null;
  isActive: boolean;
  lastGain: number;
  player: { id: string; name: string; naturalPosition: string; tacticalPosition: string | null } | null;
};

type WeeklyInfo = {
  currentWeekKey: number;
  lastStatus: string | null;
  lastChargedFee: number;
  lastProcessedAt: string | null;
};

export type TrainingState = {
  team: {
    id: string;
    name: string;
    balance: number;
    trainingFacilityLevel: number;
    facility: FacilityConfig;
    nextFacility: FacilityConfig | null;
    canAffordNextWeek: boolean;
  };
  slots: SlotRow[];
  weekly: WeeklyInfo;
};

const formatCurrency = (n: number) =>
  `$${new Intl.NumberFormat('en-US').format(Math.abs(Math.round(n || 0)))}`;

const attrLabel = (attr: string | null) => {
  if (!attr) return null;
  return TRAINABLE_ATTRIBUTE_LABELS[attr as keyof typeof TRAINABLE_ATTRIBUTE_LABELS] ?? attr;
};

export default function TrainingReadOnlyTab({ trainingState }: { trainingState: TrainingState }) {
  const { team, slots, weekly } = trainingState;
  const { facility } = team;

  const activeCount = slots.filter((s) => s.isActive && s.player).length;

  const statusColor =
    weekly.lastStatus === 'APPLIED'
      ? 'var(--success)'
      : weekly.lastStatus === 'SKIPPED_FUNDS'
        ? 'var(--danger)'
        : 'var(--muted)';

  const statusLabel =
    weekly.lastStatus === 'APPLIED'
      ? '✅ Applied'
      : weekly.lastStatus === 'SKIPPED_FUNDS'
        ? '❌ Skipped (Insufficient Funds)'
        : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Facility Info ─────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>🏋️ Training Facility</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'var(--hover-bg)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary)' }}>
              Lv.{facility.level}
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 400 }}>/9</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>Facility Level</div>
          </div>

          <div style={{ padding: '1rem', background: 'var(--hover-bg)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>{formatCurrency(facility.weeklyFee)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>Weekly Fee</div>
          </div>

          <div style={{ padding: '1rem', background: 'var(--hover-bg)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success)' }}>
              +{(facility.maxGain * 100).toFixed(0)}% max/wk
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>Max Gain Per Slot</div>
          </div>
        </div>

        {/* Weekly status row */}
        <div style={{
          marginTop: '1rem', padding: '0.75rem 1rem',
          background: 'var(--hover-bg)', borderRadius: '8px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Last Week Status</span>
          <span style={{ fontWeight: 700, color: statusColor }}>{statusLabel}</span>
        </div>

        {weekly.lastStatus === 'APPLIED' && weekly.lastChargedFee > 0 && (
          <div style={{ padding: '0.35rem 1rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
            Fee charged: {formatCurrency(weekly.lastChargedFee)}
          </div>
        )}

        {/* Next upgrade hint */}
        {team.nextFacility && (
          <div style={{
            marginTop: '0.75rem', padding: '0.6rem 1rem', fontSize: '0.85rem',
            background: 'var(--hover-bg)', borderRadius: '8px',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ color: 'var(--muted)' }}>Next upgrade → Lv.{team.nextFacility.level}</span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(team.nextFacility.upgradeCost)}</span>
          </div>
        )}
        {!team.nextFacility && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
            🌟 Maximum Facility Level Reached
          </div>
        )}
      </div>

      {/* ── Training Slots ────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
          📋 Training Slots
          <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem', fontWeight: 400, color: 'var(--muted)' }}>
            ({activeCount}/{slots.length} active)
          </span>
        </h3>

        {/* Column labels */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2rem 2fr 1.5fr 1fr 1fr',
          gap: '0.75rem', padding: '0 1rem 0.4rem',
          fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>#</span>
          <span>Player</span>
          <span>Focus Attribute</span>
          <span style={{ textAlign: 'center' }}>Last Gain</span>
          <span style={{ textAlign: 'right' }}>Status</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {slots.map((slot) => {
            const active = slot.isActive && slot.player != null;
            return (
              <div
                key={slot.slotIndex}
                style={{
                  padding: '0.85rem 1rem',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  display: 'grid',
                  gridTemplateColumns: '2rem 2fr 1.5fr 1fr 1fr',
                  gap: '0.75rem',
                  alignItems: 'center',
                  opacity: active ? 1 : 0.45,
                  transition: 'opacity 0.15s',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--muted)', fontSize: '0.85rem' }}>
                  #{slot.slotIndex}
                </span>

                <span style={{ fontWeight: 600 }}>
                  {slot.player ? (
                    <>
                      {slot.player.name}
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                        ({slot.player.naturalPosition})
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontWeight: 400 }}>Empty</span>
                  )}
                </span>

                <span>
                  {slot.focusAttribute ? (
                    <span
                      className="badge"
                      style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 600 }}
                    >
                      {attrLabel(slot.focusAttribute)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  )}
                </span>

                <span style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                  {slot.lastGain > 0 ? (
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                      +{slot.lastGain.toFixed(2)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  )}
                </span>

                <span style={{ textAlign: 'right', fontSize: '0.78rem', color: active ? 'var(--success)' : 'var(--muted)' }}>
                  {active ? '✅ Active' : '⬜ Empty'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
