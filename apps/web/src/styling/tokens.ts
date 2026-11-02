// The app's design tokens for Chakra UI (colors, fonts, color-mode behaviour). Registered in the theme glue; other modules may add
// their own tokens there and they are merged in order (later wins).
export const chakraTokens = {
  config: { initialColorMode: 'light', useSystemColorMode: false },
  colors: {
    brand: {
      50: '#e8f1ff', 100: '#c5dbff', 200: '#9fc3ff', 300: '#79aaff', 400: '#5392ff',
      500: '#2d79ff', 600: '#2361cc', 700: '#1a4999', 800: '#113166', 900: '#091933'
    }
  },
  fonts: { heading: 'system-ui, sans-serif', body: 'system-ui, sans-serif' },
  // Phone is below 640px, tablet 640px to 1023px, desktop 1024px and above. Chakra's own sm and md are overridden here.
  breakpoints: { sm: '640px', md: '1024px' },
  // Minimum size of an interactive control on touch devices (44px, the common touch target guideline).
  sizes: { touchTarget: '44px' }
};
