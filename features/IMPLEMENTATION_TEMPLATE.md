# Feature Implementation Template

## Code Quality Checklist - MANDATORY FOR ALL FEATURES

### After EVERY Code Change:
```bash
# STEP 1: Run linting immediately
npm run lint

# STEP 2: Check output for:
# - ❌ Errors (red) - MUST fix before proceeding
# - ⚠️  Warnings (yellow) - Review and fix or document why acceptable
```

### Common Issues to Watch For:
1. **Unused Variables**
   - Example: `'currentDate' is assigned but never used`
   - Action: Remove the variable or use it

2. **Complexity Warnings**
   - Example: `Function has complexity of 45. Maximum allowed is 30`
   - Action: Break into smaller functions or components

3. **Type Safety**
   - Example: `Unexpected any. Specify a different type`
   - Action: Define proper TypeScript types

4. **Nesting Depth**
   - Example: `Blocks are nested too deeply (4). Maximum allowed is 3`
   - Action: Refactor to reduce nesting with early returns

## Implementation Phases

### Phase 1: Planning
- [ ] Read all related documentation
- [ ] Understand acceptance criteria
- [ ] Review similar completed features

### Phase 2: Backend Development
- [ ] Write TypeScript types first
- [ ] Implement core logic
- [ ] Add error handling
- [ ] **Run `npm run lint`**
- [ ] **Fix all errors before proceeding**
- [ ] Document any acceptable warnings

### Phase 3: Frontend Development
- [ ] Update type definitions
- [ ] Implement components
- [ ] Add loading/error states
- [ ] **Run `npm run lint`**
- [ ] **Fix all errors before proceeding**
- [ ] Check complexity warnings

### Phase 4: Integration Testing
- [ ] Test with real data
- [ ] Verify all acceptance criteria
- [ ] **Run `npm run lint` on all changed files**
- [ ] **Ensure no new warnings introduced**

### Phase 5: Final Review
- [ ] All ESLint errors fixed
- [ ] Complexity under 30 for all functions
- [ ] No unused variables
- [ ] Types properly defined (no `any`)
- [ ] Code follows existing patterns

## Example Linting Output Review

```bash
# Good - Ready to proceed:
✨  Done in 3.45s.

# Bad - Needs fixing:
/src/components/Feature.tsx
  42:7   error    'unusedVar' is assigned but never used
  156:8  warning  Function 'complexFunc' has complexity of 35
  201:15 warning  Unexpected any. Specify a different type

✖ 1 error, 2 warnings
```

## Remember
- **Never skip `npm run lint`** - It catches bugs humans miss
- **Fix errors immediately** - Don't accumulate technical debt
- **Review warnings** - They often indicate real issues
- **Document exceptions** - If you must keep a warning, explain why

## Quick Commands Reference
```bash
# Run full lint check
npm run lint

# Check specific file
npx eslint src/components/MyComponent.tsx

# Auto-fix what's possible
npx eslint --fix src/components/MyComponent.tsx

# Check TypeScript types only
npx tsc --noEmit
```