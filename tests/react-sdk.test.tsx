import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FireProvider,
  FireFlag,
  useFlag,
  useIdentify,
  useTrack,
  useVariantValue,
} from '../src';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as Response;
}

function FlagProbe() {
  const { enabled, loading } = useFlag('checkout.new-flow');
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="enabled">{String(enabled)}</span>
    </div>
  );
}

function VariantProbe() {
  const { value } = useVariantValue<string>('checkout.promocode');
  return <span data-testid="value">{value || 'none'}</span>;
}

function EventProbe() {
  const track = useTrack();
  const identify = useIdentify();

  React.useEffect(() => {
    void identify('user_123', { plan: 'PLUS', email: 'u@test.com' });
    void track('checkout.started', { properties: { amount: 20 } });
  }, [identify, track]);

  return <span data-testid="events">ok</span>;
}

function RerenderProbe({ flag }: { flag: string }) {
  const [count, setCount] = React.useState(0);
  const { value } = useVariantValue<string>(flag);

  React.useEffect(() => {
    if (count < 5) setCount((n) => n + 1);
  }, [count]);

  return (
    <div>
      <span data-testid="count">{count}</span>
      <span data-testid="rerender-value">{value || 'none'}</span>
    </div>
  );
}

function RefreshProbe() {
  const { value } = useVariantValue<string>('checkout.refresh', {}, null, {
    refreshMs: 20,
  });
  return <span data-testid="refresh-value">{value || 'none'}</span>;
}

function SwitchProbe({ flag }: { flag: string }) {
  const { value, loading } = useVariantValue<string>(flag);
  return (
    <div>
      <span data-testid="switch-loading">{String(loading)}</span>
      <span data-testid="switch-value">{value || 'none'}</span>
    </div>
  );
}

function DisabledProbe() {
  const { value, loading } = useVariantValue<string>('checkout.disabled', {}, null, {
    enabled: false,
  });
  return (
    <div>
      <span data-testid="disabled-loading">{String(loading)}</span>
      <span data-testid="disabled-value">{value || 'none'}</span>
    </div>
  );
}

describe('@fire-signal/react-sdk', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValue(
      jsonResponse({
        results: {
          'checkout.new-flow': {
            enabled: true,
            value: true,
            reason: 'rule matched',
          },
          'checkout.promocode': {
            enabled: true,
            value: '30OFF',
            reason: 'rule matched',
          },
        },
      })
    );
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('evaluates flag via useFlag and returns enabled', async () => {
    render(
      <FireProvider publishableKey="fp_pub_123" host="http://localhost:2001">
        <FlagProbe />
      </FireProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('enabled').textContent).toBe('true');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:2001/v1/flags/evaluate',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('renders FireFlag children when enabled', async () => {
    render(
      <FireProvider publishableKey="fp_pub_123" host="http://localhost:2001">
        <FireFlag<string> flag="checkout.promocode" fallback={<span>fallback</span>}>
          {(decision) => <span>{decision.value}</span>}
        </FireFlag>
      </FireProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('30OFF')).toBeTruthy();
    });
  });

  it('supports variant helper and event helpers', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: {
            'checkout.promocode': {
              enabled: true,
              value: '30OFF',
            },
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    render(
      <FireProvider publishableKey="fp_pub_123" host="http://localhost:2001">
        <VariantProbe />
        <EventProbe />
      </FireProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe('30OFF');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:2001/v1/customers/identify',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:2001/v1/events/track',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('dedupes flag evaluate requests on rapid rerenders', async () => {
    const rerenderFlag = 'checkout.promocode.rerender';
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: {
          [rerenderFlag]: {
            enabled: true,
            value: '30OFF',
          },
        },
      })
    );

    render(
      <FireProvider publishableKey="fp_pub_123" host="http://localhost:2001">
        <RerenderProbe flag={rerenderFlag} />
      </FireProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('5');
      expect(screen.getByTestId('rerender-value').textContent).toBe('30OFF');
    });

    const evaluateCalls = fetchMock.mock.calls.filter(
      ([url]) => url === 'http://localhost:2001/v1/flags/evaluate'
    );
    expect(evaluateCalls).toHaveLength(1);
  });

  it('re-fetches when refreshMs is provided', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: {
            'checkout.refresh': { enabled: true, value: 'A' },
          },
        })
      )
      .mockResolvedValue(
        jsonResponse({
          results: {
            'checkout.refresh': { enabled: true, value: 'B' },
          },
        })
      );

    render(
      <FireProvider publishableKey="fp_pub_123" host="http://localhost:2001">
        <RefreshProbe />
      </FireProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('refresh-value').textContent).toBe('A');
    });

    await new Promise((resolve) => setTimeout(resolve, 40));

    await waitFor(() => {
      expect(screen.getByTestId('refresh-value').textContent).toBe('B');
    });
  });

  it('clears stale decision when flag key changes', async () => {
    let resolveSecond: ((value: Response) => void) | undefined;
    const secondResponse = new Promise<Response>((resolve) => {
      resolveSecond = resolve;
    });

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: {
            'checkout.flag.a': { enabled: true, value: 'A' },
          },
        })
      )
      .mockImplementationOnce(() => secondResponse);

    const { rerender } = render(
      <FireProvider publishableKey="fp_pub_123" host="http://localhost:2001">
        <SwitchProbe flag="checkout.flag.a" />
      </FireProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('switch-value').textContent).toBe('A');
    });

    rerender(
      <FireProvider publishableKey="fp_pub_123" host="http://localhost:2001">
        <SwitchProbe flag="checkout.flag.b" />
      </FireProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('switch-loading').textContent).toBe('true');
    });
    expect(screen.getByTestId('switch-value').textContent).toBe('none');

    resolveSecond?.(
      jsonResponse({
        results: {
          'checkout.flag.b': { enabled: true, value: 'B' },
        },
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('switch-value').textContent).toBe('B');
    });
  });

  it('returns fallback when hook disabled', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: {
          'checkout.disabled': { enabled: true, value: 'SHOULD_NOT_APPEAR' },
        },
      })
    );

    render(
      <FireProvider publishableKey="fp_pub_123" host="http://localhost:2001">
        <DisabledProbe />
      </FireProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('disabled-loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('disabled-value').textContent).toBe('none');
    expect(fetchMock).not.toHaveBeenCalledWith(
      'http://localhost:2001/v1/flags/evaluate',
      expect.anything()
    );
  });
});
