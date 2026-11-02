// The shared header. At phone widths its button opens and closes the navigation; at tablet and desktop widths the navigation is always shown.
import React, { useEffect } from 'react';
import { Box, Button, Text } from '@chakra-ui/react';
import { useAsync } from '../state/useAsync';
import { useBalanceStore } from '../state/createStore';

export interface AppHeaderProps { navId: string; menuOpen: boolean; onToggleMenu: () => void }

const GUEST_KEY = 'guest-browser-id';
let memoryGuestId: string | null = null;

// 32 random hex characters. getRandomValues works on every origin (randomUUID needs a secure context, so plain http would fail).
const newGuestId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

// The guest allowance is keyed by a random id kept in this browser. Where storage is blocked the id lasts for the page only.
export function guestId(): string {
  try {
    const saved = localStorage.getItem(GUEST_KEY);
    if (saved) return saved;
    const id = newGuestId();
    localStorage.setItem(GUEST_KEY, id);
    return id;
  } catch {
    if (!memoryGuestId) memoryGuestId = newGuestId();
    return memoryGuestId;
  }
}

export interface BalanceReply { freeQueries: number; bonusCredits: number; priceCents: number | null }

async function loadBalance(): Promise<BalanceReply> {
  const res = await fetch('/api/billing/balance', { headers: { 'X-Guest-Id': guestId() } });
  if (!res.ok) throw new Error(`balance request failed with ${res.status}`);
  return res.json();
}

export function AppHeader({ navId, menuOpen, onToggleMenu }: AppHeaderProps) {
  const balance = useAsync(loadBalance, []);
  const loaded = balance.status === 'success' ? balance.data : null;
  const freeQueries = useBalanceStore((s) => s.freeQueries);
  const bonusCredits = useBalanceStore((s) => s.bonusCredits);

  useEffect(() => {
    if (loaded) useBalanceStore.setState(loaded);
  }, [loaded]);

  return (
    <Box as="header" display="flex" alignItems="center" minW={0} px={{ base: 4, sm: 6 }} py={2}>
      <Button
        display={{ base: 'inline-flex', sm: 'none' }}
        aria-controls={navId}
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
        sx={{ '@media (pointer: coarse)': { minH: 'touchTarget', minW: 'touchTarget' } }}
      >
        Menu
      </Button>
      {freeQueries !== null && bonusCredits !== null && (
        <Text ml="auto" fontSize="sm" aria-live="polite">
          Free queries: {freeQueries} · Credits: {bonusCredits}
        </Text>
      )}
    </Box>
  );
}
