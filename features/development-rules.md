# Mandatory Development Rules for All Features

**⚠️ THESE RULES ARE NON-NEGOTIABLE AND MUST BE FOLLOWED FOR EVERY FEATURE ⚠️**

## 🎯 Core Principles

1. **Never Break Production** - All changes must be backward compatible
2. **Test at Every Phase** - No proceeding without testing confirmation
3. **User Verification Required** - Explicit approval before phase transitions
4. **Iterative Development** - Small, testable increments
5. **Safety First** - When in doubt, stop and ask

## 📋 Phase-Based Development (MANDATORY)

### Phase 1: Documentation & Planning
**No code changes allowed in this phase**
- [ ] Create/review user story with acceptance criteria
- [ ] Create/review technical specification
- [ ] Create implementation plan with phases
- [ ] Get user approval on approach
- [ ] **STOP**: Ask user "Is the planning phase complete and approved?"

### Phase 2: Backend Implementation
**Focus: Edge functions, APIs, data processing**
- [ ] Implement core logic with unit tests
- [ ] Handle all error cases
- [ ] Add comprehensive logging
- [ ] Test with curl or test scripts
- [ ] Verify no breaking changes to existing APIs
- [ ] **STOP**: Ask user "Have you tested the backend changes? Do they work as expected?"

### Phase 3: Frontend Implementation
**Focus: React components, UI updates**
- [ ] Implement UI changes incrementally
- [ ] Maintain existing functionality
- [ ] Add loading and error states
- [ ] Test in development environment
- [ ] Verify responsive design
- [ ] **STOP**: Ask user "Have you tested the frontend changes? Does the UI work correctly?"

### Phase 4: Integration Testing
**Focus: End-to-end validation**
- [ ] Test complete user workflows
- [ ] Verify with real data (not mocks)
- [ ] Check edge cases
- [ ] Validate against acceptance criteria
- [ ] Performance testing
- [ ] **STOP**: Ask user "Have all acceptance criteria been met? Any issues found?"

### Phase 5: Deployment Preparation
**Focus: Safe production release**
- [ ] Add feature flags if applicable
- [ ] Update documentation
- [ ] Prepare rollback plan
- [ ] Create deployment checklist
- [ ] **STOP**: Ask user "Ready to deploy? Have you backed up any critical data?"

## 🚫 Absolute Safety Rules

### NEVER Do These Without Explicit Permission:
```
❌ NEVER run Puppeteer or browser automation
❌ NEVER deploy directly to production
❌ NEVER delete or rename existing APIs
❌ NEVER remove existing functionality
❌ NEVER skip testing phases
❌ NEVER proceed without user verification
❌ NEVER make schema-breaking changes
❌ NEVER commit secrets or API keys
```

### ALWAYS Do These:
```
✅ ALWAYS test changes locally first
✅ ALWAYS ask for testing confirmation
✅ ALWAYS maintain backward compatibility
✅ ALWAYS use feature flags for major changes
✅ ALWAYS handle errors gracefully
✅ ALWAYS add logging for debugging
✅ ALWAYS follow existing code patterns
✅ ALWAYS update relevant documentation
```

## 🧪 Testing Requirements

### After EVERY Phase:
1. **Stop and announce**: "Phase X complete. Please test the following:"
2. **List what to test**: Specific features, endpoints, or UI elements
3. **Wait for confirmation**: "Have you tested these changes?"
4. **Only proceed after**: User confirms testing is successful

### Testing Checklist Template:
```markdown
## Phase [X] Testing Checklist
- [ ] Changes don't break existing features
- [ ] New functionality works as expected
- [ ] Error cases handled properly
- [ ] Performance acceptable
- [ ] No console errors
- [ ] User confirms testing complete
```

## 🔄 Iterative Development Rules

### Commit Strategy:
- **Small, focused commits** - One logical change per commit
- **Clear commit messages** - Describe what and why
- **Test before committing** - Ensure builds pass
- **Never commit broken code** - Always leave main branch deployable

### Incremental Changes:
1. Build smallest working piece first
2. Test it thoroughly
3. Get feedback
4. Iterate based on feedback
5. Repeat until feature complete

## 📝 Documentation Requirements

### Must Document:
- [ ] API changes in relevant edge function comments
- [ ] New component props in JSDoc
- [ ] Configuration changes in .env.example
- [ ] Breaking changes in CHANGELOG (if any)
- [ ] Complex logic with inline comments

### Update These Files (if applicable):
- `README.md` - New features or setup steps
- `ARCHITECTURE.md` - Structural changes
- `/docs/` - New patterns or gotchas
- `/features/completed/` - Move specs when done

## 🚀 Deployment Safety

### Pre-Deployment Checklist:
```
1. All tests passing?
2. Code reviewed?
3. Documentation updated?
4. Feature flags configured?
5. Rollback plan ready?
6. User approved deployment?
```

### Feature Flag Usage:
```typescript
// ALWAYS wrap new features
if (FEATURES.NEW_FEATURE_ENABLED) {
  // New feature code
} else {
  // Existing behavior
}
```

### Gradual Rollout:
1. Deploy with feature OFF
2. Enable for internal testing (1-10 users)
3. Monitor for issues (1 hour minimum)
4. Expand to 10% of users
5. Monitor for 24 hours
6. Expand to 50%
7. Full rollout after 48 hours stable

## 🎓 Required Reading

Before starting ANY feature development:
1. Read the user story completely
2. Read the technical specification
3. Review `/docs/CODE_REVIEW_STANDARDS.md`
4. Check `/docs/bugs-and-fixes/` for related issues
5. Review relevant `agent.md` files:
   - `/supabase/agent.md` - For edge functions
   - `/src/agent.md` - For frontend work
   - `/src/components/agent.md` - For React components

## ⚡ Quick Decision Tree

```
Need to make a change?
├── Is it breaking? → Add feature flag
├── Is it risky? → Ask user first
├── Is it tested? → Proceed carefully
└── Not sure? → STOP and ask user
```

## 🆘 When to Stop and Ask

**IMMEDIATELY STOP** if you encounter:
- Unexpected test failures
- Unclear requirements
- Potential breaking changes
- Performance degradation
- Security concerns
- Data loss risks
- Any doubt about safety

**Ask the user**:
1. Describe the situation
2. Explain the risks
3. Propose solutions
4. Wait for direction

## 📊 Success Metrics

Every feature should track:
- [ ] All acceptance criteria met
- [ ] Zero breaking changes
- [ ] Tests pass at each phase
- [ ] User confirms success
- [ ] Documentation complete
- [ ] No production incidents

## 🏁 Final Checklist

Before marking feature complete:
- [ ] All phases executed with testing
- [ ] User verified each phase
- [ ] Documentation updated
- [ ] Code follows standards
- [ ] Feature works with real data
- [ ] No regressions introduced
- [ ] Specs moved to `/features/completed/`

---

**Remember**: These rules exist to protect production, ensure quality, and maintain user trust. When in doubt, be conservative and ask for clarification. It's better to be safe than sorry.

**Enforcement**: Any feature that doesn't follow these rules should be rejected in code review and returned to development.