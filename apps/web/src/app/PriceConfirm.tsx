// The price confirmation shown before a payment is requested (WI-004): the exact price and what the user receives for it. Nothing is
// charged from here; confirming hands over to the existing payment step.
import React from 'react';
import { Box, Button, Text } from '@chakra-ui/react';

export interface PriceConfirmProps {
  priceCents: number;
  answeredQueries: number;
  onConfirm(): void;
  onCancel(): void;
}

export function PriceConfirm({ priceCents, answeredQueries, onConfirm, onCancel }: PriceConfirmProps) {
  return (
    <Box as="section" aria-labelledby="price-confirm-title" borderWidth="1px" borderRadius="md" p={4}>
      <Text id="price-confirm-title" as="h2" fontWeight="semibold">Confirm price</Text>
      <Text>
        Price: {(priceCents / 100).toFixed(2)}. You receive {answeredQueries} answered {answeredQueries === 1 ? 'query' : 'queries'}.
      </Text>
      <Box display="flex" gap={2} mt={3}>
        <Button
          colorScheme="brand"
          onClick={onConfirm}
          sx={{ '@media (pointer: coarse)': { minH: 'touchTarget' } }}
        >
          Continue to payment
        </Button>
        <Button
          variant="ghost"
          onClick={onCancel}
          sx={{ '@media (pointer: coarse)': { minH: 'touchTarget' } }}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
