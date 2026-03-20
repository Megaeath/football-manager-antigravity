'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Login failed');
      }

      router.replace('/');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #0f172a, #1e3a8a)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '1.5rem' }}>
        <h1 style={{ marginTop: 0, marginBottom: '0.5rem' }}>🔐 Login</h1>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>Sign in to access Football Manager.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          <label style={{ fontWeight: 600 }}>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className="input"
            style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
          />

          <label style={{ fontWeight: 600 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
            style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
          />

          {error && (
            <div style={{ color: '#dc2626', fontSize: '0.9rem' }}>{error}</div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
