Applications: web (primary)

# WI-003 Implementation plan: responsive app shell and layout

Requirement: REQ-006 (Responsive layout for desktop, tablet and mobile browsers). Feature FEAT-446.

## Decisions from the requirement Q&A
- Phone navigation: a collapsible menu opened from the header. No fixed bottom navigation bar.
- Breakpoints: phone below 640px; tablet 640px to 1023px; desktop 1024px and above.
- The app shell is created now, because the repository has no shell yet.
- Browser support: current versions of Chrome, Edge, Firefox and Safari, on desktop and mobile.

## Approach
- Create a shared app shell in the web app: a common header (with the phone menu toggle), a navigation area and a main content area. Pages render inside the shell so responsive behaviour is applied once, not per page.
- Apply the three breakpoints above in the shell and shared layout, using Chakra UI responsive style props, so content never exceeds the viewport width and no horizontal page scroll occurs.
- On phone widths, the navigation is hidden behind the header menu button and opens as a collapsible menu. The menu and its button are reachable and operable by touch and keyboard.
- Apply touch-friendly sizing to shared interactive primitives used by visitor pages (buttons, inputs, choice controls, example-query chips): minimum target size on touch devices, using the existing design tokens in `apps/web/src/styling/tokens.ts`.
- Keep presentation only. No new routes, content, copy or behaviour are added, and existing text and behaviour stay unchanged.

## Areas and files likely affected (apps/web)
- `src/app/App.tsx`: the shell wrapper is rendered around the routed content. The file already holds the app shell logic (providers, router, error boundary), so the shell layout component is added beside it rather than in the glue.
- `src/app/providers.tsx` and `src/app/router.tsx`: glue files. Only edited if a shell provider or route registration is needed, through their marked entry points.
- `src/styling/ChakraAppProvider.tsx` and `src/styling/tokens.ts`: breakpoint values and touch target size tokens, if they are added as tokens rather than inline values.
- New shell component(s) under `src/app/` (header with menu toggle, navigation, content area), for example `src/app/AppShell.tsx`.
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
