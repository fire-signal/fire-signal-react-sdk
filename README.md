# @fire-signal/react-sdk

React SDK for Fire Platform feature flags and client-side telemetry.

## What this package is for

Use this package in React apps when you need:

- Feature flag checks in UI (`useFlag`, `useVariantValue`, `useFlagDecision`, `FireFlag`)
- Event tracking from user actions (`useTrack`)
- Customer identification (`useIdentify`)

Do not use this package for backend jobs, queues, cron, or server automations.

---

## Security keys (for end users)

- `fp_pub_*` is a **publishable key** (safe for frontend)
- Use your publishable/client key in frontend apps (`NEXT_PUBLIC_*` env)
- Never put your **server/private/live secret key** in browser code

Rule of thumb: if key grants write/admin-level API access, keep it server-only.

---

## Installation

```bash
npm install @fire-signal/react-sdk
pnpm add @fire-signal/react-sdk
yarn add @fire-signal/react-sdk
bun add @fire-signal/react-sdk
```

Requirements:

- Node.js 18+
- React 18+

---

## 60-second setup (Next.js App Router)

### 1) Create a client provider

```tsx
// app/providers.tsx
'use client';

import { FireProvider } from '@fire-signal/react-sdk';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FireProvider
      publishableKey={process.env.NEXT_PUBLIC_FIRE_PUBLISHABLE_KEY!}
      host={process.env.NEXT_PUBLIC_API_URL} // optional (self-host/local)
      user={{ id: 'user_123' }}
      traits={{ plan: 'PLUS', locale: 'en-US' }}
    >
      {children}
    </FireProvider>
  );
}
```

### 2) Mount it in layout

```tsx
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## Which flag hook should I use?

If you want one default for most users, use `useFlag` first.

- Use `useFlag` when you only care about on/off (`enabled`)
- Use `useVariantValue<T>` when you need the flag value directly (promo code, number, JSON config)
- Use `useFlagDecision<T>` when you need full decision metadata for debugging/analytics

So yes: `useFlag` is the easiest default mental model.

---

## API: parameters and return values

### Shared types

```ts
type FlagsContext = {
  user?: { id: string; [k: string]: unknown };
  company?: { id: string; [k: string]: unknown };
  traits?: Record<string, unknown>;
};

type UseFlagOptions = {
  enabled?: boolean;   // default: true
  refreshMs?: number;  // no auto-refresh when omitted/0
};
```

### `useFlag`

```ts
useFlag(flag: string, context?: FlagsContext, options?: UseFlagOptions)
```

Returns:

- `enabled: boolean`
- `loading: boolean`
- `error?: Error`
- `decision?: FlagDecision`
- `refetch(): Promise<void>`

Example:

```tsx
const checkoutFlow = useFlag('checkout.new-flow');
if (checkoutFlow.loading) return null;
return checkoutFlow.enabled ? <NewCheckout /> : <ClassicCheckout />;
```

### `useVariantValue<T>`

```ts
useVariantValue<T>(
  flag: string,
  context?: FlagsContext,
  fallback?: T | null,
  options?: UseFlagOptions
)
```

Returns:

- `value: T | null | undefined` (or your fallback)
- `enabled: boolean`
- `loading: boolean`
- `error?: Error`
- `decision?: FlagDecision<T>`
- `refetch(): Promise<void>`

Example:

```tsx
const promo = useVariantValue<string>('checkout.promocode', {}, null);
return promo.enabled && promo.value ? <p>Promo: {promo.value}</p> : null;
```

### `useFlagDecision<T>`

```ts
useFlagDecision<T>(flag: string, context?: FlagsContext, options?: UseFlagOptions)
```

Use when you need the whole decision object (`reason`, `variantKey`, `fetchedAt`, etc).

Example:

```tsx
const d = useFlagDecision('checkout.new-flow', { traits: { country: 'BR' } });
if (d.loading) return null;
return <pre>{JSON.stringify(d.decision, null, 2)}</pre>;
```

---

## Automatic refresh (`refreshMs`) explained

`refreshMs` is polling interval in **milliseconds**.

- `10_000` means 10 seconds (`_` is just numeric separator in JS/TS)
- hook calls `refetch()` automatically every interval
- useful when flags can change while user stays on page

Example:

```tsx
const promo = useVariantValue<string>(
  'checkout.promocode',
  {},
  null,
  { refreshMs: 10_000 }
);
```

If you do not need polling, omit `refreshMs` and call `refetch()` only when needed.

---

## Better identify + track example

```tsx
'use client';

import { useIdentify, useTrack } from '@fire-signal/react-sdk';

export function CompleteCheckoutButton({
  userId,
  email,
  workspaceId,
  amount,
}: {
  userId: string;
  email: string;
  workspaceId: string;
  amount: number;
}) {
  const identify = useIdentify();
  const track = useTrack();

  const onClick = async () => {
    // 1) keep identity up to date
    await identify(userId, {
      email,
      plan: 'PLUS',
      workspaceId,
    });

    // 2) track action with explicit event properties
    await track('checkout.completed', {
      user: { id: userId },
      properties: {
        amount,
        currency: 'USD',
        workspaceId,
      },
    });
  };

  return <button onClick={onClick}>Complete checkout</button>;
}
```

Why this is better:

- identifies user first
- sends business properties in event payload
- keeps event names explicit and consistent

---

## `FireProvider` options

```ts
type FireProviderProps = {
  publishableKey: string;
  host?: string;
  strictPlatformProvider?: boolean;
  user?: { id: string; [k: string]: unknown };
  company?: { id: string; [k: string]: unknown };
  traits?: Record<string, unknown>;
};
```

Behavior of `strictPlatformProvider`:

- `false` (default): evaluation failures return disabled decision with reason
- `true`: evaluation failures throw and appear in hook `error`

Recommended:

- `true` in development (faster setup debugging)
- `false` in production (safe fallback behavior)

---

## Runtime behavior notes

- Decision fetch runs on mount for each `flag + context` key
- Decisions are cached in memory in current runtime/tab
- In-flight duplicate requests are deduplicated
- `refetch()` invalidates cache for that key and fetches again
- `enabled: false` disables evaluation for that hook call

---

## Troubleshooting

### "I enabled a flag but UI did not update"

- No `refreshMs`: hook evaluates on mount, then stays cached
- Call `refetch()` manually or enable polling with `refreshMs`

### "Flag is always disabled"

- verify `publishableKey` is correct (`fp_pub_*`)
- verify component is inside `FireProvider`
- verify `host` points to correct API
- verify flag is enabled in correct project/environment

### "Hook is always loading"

- check browser network errors/CORS
- check API host reachability
- try `strictPlatformProvider={true}` to expose failures via `error`

### Next.js hook/hydration issues

- mark hook components with `'use client'`
- keep `FireProvider` in a client wrapper component

---

## Vite example

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { FireProvider } from '@fire-signal/react-sdk';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FireProvider
      publishableKey={import.meta.env.VITE_FIRE_PUBLISHABLE_KEY}
      host={import.meta.env.VITE_FIRE_API_URL}
      user={{ id: 'user_123' }}
      traits={{ plan: 'PLUS' }}
    >
      <App />
    </FireProvider>
  </React.StrictMode>
);
```
