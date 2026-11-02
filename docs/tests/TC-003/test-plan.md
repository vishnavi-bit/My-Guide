# TC-003 Test plan: responsive app shell and layout

Requirement: REQ-006 (Responsive layout for desktop, tablet and mobile browsers).
Work item: WI-003 (Responsive app shell and layout for visitor pages).
Application: web (apps/web).

## Scope
Checks the shared app shell (header, navigation, main content area), the phone menu, and touch-friendly sizing of shared controls. No new features, content or copy are checked; existing text and behaviour must be unchanged.

## Viewports
- Desktop: 1280px wide (1024px and above).
- Tablet: 768px wide (640px to 1023px).
- Phone: 375px wide (below 640px).
- Repeat the browser-based scenarios in the current Chrome, Edge, Firefox and Safari where practical, on desktop and on a mobile device or device emulation.

## Automated tests (apps/web/tests/)
These run in jsdom and cover structure and behaviour, not layout.

1. Shell renders the header, navigation and main content area.
   - Steps: render the app shell with a sample routed child.
   - Expected: a header, a navigation region and a main content region are present; the child is rendered inside the main content region.

2. One shared shell wraps every routed page.
   - Steps: render two different routed pages inside the shell.
   - Expected: each page shows the same header and navigation, and only its own content changes.

3. Phone menu opens and closes.
   - Steps: set the viewport to phone width; activate the menu button in the header.
   - Expected: the navigation becomes visible and the menu button reports an expanded state; activating the button again hides the navigation and reports a collapsed state.

4. Navigation is reachable at phone width.
   - Steps: set phone width; focus the menu button with the keyboard and activate it with Enter, then move focus into the navigation.
   - Expected: every navigation item can be reached by keyboard after opening the menu.

5. Breakpoint values are applied from the shared tokens.
   - Steps: read the breakpoint values from `apps/web/src/styling/tokens.ts`.
   - Expected: phone is below 640px, tablet is 640px to 1023px, and desktop is 1024px and above.

## Manual browser checks (layout)
Each check is run at the viewport named in the step.

6. No horizontal page scrolling on visitor pages (desktop, tablet, phone).
   - Steps: open the welcome screen, a page with the query input, and a page with conversation content, at each viewport.
   - Expected: the page width fits the viewport; no horizontal scrollbar appears on the page.

7. Welcome screen, query input, example queries and conversation area stay fully visible.
   - Steps: at each viewport, view the welcome text, type a long question into the query input, show the example-query chips, and scroll the conversation area.
   - Expected: all content is visible and usable; no element is clipped or pushed outside the viewport.

8. Navigation and the name-entry prompt work on phone.
   - Steps: at 375px, open the menu from the header; open the optional "Set your name" prompt; complete and dismiss it.
   - Expected: the menu and the prompt are reachable by touch, open and close correctly, and the prompt can be skipped.

9. Touch-friendly targets on touch devices.
   - Steps: on a touch device or touch emulation at phone width, tap each button, input, choice control and example-query chip.
   - Expected: each target is comfortably tappable (the minimum target size from `tokens.ts` is met) and no tap hits a neighbouring control.

10. Layout change does not alter behaviour or text.
    - Steps: at desktop width, compare the welcome text, labels and the behaviour of the query input and example queries against the build from before WI-003.
    - Expected: text, labels and behaviour are unchanged; only spacing and sizing differ.

11. Desktop, tablet and phone checked in one browser each.
    - Steps: run checks 6 to 10 in a desktop browser, a tablet-sized viewport and a phone-sized viewport.
    - Expected: all checks pass at all three sizes.

## Exit criteria
- All automated tests in apps/web/tests/ for the shell pass.
- Manual checks 6 to 11 pass at the three viewports.
- No horizontal page scrolling is seen at any tested width.
