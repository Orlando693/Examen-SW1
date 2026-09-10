'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { authApi, safeReturnPath } from '../../lib/auth/auth-session';

export function ProtectedRoute({ children, returnTo }: { children: ReactNode; returnTo: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void authApi.restore().then((session) => {
      if (!session) window.location.assign(`/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`);
      else setReady(true);
    });
  }, [returnTo]);

  return ready ? <>{children}</> : null;
}
