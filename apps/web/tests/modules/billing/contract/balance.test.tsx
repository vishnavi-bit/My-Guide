/** @jest-environment jsdom */
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderApp } from '../../../../src/testing/render';
import { AppHeader, guestId } from '../../../../src/app/AppHeader';
import { PriceConfirm } from '../../../../src/app/PriceConfirm';
import { useBalanceStore } from '../../../../src/state/createStore';

const header = () => <AppHeader navId="app-nav" menuOpen={false} onToggleMenu={() => undefined} />;

describe('billing on the web (WI-004)', () => {
  beforeEach(() => {
    localStorage.clear();
    useBalanceStore.getState().reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('the price confirmation shows the exact price and what the user receives, and hands over on confirm or cancel', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    renderApp(<PriceConfirm priceCents={250} answeredQueries={1} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('heading', { name: 'Confirm price' })).toBeTruthy();
    expect(screen.getByText(/Price: 2\.50\. You receive 1 answered query\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('the header loads the balance as this browser guest and shows the remaining free queries and credits', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ freeQueries: 2, bonusCredits: 2, priceCents: null }) }));
    (globalThis as any).fetch = fetchMock;
    renderApp(header());
    expect(await screen.findByText(/Free queries: 2 · Credits: 2/)).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toBe('/api/billing/balance');
    expect(init.headers['X-Guest-Id']).toBe(guestId());
    expect(useBalanceStore.getState()).toMatchObject({ freeQueries: 2, bonusCredits: 2 });
  });

  it('shows no balance when the request fails, and the page still works', async () => {
    (globalThis as any).fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    renderApp(header());
    await waitFor(() => expect((globalThis as any).fetch).toHaveBeenCalled());
    expect(screen.queryByText(/Free queries/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
  });

  it('the guest id is kept in the browser: the same id is returned on every call', () => {
    const first = guestId();
    expect(first.length).toBeGreaterThanOrEqual(8);
    expect(guestId()).toBe(first);
    expect(localStorage.getItem('guest-browser-id')).toBe(first);
  });
});
