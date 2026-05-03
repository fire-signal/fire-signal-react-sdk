import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { FlagDecision, FlagsContext } from './types';

type InternalContextValue = {
  publishableKey: string;
  host?: string;
  strictPlatformProvider: boolean;
  baseContext: FlagsContext;
};

const FireReactContext = createContext<InternalContextValue | null>(null);

export type FireProviderProps = {
  children: ReactNode;
  publishableKey: string;
  host?: string;
  strictPlatformProvider?: boolean;
  user?: { id: string };
  company?: { id: string };
  traits?: Record<string, unknown>;
};

export function FireProvider({
  children,
  publishableKey,
  host,
  strictPlatformProvider = false,
  user,
  company,
  traits,
}: FireProviderProps) {
  const baseContext = useMemo<FlagsContext>(
    () => ({ user, company, traits }),
    [company, traits, user]
  );

  const value = useMemo(
    () => ({ publishableKey, host, strictPlatformProvider, baseContext }),
    [publishableKey, host, strictPlatformProvider, baseContext]
  );

  return (
    <FireReactContext.Provider value={value}>{children}</FireReactContext.Provider>
  );
}

export function useFireProvider() {
  return useContext(FireReactContext);
}

function resolveBaseUrl(host?: string): string {
  if (!host) return 'https://api.fire-signal.com/v1';
  if (host.startsWith('http://') || host.startsWith('https://')) {
    return `${host.replace(/\/$/, '')}/v1`;
  }
  return `https://${host.replace(/\/$/, '')}/v1`;
}

export async function evaluateWithProvider<T = unknown>(
  ctx: InternalContextValue | null,
  flag: string,
  override: FlagsContext = {}
): Promise<FlagDecision<T>> {
  if (!ctx) {
    return { key: flag, enabled: false, reason: 'no provider', fetchedAt: new Date().toISOString() };
  }
  const mergedContext: FlagsContext = {
    user: override.user || ctx.baseContext.user,
    company: override.company || ctx.baseContext.company,
    traits: {
      ...(ctx.baseContext.traits || {}),
      ...(override.traits || {}),
    },
  };

  const response = await fetch(`${resolveBaseUrl(ctx.host)}/flags/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.publishableKey}`,
    },
    body: JSON.stringify({
      flags: [flag],
      context: mergedContext,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown error');
    const message = `Flag evaluation failed (${response.status}): ${text}`;
    if (ctx.strictPlatformProvider) {
      throw new Error(message);
    }
    return {
      key: flag,
      enabled: false,
      reason: message,
      fetchedAt: new Date().toISOString(),
    };
  }

  const data = (await response.json()) as {
    results?: Record<
      string,
      {
        enabled: boolean;
        variant?: string;
        reason?: string;
        value?: T;
      }
    >;
  };
  const result = data.results?.[flag];
  if (!result) {
    return {
      key: flag,
      enabled: false,
      reason: 'flag not found',
      fetchedAt: new Date().toISOString(),
    };
  }

  return {
    key: flag,
    enabled: !!result.enabled,
    variantKey: result.variant,
    value: result.value,
    reason: result.reason,
    fetchedAt: new Date().toISOString(),
  };
}
