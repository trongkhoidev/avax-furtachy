# WolfDAO Interface Design System

## 1. Visual theme and atmosphere

WolfDAO is a focused Avalanche governance exchange: calm, data-dense, and precise. Use a Polymarket-like information hierarchy for live markets—clear outcome prices, concise status, visible liquidity, and direct actions—while keeping its distinct wolf identity. Keep the layout balanced rather than decorative. Density 7/10, variance 4/10, motion 2/10.

## 2. Color palette and roles

Use the existing WolfDAO red family as the single brand accent. It marks primary actions, selection, keyboard focus, and brand details. It does not color every chart or every card.

- **Wolf Mark Red** (`#E41426`) — logo mark only.
- **Wolf Action Red** (`#B83E45`) — primary action, active navigation, and focus indicator in light mode.
- **Wolf Action Red, dark** (`#A9343E`) — primary action and focus indicator in dark mode.
- **Wolf Coral** (`#E36B60`) — restrained brand accent for light-mode labels and data highlights.
- **Snow** (`#F7F8F8`) — light canvas.
- **Paper** (`#FFFFFF`) — raised light surface.
- **Cloud Ink** (`#202427`) — light-mode text.
- **Night Canvas** (`#151819`) — dark canvas; never use pure black.
- **Night Surface** (`#1E2224`) — dark raised surface.
- **Muted Slate** (`#788186`) — secondary text and metadata.
- **Structural Border** (`#DDE1E2` light, `#343A3D` dark) — separators and control boundaries.
- **Pass Green** (`#26845B`) and **Fail Red** (`#C14D52`) — semantic outcome colors only; never use them as brand accents.

Keep all page surfaces on this neutral scale. Do not introduce gradients or alternate blue/purple/orange accents. Always pair Pass/Fail colors with text labels and icon/shape cues.

## 3. Typography

- **Interface and headings:** Geist Sans. Use weight and color for hierarchy; keep headlines compact and left-aligned.
- **Numbers, addresses, chain IDs, and transaction hashes:** Geist Mono with tabular figures.
- **Body:** Geist Sans, relaxed line-height, with explanatory copy limited to roughly 65 characters per line.
- Do not use Inter or generic serif fonts in application UI.

## 4. Component styling

- **Buttons:** Wolf Action Red for the single primary action in a view; use neutral outline or quiet controls for secondary actions. Provide hover, focus-visible, disabled, and pressed states. Pressed buttons move down by one pixel; no glow.
- **Market rows:** Prefer compact, aligned rows with outcome prices, state, and available liquidity visible at a glance. Use Pass Green and Fail Red only for outcomes. Separate rows with borders and whitespace rather than stacked decorative cards.
- **Panels:** Use a raised surface and a fine border only when grouping improves scanability. Keep corners between 8 and 14 pixels. Avoid heavy shadows.
- **Inputs:** Labels above fields, helper or error copy below, minimum 44-pixel touch height, visible focus ring.
- **Wallet and network controls:** Keep wallet identity separate from network state. Show the actual chain name and ID; explain a wrong network with a direct switch action.
- **Loading:** Use layout-matched skeletons. Do not invent prices or progress.
- **Empty and error states:** Name the missing live source (RPC, factory, indexer, or contract) and show a relevant recovery action. Never substitute sample records.

## 5. Layout and responsive behavior

Use a centered content width up to 1,280 pixels, with a dense desktop market table and a clear 2-column detail layout where useful. Below 768 pixels, collapse columns into a single reading order, preserve 44-pixel touch targets, and prevent horizontal page scrolling. Use CSS Grid for market data alignment. Keep every section in its own visual zone.

## 6. Motion and interaction

Motion is restrained: 140–200 ms opacity and transform transitions for menus, tabs, and buttons. Respect `prefers-reduced-motion`. Do not animate prices, fabricate live activity, or use perpetual shimmer outside loading states.

## 7. Banned patterns

- No synthetic markets, fabricated agent records, sample prices, or placeholder activity presented as live data.
- No user-facing “simulation mode” or local market fixtures.
- No pure-black surfaces, neon accents, purple/blue glow, or decorative gradients.
- No three-equal-card feature rows, oversized centered hero, emoji, fake performance statistics, or filler copy.
- Do not report a project, market, forecast, payment, or transaction as live unless the connected Fuji contract or indexed event confirms it.
