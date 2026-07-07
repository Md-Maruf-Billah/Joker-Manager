# Testing Checklist

## Core Jackpot Rules

- Fresh jackpot starts at `$0` and `53` cards.
- Hyper Turbo with `10` entries adds `$400`.
- Sunday Slam with `10` entries adds `$500`.
- Tournament run is saved as `Awaiting Draw`.
- Draw result cannot be submitted without winner name.
- Removed card cannot be selected again.
- Non-Joker card reduces cards remaining by `1`.
- Non-Joker card rolls jackpot forward.
- Joker hit pays opening jackpot plus tonight contribution.
- Joker hit resets jackpot to `$0`.
- Joker hit resets deck to `53`.
- Joker hit creates a new active cycle.

## TV Logic

- Latest Joker winner shows from `53` to `48` cards remaining.
- Latest Joker winner hides at `47` cards and lower.
- Probability hides from `53` to `21` cards remaining.
- Probability shows at `20` cards and lower.
- Fresh tier: `53` to `48`.
- Building tier: `47` to `31`.
- Hot tier: `30` to `21`.
- Probability tier: `20` to `11`.
- Danger tier: `10` to `1`.

## Security And Audit

- Wrong staff password blocks write action.
- Jackpot adjustment uses same staff password.
- Tournament type edits use same staff password.
- Manual adjustment requires a reason.
- Every create, draw submit, and admin adjustment writes an audit row.
- Two staff write attempts should not corrupt jackpot state because Apps Script uses `LockService`.
