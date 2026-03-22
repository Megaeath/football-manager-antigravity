'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

type PageLoaderContextValue = {
  showLoader: (message?: string) => void;
  hideLoader: () => void;
};

const PageLoaderContext = createContext<PageLoaderContextValue | null>(null);

export function PageLoaderProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('Processing...');

  const showLoader = useCallback((nextMessage?: string) => {
    setMessage(nextMessage || 'Processing...');
    setVisible(true);
  }, []);

  const hideLoader = useCallback(() => {
    setVisible(false);
  }, []);

  // Auto-hide after successful route change to avoid stale overlays.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 250);
    return () => clearTimeout(timer);
  }, [pathname, visible]);

  const value = useMemo(() => ({ showLoader, hideLoader }), [showLoader, hideLoader]);

  return (
    <PageLoaderContext.Provider value={value}>
      {children}
      {visible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)'
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
              fontWeight: 700,
              color: 'var(--accent)'
            }}
          >
            ⏳ {message}
          </div>
        </div>
      )}
    </PageLoaderContext.Provider>
  );
}

export function usePageLoader() {
  const ctx = useContext(PageLoaderContext);
  if (!ctx) {
    throw new Error('usePageLoader must be used inside PageLoaderProvider');
  }
  return ctx;
}
