# Position Win/Loss Tracking Feature

## Overview
Add visual indicators to track individual option position outcomes with emojis/icons displayed at the top of the screen.

## Win/Loss Logic

### Winning Positions
- 🏆 **Expired Worthless**: Option expired with 0 intrinsic value (kept 100% premium)
- 💰 **Closed Profitably**: Bought back for less than premium collected
- ✅ **Assigned Profitably**: Total P&L positive including stock gain
  - Formula: (Strike - Cost Basis) × 100 + Premium Collected > 0

### Losing Positions  
- 📉 **Closed at Loss**: Bought back for more than premium collected
- ⚠️ **Assigned at Loss**: Total P&L negative including stock loss
  - Formula: (Strike - Cost Basis) × 100 + Premium Collected < 0

### Neutral/Pending
- ⏳ **Open Position**: Still active, showing unrealized P&L
- 🔄 **Rolled**: Position was rolled to new strike/expiry

## Implementation Details

### Data Structure
```typescript
interface PositionOutcome {
  symbol: string;
  strike: number;
  expiry: string;
  outcome: 'win' | 'loss' | 'pending' | 'rolled';
  outcomeType: 'expired' | 'closed' | 'assigned' | 'open';
  totalPL: number;
  icon: string; // emoji indicator
  closedDate?: string;
}
```

### Display Location
- Fixed header bar below main navigation
- Scrollable horizontal list of position outcomes
- Click on icon to see position details
- Summary stats: Total Wins/Losses/Win Rate

### Persistence
- Store closed position history in localStorage or Supabase
- Track outcomes across sessions
- Export history as CSV for tax purposes

## Example Display
```
📊 Position Tracker: 🏆×5 📉×2 ⏳×8 | Win Rate: 71.4% | Net P&L: +$4,328
```

## Phase Implementation
1. Phase 1: Track current session outcomes
2. Phase 2: Add persistence and history
3. Phase 3: Add detailed analytics and export features