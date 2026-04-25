# @fire-signal/react-sdk

React SDK for Fire Platform features powered by `fire-signal`.

## Contents

- [Quick Decision Guide](#quick-decision-guide)
- [Requirements](#requirements)
- [Installation](#installation)
- [60-Second Quick Start](#60-second-quick-start)
- [Applied Recipes](#applied-recipes)
- [API Snapshot](#api-snapshot)
- [Troubleshooting](#troubleshooting)
- [Backend and Core SDK](#backend-and-core-sdk)

Use when app needs:

- Feature flags (`useFlag`, `useVariantValue`, `useFlagDecision`, `FireFlag`)
- Product events (`useTrack`)
- Customer identity (`useIdentify`)

---

## Quick Decision Guide

Use this package if you want a React-first API for feature gating and product telemetry.

Do not use this package alone for backend-only workflows (jobs, cron, server automations). In that case, use `fire-signal` core SDK directly.

Use `@fire-signal/react-sdk` for UI/runtime concerns.

Use `fire-signal` core SDK for server-side automation and non-React execution contexts.

---

## Requirements

- Node.js 18+
- React 18+
- `fire-signal` installed in same app

Notes:

- Works with Next.js App Router (`'use client'` where needed).
- `FireProvider` must run on client side.
- `publishableKey` is safe for browser usage (`fp_pub_*`).
- Never expose secret keys in frontend code.

---

## Installation

```bash
npm install fire-signal @fire-signal/react-sdk
```

```bash
pnpm add fire-signal @fire-signal/react-sdk
yarn add fire-signal @fire-signal/react-sdk
bun add fire-signal @fire-signal/react-sdk
```

---

## 60-Second Quick Start

```tsx
import { FireProvider, useFlag } from '@fire-signal/react-sdk';

function CheckoutEntry() {
  const { enabled, loading } = useFlag('checkout.new-flow');
  if (loading) return null;
  return enabled ? <div>New checkout enabled</div> : <div>Classic checkout</div>;
}

export default function App() {
  return (
    <FireProvider
      publishableKey="fp_pub_xxx"
      user={{ id: 'user_123' }}
      company={{ id: 'acme_inc' }}
      traits={{ plan: 'PLUS', locale: 'pt-BR' }}
    >
      <CheckoutEntry />
    </FireProvider>
  );
}
```

Notes:

- In common cloud setup, only `publishableKey` is required.
- `host` is optional (custom/self-hosted API host only).

---

## 5-Minute Checklist

1. Install `fire-signal` and `@fire-signal/react-sdk`.
2. Add `FireProvider` in your app client root.
3. Add one boolean gate with `useFlag`.
4. Add one config variant with `useVariantValue<T>`.
5. Add one `track` call in a real user action.
6. Validate values in Fire Platform dashboard.

If steps 3-5 work, SDK integration is healthy.

---

## Applied Recipes

### 1) Provider wrapper (Next.js)

```tsx
// app/providers.tsx
'use client';

import { FireProvider } from '@fire-signal/react-sdk';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FireProvider
      publishableKey={process.env.NEXT_PUBLIC_FIRE_PUBLISHABLE_KEY!}
      user={{ id: 'user_123' }}
      company={{ id: 'acme_inc' }}
      traits={{ plan: 'PLUS', country: 'BR' }}
    >
      {children}
    </FireProvider>
  );
}
```

Placement tip:

- Keep provider as high as possible in client tree, so all flag/event hooks share same context.

### 1.1) Provider wrapper (Vite/SPA)

```tsx
// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { FireProvider } from '@fire-signal/react-sdk';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FireProvider
      publishableKey={import.meta.env.VITE_FIRE_PUBLISHABLE_KEY}
      user={{ id: 'user_123' }}
      traits={{ plan: 'PLUS' }}
    >
      <App />
    </FireProvider>
  </React.StrictMode>
);
```

### 2) Feature flag + variant in page logic

```tsx
'use client';

import { useFlag, useVariantValue } from '@fire-signal/react-sdk';

export default function CheckoutPage() {
  const newFlow = useFlag('checkout.new-flow');
  const promo = useVariantValue<string>('checkout.promocode', {}, null);

  if (newFlow.loading) return null;

  return (
    <main>
      {promo.enabled && promo.value ? <p>Coupon: {promo.value}</p> : null}
      {newFlow.enabled ? <button>Continue (new)</button> : <button>Continue</button>}
    </main>
  );
}
```

### 3) Declarative flag rendering with `FireFlag`

```tsx
import { FireFlag } from '@fire-signal/react-sdk';

function PromoBanner() {
  return (
    <FireFlag<string>
      flag="checkout.promocode"
      fallback={<span>No promo available</span>}
    >
      {(decision) => <span>Promo: {decision.value}</span>}
    </FireFlag>
  );
}
```

### 4) Identify + track in user flow

```tsx
import { useIdentify, useTrack } from '@fire-signal/react-sdk';

function LoginSuccessButton() {
  const identify = useIdentify();
  const track = useTrack();

  const onLoginSuccess = async () => {
    await identify('user_123', {
      email: 'ana@acme.com',
      plan: 'PLUS',
      locale: 'pt-BR',
    });

    await track('user.login_succeeded', {
      user: { id: 'user_123' },
      properties: { method: 'password' },
    });
  };

  return <button onClick={onLoginSuccess}>Simulate login success</button>;
}
```

Operational tip:

- `identify` before critical `track` calls when event semantics depend on user traits.

### 5) Override context per decision call

```tsx
import { useFlagDecision } from '@fire-signal/react-sdk';

function CountrySpecificGate() {
  const decision = useFlagDecision('checkout.new-flow', {
    user: { id: 'user_123' },
    traits: { country: 'BR' },
  });

  if (decision.loading) return null;
  return <pre>{JSON.stringify(decision.decision, null, 2)}</pre>;
}
```

### 6) Safe error handling pattern

```tsx
import { useFlag } from '@fire-signal/react-sdk';

function PaymentGate() {
  const gate = useFlag('payments.new-checkout');

  if (gate.loading) return <span>Loading feature gate...</span>;
  if (gate.error) return <span>Using safe fallback checkout</span>;

  return gate.enabled ? <NewCheckout /> : <ClassicCheckout />;
}
```

---

## API Snapshot

### Type signatures

```ts
type FireProviderProps = {
  publishableKey: string;
  host?: string;
  strictPlatformProvider?: boolean;
  user?: { id: string; [k: string]: unknown };
  company?: { id: string; [k: string]: unknown };
  traits?: Record<string, unknown>;
};

type UseFlagResult = {
  enabled: boolean;
  loading: boolean;
  error?: Error;
  decision?: unknown;
  refetch: () => Promise<unknown>;
};
```

### `FireProvider`

```tsx
<FireProvider
  publishableKey="fp_pub_xxx"
  host="api.fire-signal.com"
  strictPlatformProvider={false}
  user={{ id: 'user_123' }}
  company={{ id: 'acme_inc' }}
  traits={{ plan: 'PLUS' }}
>
  {children}
</FireProvider>
```

Key props:

- `publishableKey` (required)
- `host` (optional)
- `strictPlatformProvider` (optional)
- `user`, `company`, `traits` (optional base context)

Behavioral notes:

- `strictPlatformProvider={false}`: warn + no-op when provider target missing.
- `strictPlatformProvider={true}`: throw errors early (recommended for development).

### Hooks and components

- `useFlag(flag, context?, options?)`
  - returns: `enabled`, `loading`, `error`, `decision`, `refetch()`
- `useVariantValue<T>(flag, context?, fallback?, options?)`
  - returns: `value`, `enabled`, `loading`, `error`, `decision`, `refetch()`
- `useFlagDecision<T>(flag, context?, options?)`
  - returns full decision payload
- `FireFlag`
  - declarative rendering with `fallback`
- `useTrack()`
  - returns `(eventName, payload?) => Promise<boolean>`
- `useIdentify()`
  - returns `(externalId, traits?) => Promise<boolean>`

Practical guidance:

- Prefer `useFlag` for boolean gates.
- Prefer `useVariantValue<T>` when flag controls data/config values.
- Use `useFlagDecision<T>` when you need full decision metadata for diagnostics.

### Behavior defaults

- Decision hooks start as `loading=true` until first resolution.
- `refetch()` forces reevaluation with current context.
- `useVariantValue<T>` returns provided fallback when flag disabled or missing value.
- `FireFlag` fallback renders when flag disabled, loading failed, or no valid value path.

---

## Framework Notes

### Next.js App Router

- Keep hooks only in client components (`'use client'`).
- Wrap layout subtree via client `Providers` component.
- Avoid reading browser-only env vars in server components.

### CSR-only apps (Vite/CRA)

- Mount `FireProvider` once near root.
- Keep user/traits source stable to avoid unnecessary reevaluations.

### SSR and edge runtimes

- This package is client-first.
- For server-side evaluations and backend automations, use core `fire-signal` SDK.

---

## Testing Recipes

### Component tests with lightweight mock

```tsx
// example: vitest/jest setup file
vi.mock('@fire-signal/react-sdk', async () => {
  const actual = await vi.importActual<typeof import('@fire-signal/react-sdk')>('@fire-signal/react-sdk');
  return {
    ...actual,
    useFlag: () => ({ enabled: true, loading: false, refetch: async () => ({}) }),
  };
});
```

### Integration sanity test

- Render app with real `FireProvider` in test environment.
- Assert `loading -> resolved` state transition for one known flag.
- Assert one `track` call resolves `true` for valid event payload.

---

## Troubleshooting

### "Nothing happens" when calling track/identify

By default, missing platform target causes warn + no-op behavior.

If you want hard failure in development, enable strict mode:

```tsx
<FireProvider publishableKey="fp_pub_xxx" strictPlatformProvider>
  {children}
</FireProvider>
```

### Flags always loading

Check:

- `publishableKey` format (`fp_pub_*`)
- app wrapped by `FireProvider`
- environment has network access to Fire API host
- custom `host` correct when self-hosted

### Events are sent but not showing in expected audience/segment

Check:

- `identify` was called with correct `externalId`
- `track` payload includes expected `user` context
- trait names in app match trait names used in platform rules

### Hydration or hook errors in Next.js

Check:

- components using hooks are marked with `'use client'`
- `FireProvider` is mounted in a client wrapper (not server component)

---

## Backend and Core SDK

For backend usage (`track`, `identify`, `incident.report`, `flags.*`) and core SDK docs:

- root package docs: `../../README.md`
- complete guide: `../../docs/SDK_COMPLETE_GUIDE.md`
