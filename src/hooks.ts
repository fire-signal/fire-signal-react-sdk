import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateWithProvider, useFireProvider } from './context';
import type { FlagDecision, FlagsContext, UseFlagDecisionResult, UseFlagOptions } from './types';

const EMPTY_CONTEXT: FlagsContext = {};
const EMPTY_OPTIONS: UseFlagOptions = {};

const decisionCache = new Map<string, FlagDecision<unknown>>();
const inFlightCache = new Map<string, Promise<FlagDecision<unknown>>>();

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableSerialize(v)}`).join(',')}}`;
}

function createRequestKey(
  publishableKey: string,
  host: string | undefined,
  flag: string,
  context: FlagsContext
): string {
  return `${publishableKey}|${host || ''}|${flag}|${stableSerialize(context)}`;
}

export function useFlagDecision<T = unknown>(
  flag: string,
  context: FlagsContext = EMPTY_CONTEXT,
  options: UseFlagOptions = EMPTY_OPTIONS
): UseFlagDecisionResult<T> {
  const provider = useFireProvider();
  const enabled = options.enabled !== false;
  const refreshMs = options.refreshMs;
  const requestKey = useMemo(() => {
    if (!provider) return null;
    return createRequestKey(provider.publishableKey, provider.host, flag, context);
  }, [provider, flag, context]);

  const [loading, setLoading] = useState(() => !!provider && enabled);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [decision, setDecision] = useState<FlagDecision<T> | undefined>(() => {
    if (!requestKey) return undefined;
    return decisionCache.get(requestKey) as FlagDecision<T> | undefined;
  });

  // Keep latest values in refs - never in deps
  const providerRef = useRef(provider);
  const contextRef = useRef(context);
  const optionsRef = useRef(options);
  providerRef.current = provider;
  contextRef.current = context;
  optionsRef.current = options;

  // Stable setter - never recreated
  const setters = useRef({ setLoading, setError, setDecision });

  useEffect(() => {
    if (!provider || !requestKey || !enabled) {
      setters.current.setDecision(undefined);
      setters.current.setError(undefined);
      setters.current.setLoading(false);
      return;
    }

    const cached = decisionCache.get(requestKey) as FlagDecision<T> | undefined;
    if (cached) {
      setters.current.setDecision(cached);
      setters.current.setLoading(false);
      return;
    }

    setters.current.setDecision(undefined);
    setters.current.setError(undefined);
    setters.current.setLoading(true);
  }, [provider, requestKey, enabled]);

  useEffect(() => {
    if (!providerRef.current || !requestKey) return;
    if (optionsRef.current.enabled === false) {
      setters.current.setLoading(false);
      return;
    }

    const cached = decisionCache.get(requestKey) as FlagDecision<T> | undefined;
    if (cached) {
      setters.current.setDecision((prev) => (prev === cached ? prev : cached));
      setters.current.setLoading(false);
      return;
    }

    let cancelled = false;
    setters.current.setLoading((prev) => (prev ? prev : true));
    setters.current.setError(undefined);

    let request = inFlightCache.get(requestKey) as Promise<FlagDecision<T>> | undefined;
    if (!request) {
      request = evaluateWithProvider<T>(providerRef.current, flag, contextRef.current);
      inFlightCache.set(requestKey, request as Promise<FlagDecision<unknown>>);
    }

    request
      .then((result) => {
        decisionCache.set(requestKey, result as FlagDecision<unknown>);
        if (!cancelled) {
          setters.current.setDecision((prev) => (prev === result ? prev : result));
        }
      })
      .catch((err) => {
        if (!cancelled) setters.current.setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        inFlightCache.delete(requestKey);
        if (!cancelled) setters.current.setLoading(false);
      });

    return () => { cancelled = true; };
  }, [requestKey, flag]);

  const refetch = useCallback(() => {
    if (!providerRef.current || !requestKey) return Promise.resolve();
    inFlightCache.delete(requestKey);
    decisionCache.delete(requestKey);
    setters.current.setLoading(true);
    setters.current.setError(undefined);
    return evaluateWithProvider<T>(providerRef.current, flag, contextRef.current)
      .then((result) => {
        decisionCache.set(requestKey, result as FlagDecision<unknown>);
        setters.current.setDecision(result);
      })
      .catch((err) => setters.current.setError(err instanceof Error ? err : new Error(String(err))))
      .finally(() => setters.current.setLoading(false));
  }, [requestKey, flag]);

  useEffect(() => {
    if (!provider || !requestKey || !enabled || !refreshMs || refreshMs <= 0) return;

    const timer = setInterval(() => {
      void refetch();
    }, refreshMs);

    return () => {
      clearInterval(timer);
    };
  }, [provider, requestKey, enabled, refreshMs, refetch]);

  return { loading, error, decision, refetch };
}

export function useFlag(
  flag: string,
  context: FlagsContext = {},
  options: UseFlagOptions = {}
) {
  const { loading, error, decision, refetch } = useFlagDecision(
    flag,
    context,
    options
  );

  return {
    loading,
    error,
    enabled: !!decision?.enabled,
    decision,
    refetch,
  };
}

export function useVariantValue<T = unknown>(
  flag: string,
  context: FlagsContext = {},
  fallback?: T | null,
  options: UseFlagOptions = {}
) {
  const { loading, error, decision, refetch } = useFlagDecision<T>(
    flag,
    context,
    options
  );

  const value = useMemo(() => {
    if (!decision?.enabled) return fallback;
    return decision?.value ?? fallback;
  }, [decision?.enabled, decision?.value, fallback]);

  return {
    loading,
    error,
    enabled: !!decision?.enabled,
    value,
    decision,
    refetch,
  };
}
