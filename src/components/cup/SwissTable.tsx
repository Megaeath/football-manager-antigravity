type SwissTableRow = {
  teamId: string;
  teamName: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  points: number;
  gd: number;
  gf: number;
  buchholzScore: number;
  form: string;
};

interface SwissTableProps {
  rows: SwissTableRow[];
  currentRound: number;
  userTeamId?: string | null;
}

export default function SwissTable({ rows, currentRound, userTeamId }: SwissTableProps) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>Swiss Standings</h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Round {currentRound}/8</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', fontSize: '0.8rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#ef4444', display: 'inline-block' }} />
          Cut-off Top 16
        </div>
      </div>

      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'rgba(59,130,246,0.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0,1fr))', gap: '0.35rem' }}>
          {Array.from({ length: 8 }).map((_, idx) => {
            const done = idx < currentRound;
            return (
              <div
                key={idx}
                title={`Round ${idx + 1}`}
                style={{
                  height: '8px',
                  borderRadius: '999px',
                  background: done ? 'var(--primary)' : 'var(--border)',
                  boxShadow: done ? '0 0 8px rgba(37,99,235,0.6)' : 'none'
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--sidebar-bg)' }}>
              <th style={{ padding: '10px', color: 'white', textAlign: 'center', width: 56 }}>#</th>
              <th style={{ padding: '10px', color: 'white', textAlign: 'left' }}>Team</th>
              <th style={{ padding: '10px', color: 'white', textAlign: 'center' }}>P</th>
              <th style={{ padding: '10px', color: 'white', textAlign: 'center' }}>W</th>
              <th style={{ padding: '10px', color: 'white', textAlign: 'center' }}>D</th>
              <th style={{ padding: '10px', color: 'white', textAlign: 'center' }}>L</th>
              <th style={{ padding: '10px', color: 'white', textAlign: 'center' }}>Pts</th>
              <th style={{ padding: '10px', color: 'white', textAlign: 'center' }}>Buchholz</th>
              <th style={{ padding: '10px', color: 'white', textAlign: 'center' }}>GD</th>
              <th style={{ padding: '10px', color: 'white', textAlign: 'center' }}>GF</th>
              <th style={{ padding: '10px', color: 'white', textAlign: 'center' }}>Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const rank = idx + 1;
              const isCutLine = rank === 16;
              const isUser = userTeamId && row.teamId === userTeamId;
              return (
                <tr
                  key={row.teamId}
                  style={{
                    borderBottom: isCutLine ? '2px solid #ef4444' : '1px solid var(--border)',
                    background: isUser ? 'rgba(251,191,36,0.10)' : rank <= 16 ? 'rgba(34,197,94,0.05)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>{rank}</td>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{row.teamName}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{row.played}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{row.win}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{row.draw}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{row.loss}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>{row.points}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{row.buchholzScore}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{row.gf}</td>
                  <td style={{ padding: '10px', textAlign: 'center', letterSpacing: '0.12em' }}>{row.form || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden flex flex-col gap-2" style={{ padding: '0.75rem' }}>
        {rows.map((row, idx) => {
          const rank = idx + 1;
          const isUser = userTeamId && row.teamId === userTeamId;
          const isCutLine = rank === 16;
          return (
            <div
              key={row.teamId}
              className="card"
              style={{
                padding: '0.75rem',
                border: isCutLine ? '1px solid #ef4444' : '1px solid var(--border)',
                background: isUser ? 'rgba(251,191,36,0.10)' : 'var(--card-bg)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <div style={{ fontWeight: 700 }}>#{rank} {row.teamName}</div>
                <div style={{ fontWeight: 700 }}>{row.points} pts</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '0.35rem', fontSize: '0.8rem' }}>
                <div>P {row.played}</div>
                <div>W {row.win}</div>
                <div>D {row.draw}</div>
                <div>L {row.loss}</div>
                <div>BH {row.buchholzScore}</div>
                <div>GD {row.gd > 0 ? `+${row.gd}` : row.gd}</div>
                <div>GF {row.gf}</div>
                <div>{row.form || '-'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
