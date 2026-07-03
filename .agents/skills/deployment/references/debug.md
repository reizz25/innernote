# Debug Workflow

Use when runtime, deployment, database, logs, or production behavior is failing.

1. State the symptom and expected behavior.
2. Reproduce or collect evidence before changing code.
3. Check the nearest layer first:
   - request/browser/API error
   - app logs
   - health endpoint
   - config/secrets
   - database/resource connectivity
   - deploy/build artifact
4. Form one hypothesis at a time.
5. Make the smallest diagnostic or fix.
6. Re-run the failing check.
7. Add regression coverage when the bug is in code.

Do not claim success without a fresh verification signal.
