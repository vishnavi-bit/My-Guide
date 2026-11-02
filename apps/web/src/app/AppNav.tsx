// The navigation area. It is visible at tablet and desktop widths. At phone widths it is shown only while the header menu is open.
import React from 'react';
import { Box } from '@chakra-ui/react';

export interface AppNavProps { id: string; open: boolean; children?: React.ReactNode }

export function AppNav({ id, open, children }: AppNavProps) {
  return (
    <Box as="nav" id={id} aria-label="Main" display={{ base: open ? 'block' : 'none', sm: 'block' }} minW={0} px={{ base: 4, sm: 6 }}>
      {children}
    </Box>
  );
}
