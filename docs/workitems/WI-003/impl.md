Applications: web (primary)

# WI-003 Implementation plan: responsive app shell and layout

Requirement: REQ-006 (Responsive layout for desktop, tablet and mobile browsers). Feature FEAT-446.

## Decisions from the requirement Q&A
- Phone navigation: a collapsible menu opened from the header. No fixed bottom navigation bar.
- Breakpoints: phone below 640px; tablet 640px to 1023px; desktop 1024px and above.
- The app shell already exists on this branch (`scaffold/SCF-0001`). Use the existing shell and extend it. Do not create a new shell.
- Browser support: current versions of Chrome, Edge, Firefox and Safari, on desktop and mobile.

## Approach
- Use the existing app shell and extend it with a common header (with the phone menu toggle), a navigation area and a main content area. Pages render inside the shell so responsive behaviour is applied once, not per page.
- Apply the three breakpoints above in the shell and shared layout, using Chakra UI responsive style props, so content never exceeds the viewport width and no horizontal page scroll occurs.
- On phone widths, the navigation is hidden behind the header menu button and opens as a collapsible menu. The menu and its button are reachable and operable by touch and keyboard.
- Apply touch-friendly sizing to shared interactive primitives used by visitor pages (buttons, inputs, choice controls, example-query chips): minimum target size on touch devices, using the existing design tokens in `apps/web/src/styling/tokens.ts`.
- Keep presentation only. No new routes, content, copy or behaviour are added, and existing text and behaviour stay unchanged.

## Existing shell files (apps/web/src/app)
Files this work item will change:
- `App.tsx`: the existing shell. It renders the routed content inside the providers and error boundary. The header, navigation and content area are added around the routed content here, using components imported from `src/app/`.
- New header and navigation components under `src/app/` (for example `src/app/AppHeader.tsx` and `src/app/AppNav.tsx`), with the phone menu toggle. They are imported into `App.tsx`.
- `src/styling/tokens.ts`: breakpoint values for phone, tablet and desktop, and touch target sizes. Not one of the five files listed below, but the breakpoints cannot be set anywhere else in the existing shell (see Breakpoints).

Files this work item will not touch:
- `config.ts`: no change.
- `providers.tsx`: no change. The existing providers stay as they are.
- `router.tsx`: no change. Its marked lines are not edited by hand.
- `theme.ts`: no change. It only merges `chakraTokens` from `tokens.ts` and holds no breakpoints.

Other files likely affected (apps/web):
- `src/styling/ChakraAppProvider.tsx`: only if a token or theme change needs it.
- Tests under `apps/web/tests/` for the shell: renders header, navigation and content area; the phone menu opens and closes; navigation is reachable at phone width. Layout checks in real browsers are done manually (see Verification).

## Breakpoints
- `theme.ts` does not define breakpoints. It only lists `chakraTokens`.
- `tokens.ts` does not define breakpoints either. Chakra's default breakpoints apply until they are overridden there, and the defaults do not match the requirement (phone below 640px, tablet 640px to 1023px, desktop 1024px and above).
- The three breakpoints are added to `tokens.ts`, so `theme.ts` does not change.
- Tests under `apps/web/tests/` for the shell: renders header, navigation and content area; the phone menu opens and closes; navigation is reachable at phone width. Layout checks in real browsers are done manually (see Verification).

## Risks
- The repository has no visitor-facing pages registered yet (`src/app/router.tsx` has no entries). The responsive rules are verified on the shell and shared controls, and on pages once they are registered.
- Changing shared primitives can alter spacing or sizing on pages that already exist. Keep the changes to layout and sizing only.
- Horizontal scrolling and touch target sizes need a real browser check; jsdom tests do not cover layout.

## Assumptions
- The visitor-facing pages (welcome screen, query input, conversation, name-entry prompt) are delivered by other work items; this item provides the shell and the responsive rules they inherit.
- Chakra UI is the styling system already in use (`ChakraAppProvider`, `tokens.ts`).
- No new dependencies are needed.

## Verification
- Check the shell in a desktop browser (1024px and above), a tablet-sized viewport (640px to 1023px) and a phone-sized viewport (below 640px), in each browser listed above where practical.

## Acceptance (from REQ-006)
- Visitor-facing pages render without horizontal page scrolling at desktop, tablet and phone widths.
- One shared header and content area is used by all visitor-facing pages.
- Navigation and the optional name-entry prompt are reachable and operable on phone-sized screens.
- Interactive controls have touch-friendly target sizes on touch devices.
- Layout changes do not remove or alter any existing feature, text or behaviour.
- Responsive behaviour is checked in a desktop browser, a tablet-sized viewport and a phone-sized viewport.
