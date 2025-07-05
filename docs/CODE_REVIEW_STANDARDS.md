# Code Review Standards

## Core Philosophy: "Upgrade, Don't Replace"
Prioritize extending and enhancing existing code over writing new implementations. This prevents codebase bloat and promotes maintainability.

## Pre-Implementation Checklist
Before writing ANY new code:
- [ ] Search for existing implementations using Grep/Glob tools
- [ ] Check for reusable patterns in neighboring files
- [ ] Review existing utilities and helper functions
- [ ] Verify no duplicate functionality exists
- [ ] Consider if an existing component can be extended

## Code Review Standards

### 1. Code Reuse & DRY Principles
- **Extend existing code** before creating new implementations
- **No duplicate code** - extract common logic into utilities
- **Modular components** - single responsibility principle
- **Reusable patterns** - identify and use existing patterns

### 2. TypeScript Standards
- **Strict types** - no `any` types unless absolutely necessary
- **Readonly props** - use `Readonly<T>` for immutable data
- **Proper interfaces** - define clear contracts for all data structures
- **Type guards** - use proper type narrowing
- **Generic types** - use generics for reusable components

### 3. Performance Optimization
- **Bundle size** - check imports, avoid importing entire libraries
- **Code splitting** - lazy load when appropriate
- **Memoization** - use React.memo, useMemo, useCallback wisely
- **Avoid re-renders** - check for unnecessary component updates

### 4. Consistency Standards
- **Naming conventions** - follow existing patterns
- **File structure** - maintain project organization
- **Import order** - follow established import patterns
- **Style patterns** - use existing CSS/styling approaches

### 5. Accessibility (a11y)
- **Semantic HTML** - use proper HTML elements
- **ARIA labels** - add where needed for screen readers
- **Keyboard navigation** - ensure all interactive elements are accessible
- **Color contrast** - maintain WCAG compliance

### 6. Documentation
- **Clear comments** - only when necessary, code should be self-documenting
- **JSDoc** - for public APIs and complex functions
- **README updates** - document new features or changes
- **Type definitions** - types serve as documentation

### 7. Error Handling & Edge Cases
- **Null/undefined checks** - handle missing data gracefully
- **Error boundaries** - catch and handle React errors
- **Loading states** - always show loading indicators
- **Empty states** - handle empty data sets
- **Network failures** - graceful degradation

### 8. Security
- **Input validation** - sanitize all user inputs
- **No secrets** - never commit API keys or sensitive data
- **XSS prevention** - use proper escaping
- **Dependency security** - check for vulnerabilities

### 9. Testing Considerations
- **Edge cases** - test boundary conditions
- **Error scenarios** - test failure paths
- **User workflows** - test complete user journeys
- **Regression testing** - ensure fixes don't break existing features

### 10. Production Readiness
- **Environment variables** - properly configured
- **Build optimization** - production builds work correctly
- **Error logging** - appropriate error tracking
- **Performance monitoring** - metrics in place

## Post-Implementation Review

After making changes, verify:
1. No regression in existing functionality
2. All TypeScript types are strict and accurate
3. Bundle size impact is minimal
4. Code follows existing patterns
5. All edge cases are handled
6. Documentation is updated if needed

## Review Checklist Template

```markdown
## Code Review for [Feature/Fix Name]

### Pre-Implementation
- [ ] Searched for existing implementations
- [ ] Checked reusable patterns
- [ ] Verified no duplication

### Code Quality
- [ ] DRY principle followed
- [ ] TypeScript types are strict
- [ ] Code is modular and reusable
- [ ] Performance optimized
- [ ] Follows existing patterns

### Edge Cases & Security
- [ ] Null/undefined handled
- [ ] Error states covered
- [ ] Input validation implemented
- [ ] No security vulnerabilities

### Testing & Documentation
- [ ] Edge cases tested
- [ ] Comments added only where necessary
- [ ] Types serve as documentation

### Final Check
- [ ] Production ready
- [ ] No regressions
- [ ] Follows "upgrade don't replace" philosophy
```

## Remember
Every line of code added increases maintenance burden. Always ask: "Can I extend existing code instead of writing new code?"