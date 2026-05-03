import { useCallback } from 'react';
import { useFireProvider } from './context';
import type { IdentifyTraits, TrackPayload } from './types';

function resolveBaseUrl(host?: string): string {
  if (!host) return 'https://api.fire-signal.com/v1';
  if (host.startsWith('http://') || host.startsWith('https://')) {
    return `${host.replace(/\/$/, '')}/v1`;
  }
  return `https://${host.replace(/\/$/, '')}/v1`;
}

export function useTrack() {
  const provider = useFireProvider();

  return useCallback(
    async (eventName: string, payload: TrackPayload = {}) => {
      if (!provider) return false;
      const response = await fetch(`${resolveBaseUrl(provider.host)}/events/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.publishableKey}`,
        },
        body: JSON.stringify({
          eventName,
          customerExternalId: payload.user?.id || provider.baseContext.user?.id,
          properties: {
            ...(provider.baseContext.traits || {}),
            ...(payload.properties || {}),
            companyId: payload.company?.id || provider.baseContext.company?.id,
          },
        }),
      });

      return response.ok;
    },
    [provider]
  );
}

export function useIdentify() {
  const provider = useFireProvider();

  return useCallback(
    async (externalId: string, traits: IdentifyTraits = {}) => {
      if (!provider) return false;
      const response = await fetch(`${resolveBaseUrl(provider.host)}/customers/identify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.publishableKey}`,
        },
        body: JSON.stringify({
          externalId,
          traits,
          email: typeof traits.email === 'string' ? traits.email : undefined,
          name: typeof traits.name === 'string' ? traits.name : undefined,
        }),
      });

      return response.ok;
    },
    [provider]
  );
}
