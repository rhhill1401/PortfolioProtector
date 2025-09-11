# Supabase Deployment

**Scope**: Consistent, reliable Supabase Edge Function deployments from macOS and CI.

### Why
Deploy commands were hanging without useful errors. This rule codifies the fix so the behavior is consistent.

### Constraints
- Ensure you are authenticated before any CLI action.
- On macOS and CI, force API-based bundling to avoid Docker hangs.

### Required Steps
1) Authenticate first if not already logged in:
   - `supabase login`
2) Always use API bundling for deploy/build commands:
   - `--use-api`

### Standard Commands
- Deploy all functions:
  - `supabase functions deploy --use-api`
- Deploy a single function:
  - `supabase functions deploy <name> --use-api`

### NPM Scripts (expected)
Project scripts should wrap the correct flags so local devs and CI do not need to remember them.

### Key Learnings
- If deploys hang, first verify authentication, then confirm `--use-api` is present.