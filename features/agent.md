# Feature Development Agent Guide

This guide helps AI agents execute feature development correctly and safely in PortfolioProtector.

## 🎯 Your Prime Directive

**SAFETY FIRST**: Never break production. Always follow the development-rules.md phases. Always verify with the user.

## 📚 Required Reading Before Starting

1. **Read these in order**:
   - User story (`user-story-*.md`) - Understand WHAT to build
   - Technical specification (`spec-*.md`) - Understand HOW to build
   - Implementation plan (`implementation-plan-*.md`) - Understand the STEPS
   - `/features/development-rules.md` - Understand the RULES

2. **Know which agent.md files to consult**:
   - `/supabase/agent.md` - For ALL Supabase edge function work
   - `/src/agent.md` - For frontend React/TypeScript work
   - `/src/components/agent.md` - For component creation/modification
   - `/docs/agent.md` - For troubleshooting and bug fixes
   - `/docs/CODE_REVIEW_STANDARDS.md` - For code quality checks

## 🔄 Feature Development Workflow

### Step 1: Orientation
```
1. Check current directory (backlog/in-progress/completed)
2. Read all related documentation
3. Understand the problem being solved
4. Review similar completed features for patterns
```

### Step 2: Verify Prerequisites
```
□ User story exists and is approved
□ Technical spec exists and is complete
□ Implementation plan has clear phases
□ You understand which agents to consult
□ Development rules are clear
```

### Step 3: Phase Execution

#### For Each Phase:
1. **Announce Start**: "Starting Phase X: [Description]"
2. **List Tasks**: Show what you'll do
3. **Execute Carefully**: Follow the plan exactly
4. **Test Your Work**: Verify changes work
5. **Stop and Report**: "Phase X complete. Please test: [specific items]"
6. **Wait for User**: Only proceed after confirmation

### Step 4: Cross-Agent Consultation

#### When to Use Other Agents:

**Use `/supabase/agent.md` when**:
- Creating/modifying edge functions
- Deploying to Supabase
- Dealing with CORS issues
- Setting up environment variables
- Handling Deno/TypeScript in edge functions

**Use `/src/agent.md` when**:
- Working with React hooks
- Managing state
- Handling events
- API integration
- TypeScript in frontend

**Use `/src/components/agent.md` when**:
- Creating new components
- Modifying existing components
- Working with shadcn/ui
- Styling with TailwindCSS

**Use `/docs/agent.md` when**:
- Troubleshooting errors
- Finding similar bugs
- Understanding patterns
- Checking known issues

## 🛠️ Technical Implementation Guide

### Backend Development (Phase 2)

```typescript
// Always structure edge functions like this:
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // 1. Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Validate input
    const { data } = await req.json();

    // 3. Process
    const result = await processData(data);

    // 4. Return success
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // 5. Handle errors
    console.error('[FUNCTION_NAME] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### Frontend Development (Phase 3)

```typescript
// Always structure components like this:
import React from 'react';
import { cn } from '@/lib/utils';

interface ComponentProps {
  // Define all props with types
}

export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // 1. State
  const [state, setState] = useState();

  // 2. Effects
  useEffect(() => {
    // Cleanup required
    return () => {};
  }, []);

  // 3. Handlers
  const handleAction = () => {};

  // 4. Render
  if (loading) return <LoadingState />;
  if (error) return <ErrorState />;

  return <div>{/* Component JSX */}</div>;
}
```

## 🚨 FINANCIAL DATA INTEGRITY - ABSOLUTE RULES

### NEVER MANIPULATE FINANCIAL DATA
```
❌ NEVER add position-specific hardcoded fixes
❌ NEVER change contract signs based on specific strikes/symbols
❌ NEVER "correct" data with if statements targeting specific positions
❌ NEVER hide data problems with manipulations
❌ NEVER alter quantities, prices, or positions to "fix" display issues
```

### ALWAYS PRESERVE DATA ACCURACY
```
✅ ALWAYS display financial data exactly as extracted
✅ ALWAYS preserve the sign of contracts (negative = SOLD, positive = BOUGHT)
✅ ALWAYS show problems transparently - don't hide them
✅ ALWAYS fix the root cause (e.g., extraction logic) not symptoms
✅ ALWAYS maintain audit trail - financial data must be traceable
```

### Examples of UNACCEPTABLE Code:
```typescript
// ❌ NEVER DO THIS - Position-specific manipulation
if (position.strike === 30 && position.type === 'PUT') {
  position.contracts = Math.abs(position.contracts); // FORBIDDEN
}

// ❌ NEVER DO THIS - Hardcoded "fixes" for specific data
if (symbol === 'ETHA' && strike === 30) {
  contracts = -contracts; // ABSOLUTELY FORBIDDEN
}

// ❌ NEVER DO THIS - Changing financial values
position.premium = position.premium || 100; // NO DEFAULT VALUES
```

### If Financial Data Looks Wrong:
1. **DO NOT** add a quick fix
2. **DO** trace the issue to its source
3. **DO** fix the extraction/parsing logic
4. **DO** update prompts or parsing rules
5. **DO** display the data as-is and log the issue
6. **DO** inform the user of any discrepancies

## ⚠️ Critical Safety Checks

### Before ANY Code Change:
```
✓ Will this break existing functionality?
✓ Is this backward compatible?
✓ Have I tested locally?
✓ Does this follow existing patterns?
✓ Have I handled all error cases?
✓ Have I run npm run lint to check for warnings?
✓ Am I preserving financial data integrity?
✓ Am I fixing root causes, not symptoms?
```

### After EVERY Code Change:
```
✓ Run npm run lint immediately
✓ Fix all ESLint errors (red)
✓ Review all warnings (yellow), especially:
  - Unused variables
  - Complexity over 30
  - Type safety issues
✓ Document any warnings that can't be fixed
```

### Red Flags - STOP Immediately:
```
🚨 User's production data at risk
🚨 Breaking API changes
🚨 Deleting/renaming without migration
🚨 Untested code going to main
🚨 Security vulnerabilities
🚨 Performance degradation
```

## 📋 Phase-Specific Guidance

### Phase 1: Documentation (No Code)
- Read all requirements carefully
- Ask clarifying questions
- Plan the approach
- NO CODE CHANGES

### Phase 2: Backend
- Start with types/interfaces
- Implement core logic
- Add error handling
- Include logging
- Write unit tests
- Test with curl/Postman

### Phase 3: Frontend
- Start with data flow
- Build UI incrementally
- Add loading states
- Handle errors gracefully
- Test in browser
- Check responsive design

### Phase 4: Integration
- Test full workflows
- Use real data
- Check edge cases
- Verify acceptance criteria
- Test error scenarios

### Phase 5: Deployment
- Check all tests pass
- Update documentation
- Prepare rollback plan
- Use feature flags
- Get final approval

## 🔍 Testing Protocol

### What to Test After Each Phase:

**After Backend Changes**:
```bash
# Test edge function
curl -X POST http://localhost:54321/functions/v1/function-name \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**After Frontend Changes**:
```bash
# MANDATORY: Check for ALL warnings and errors
npm run lint  # MUST RUN - catches unused variables, complexity, type issues

# Check the output for:
# - Unused variables (e.g., 'highPrice' is assigned but never used)
# - Complexity warnings (functions over 30 complexity need refactoring)
# - Type safety issues
# - Any other ESLint warnings

# Fix ALL errors before proceeding
# Address warnings or document why they're acceptable

npm run build  # Ensure it compiles

# Visual testing
npm run dev
# Then check in browser
```

**Integration Testing**:
```
1. Upload real data
2. Trigger full workflow
3. Verify outputs
4. Check error handling
5. Test edge cases
```

## 💭 Decision Framework

### When Unsure, Ask Yourself:
1. Is this the simplest solution?
2. Does this follow existing patterns?
3. Will this scale?
4. Is this maintainable?
5. Have I tested enough?

### If Still Unsure:
```
STOP and ask the user:
"I'm unsure about [specific concern].
The risk is [explain risk].
Options are:
1. [Safe approach]
2. [Alternative approach]
What would you prefer?"
```

## 📊 Success Indicators

### You're on track if:
- ✅ Each phase completes without errors
- ✅ User confirms testing success
- ✅ Code follows all standards
- ✅ No breaking changes introduced
- ✅ Documentation is updated

### You need to stop if:
- ❌ Tests are failing
- ❌ User reports issues
- ❌ Breaking changes detected
- ❌ Performance degraded
- ❌ Requirements unclear

## 🚀 Deployment Checklist

Before ANY deployment:
```
□ All phases complete and tested
□ User has verified each phase
□ No breaking changes
□ Feature flags configured (if needed)
□ Documentation updated
□ Rollback plan ready
□ User approved deployment
```

## 🎓 Learning from Completed Features

Check `/features/completed/` for:
- Similar feature implementations
- Common patterns
- Lessons learned
- What worked well
- What to avoid

## 🆘 Getting Help

1. **First**: Check existing documentation
2. **Second**: Look for similar completed features
3. **Third**: Check `/docs/bugs-and-fixes/`
4. **Finally**: Ask user for clarification

## 🏁 Feature Completion

When feature is complete:
1. Verify all acceptance criteria met
2. Ensure all tests pass
3. Update documentation
4. Move specs to `/features/completed/`
5. Create summary of what was built
6. Note any follow-up items needed

---

**Remember**: You are implementing someone else's design. Follow the spec exactly. If something seems wrong, ask rather than improvise. Your job is safe, accurate implementation, not creative problem-solving.