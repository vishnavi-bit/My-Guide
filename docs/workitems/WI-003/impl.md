Applications: web (primary)

# WI-003 Implementation plan: responsive app shell and layout

Requirement: REQ-006 (Responsive layout for desktop, tablet and mobile browsers). Feature FEAT-446.

## Approach
- Create a shared app shell in the web app: a common header, a navigation area and a main content area. Pages render inside the shell so responsive behaviour is applied once, not per page.
- Apply responsive layout rules in the shell (Chakra UI responsive style props, breakpoints for phone, tablet and desktop) so content never exceeds the viewport width and no horizontal page scroll occurs.
- Apply touch-friendly sizing to shared interactive primitives used by visitor pages (buttons, inputs, choice controls, example-query chips): minimum target size on touch devices, using the existing design tokens in `apps/web/src/styling/tokens.ts`.
- Keep presentation only. No new routes, content, copy or behaviour are added, and existing text and behaviour stay unchanged.

## Areas and files likely affected (apps/web)
- `src/app/App.tsx`: the shell wrapper is rendered around the routed content. The file already holds the app shell logic (providers, router, error boundary), so the shell layout component is added beside it rather than in the glue.
- `src/app/providers.tsx` and `src/app/router.tsx`: glue files. Only edited if a shell provider or route registration is needed, through their marked entry points.
- `src/styling/ChakraAppProvider.tsx` and `src/styling/tokens.ts`: responsive breakpoints and touch target size tokens, if they are added as tokens rather than inline values.
- New shell component(s) under `src/app/` (header, navigation, content area), for example `src/app/AppShell.tsx`.
- Tests under `apps/web/tests/` for the shell: renders header, navigation and content area; no horizontal overflow at the defined widths where testable in jsdom; navigation reachable on phone width.

## Risks
- The repository has no visitor-facing pages registered yet (`src/app/router.tsx` has no entries). The responsive rules are verified on the shell and shared controls, and on pages once they are registered.
- Changing shared primitives can alter spacing or sizing on pages that already exist. Keep the changes to layout and sizing only.
- Verification of horizontal scrolling and touch target sizes needs a real browser check (desktop, tablet-sized viewport, phone-sized viewport); jsdom tests do not cover layout.

## Assumptions
- The visitor-facing pages (welcome screen, query input, conversation, name-entry prompt) are delivered by other work items; this item provides the shell and the responsive rules they inherit.
- Chakra UI is the styling system already in use (`ChakraAppProvider`, `tokens.ts`).
- No new dependencies are needed.

## Acceptance (from REQ-006)
- Visitor-facing pages render without horizontal page scrolling at desktop, tablet and phone widths.
- One shared header and content area is used by all visitor-facing pages.
- Navigation and the optional name-entry prompt are reachable and operable on phone-sized screens.
- Interactive controls have touch-friendly target sizes on touch devices.
- Layout changes do not remove or alter any existing feature, text or behaviour.
- Responsive behaviour is checked in a desktop browser, a tablet-sized viewport and a phone-sized viewport.
