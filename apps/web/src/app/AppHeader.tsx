// The shared header. At phone widths its button opens and closes the navigation; at tablet and desktop widths the navigation is always shown.
import React from 'react';
import { Box, Button } from '@chakra-ui/react';

export interface AppHeaderProps { navId: string; menuOpen: boolean; onToggleMenu: () => void }

export function AppHeader({ navId, menuOpen, onToggleMenu }: AppHeaderProps) {
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
    </Box>
  );
}
