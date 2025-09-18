# Feature: Option Strategy Recognition

## Status: 🔴 BACKLOG
*Priority: HIGH - Critical bug affecting all users with options*

## Quick Links
- [User Story](./user-story.md) - What we're building and why
- [Technical Spec](./spec.md) - How we're building it
- [Implementation Plan](./implementation-plan.md) - Step-by-step tasks
- [Agent Notes](./agent-notes.md) - AI-specific guidance

## Problem Statement
The system currently labels ALL option positions as "Covered Call" regardless of actual strategy type, causing:
- Incorrect premium calculations
- Wrong risk assessments
- Misleading P&L reports
- Bad trading recommendations

## Solution Overview
Implement intelligent strategy detection that recognizes:
- Spreads (bull/bear, call/put)
- Covered positions
- Naked options
- Complex strategies (iron condor, etc.)

## Current Examples

### What's Broken
```
User Has: Bull Put Spread (short $30 put, long $33 put)
Shows As: Two "Covered Calls" ❌
Should Be: "Bull Put Spread" with $297 max risk ✓
```

## Files in This Feature

```
option-strategy-recognition/
├── README.md               # This file
├── user-story.md          # Acceptance criteria
├── spec.md                # Technical design
├── implementation-plan.md # Phased approach
├── agent-notes.md         # AI guidance
└── test-data/             # (to be added)
    ├── bull-put-spread.json
    └── covered-call.json
```

## To Start Development

1. Move entire directory to `features/in-progress/`
2. Create feature branch: `git checkout -b feature/option-strategy-recognition`
3. Start with Phase 1 (already complete - documentation)
4. Proceed to Phase 2 following implementation plan

## Key Metrics
- Recognition accuracy: Target 95%+
- Performance: Detection < 100ms
- Zero false "Covered Call" labels

## Contact
- Feature Owner: [User]
- Technical Lead: [TBD]
- Target Completion: 5-6 days from start