#!/bin/bash

# Script to create a new feature directory with all required files

if [ -z "$1" ]; then
    echo "Usage: ./new-feature-template.sh <feature-name>"
    echo "Example: ./new-feature-template.sh user-authentication"
    exit 1
fi

FEATURE_NAME=$1
FEATURE_DIR="features/backlog/$FEATURE_NAME"

# Create directory structure
mkdir -p "$FEATURE_DIR/test-data"

# Create README
cat > "$FEATURE_DIR/README.md" << 'EOF'
# Feature: [Feature Name]

## Status: 🔴 BACKLOG
*Priority: [HIGH/MEDIUM/LOW] - [Brief description]*

## Quick Links
- [User Story](./user-story.md) - What we're building and why
- [Technical Spec](./spec.md) - How we're building it
- [Implementation Plan](./implementation-plan.md) - Step-by-step tasks
- [Agent Notes](./agent-notes.md) - AI-specific guidance

## Problem Statement
[Describe the problem this feature solves]

## Solution Overview
[High-level description of the solution]

## Files in This Feature

```
feature-name/
├── README.md               # This file
├── user-story.md          # Acceptance criteria
├── spec.md                # Technical design
├── implementation-plan.md # Phased approach
├── agent-notes.md         # AI guidance
└── test-data/             # Sample test data
```

## To Start Development

1. Move entire directory to `features/in-progress/`
2. Create feature branch: `git checkout -b feature/[name]`
3. Start with Phase 1 (Documentation review)
4. Follow implementation plan phases

## Key Metrics
- [Define success metrics]

## Contact
- Feature Owner: [Name]
- Technical Lead: [TBD]
- Target Completion: [X days from start]
EOF

# Create user story
cat > "$FEATURE_DIR/user-story.md" << 'EOF'
# User Story: [Feature Name]

## Story
As a [type of user],
I want [goal/desire],
So that [benefit/value].

## Acceptance Criteria
- [ ] Given [context], when [action], then [outcome]
- [ ] Given [context], when [action], then [outcome]
- [ ] Must support [specific requirement]
- [ ] Should handle [edge case]

## Priority
[High/Medium/Low]

## Estimated Effort
[Small (1-2 days)/Medium (3-5 days)/Large (1+ week)]

## Dependencies
- List any dependencies

## User Impact
- Number of users affected
- Business value

## Notes
Additional context

## Success Metrics
- How will we measure success?
EOF

# Create spec (using simplified template)
cat > "$FEATURE_DIR/spec.md" << 'EOF'
# Technical Specification: [Feature Name]

## User Story Reference
Link to user story: ./user-story.md

## Executive Summary
[Brief technical overview]

## Architecture Overview

### System Components Affected
- [ ] Frontend (React)
- [ ] Backend (Supabase Edge Functions)
- [ ] Database
- [ ] External APIs

## Implementation Plan

### Phase 1: Documentation & Planning
- [ ] Review user story
- [ ] Complete technical spec
- [ ] Get approval

### Phase 2: Backend Implementation
- [ ] [Task]

### Phase 3: Frontend Implementation
- [ ] [Task]

### Phase 4: Integration Testing
- [ ] [Task]

### Phase 5: Deployment
- [ ] [Task]

## Development Rules Compliance
See [development-rules.md](../../development-rules.md)

## References
- Related documentation
EOF

# Create implementation plan
cat > "$FEATURE_DIR/implementation-plan.md" << 'EOF'
# Implementation Plan: [Feature Name]

## Feature Overview
[Brief description]

## Related Documents
- [User Story](./user-story.md)
- [Technical Specification](./spec.md)

## Current Status: 🔴 BACKLOG

## Implementation Checklist

### ✅ Phase 1: Documentation & Planning (COMPLETED)
- [x] Created user story
- [x] Created technical spec
- [x] Created this plan

### ⏳ Phase 2: Backend (NOT STARTED)
**Estimated: X days**
- [ ] [Task]

### ⏳ Phase 3: Frontend (NOT STARTED)
**Estimated: X days**
- [ ] [Task]

### ⏳ Phase 4: Testing (NOT STARTED)
**Estimated: X days**
- [ ] [Task]

### ⏳ Phase 5: Deployment (NOT STARTED)
**Estimated: X days**
- [ ] [Task]

## Next Steps
1. Move to in-progress when ready
2. Start Phase 2
EOF

# Create agent notes
cat > "$FEATURE_DIR/agent-notes.md" << 'EOF'
# Agent Notes: [Feature Name]

## Feature-Specific Context
[Key information for AI agents]

## Key Files to Modify

### Backend
- [List files]

### Frontend
- [List files]

## Implementation Gotchas
1. [Important thing to remember]

## Phase-Specific Notes

### Phase 2 (Backend)
- [Specific guidance]

### Phase 3 (Frontend)
- [Specific guidance]

## Test Commands
```bash
# Test examples
```

## Success Validation
[How to verify feature works]

## Related Documentation
- [Links to relevant docs]

## Questions for User
- [Any open questions]
EOF

echo "✅ Created feature directory: $FEATURE_DIR"
echo "📁 Files created:"
echo "   - README.md"
echo "   - user-story.md"
echo "   - spec.md"
echo "   - implementation-plan.md"
echo "   - agent-notes.md"
echo "   - test-data/ (directory)"
echo ""
echo "Next steps:"
echo "1. Edit the files to add feature-specific details"
echo "2. Get approval from stakeholders"
echo "3. Move to features/in-progress/ when ready to start"