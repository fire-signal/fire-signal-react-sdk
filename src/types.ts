import type { ReactNode } from 'react';

export type FlagsContext = {
  user?: { id: string; [k: string]: unknown };
  company?: { id: string; [k: string]: unknown };
  traits?: Record<string, unknown>;
};

export type FlagDecision<T = unknown> = {
  key: string;
  enabled: boolean;
  variantKey?: string;
  value?: T;
  reason?: string;
  fetchedAt: string;
};

export type TrackPayload = {
  user?: { id: string; [k: string]: unknown };
  company?: { id: string; [k: string]: unknown };
  properties?: Record<string, unknown>;
};

export type IdentifyTraits = Record<string, unknown>;

export type FireIdentity = {
  id: string;
};

export type FireProviderContext = {
  user?: FireIdentity;
  company?: FireIdentity;
  traits?: Record<string, unknown>;
};

export type FireProviderProps = {
  children: ReactNode;
  publishableKey: string;
  host?: string;
  strictPlatformProvider?: boolean;
  user?: FireIdentity;
  company?: FireIdentity;
  traits?: Record<string, unknown>;
};

export type UseFlagOptions = {
  enabled?: boolean;
  refreshMs?: number;
};

export type UseFlagDecisionResult<T = unknown> = {
  loading: boolean;
  error?: Error;
  decision?: FlagDecision<T>;
  refetch: () => Promise<void>;
};

export type FireFlagRenderProps<T = unknown> = FlagDecision<T>;

export type FireFlagProps<T = unknown> = {
  flag: string;
  context?: FlagsContext;
  options?: UseFlagOptions;
  fallback?: ReactNode;
  children: (decision: FireFlagRenderProps<T>) => ReactNode;
};
