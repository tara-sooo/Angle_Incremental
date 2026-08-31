# IDD — Current-head CI

Use this file after a push and after every review fix. CI is evidence for the
current PR head, never for a previous commit.

## Read and wait

Fetch the PR `headRefOid` and the repository's required checks live. A real
workflow run must exist for that SHA and every required check must be
pass-equivalent. An empty protection read is not a green result; the actual
CI run still has to pass; this is not vacuous green. Unknown, missing, or
stale evidence is a hold.

Use the hosted check rollup or an equivalent live run query:

```sh
gh pr checks <pr-number> --required
```

Poll running checks for at most 30 min from their server start time. Allow at
most 10 min for checks to be generated. If generation or polling exceeds the
bound, record the SHA and stop for recovery rather than polling forever.

## Outcomes

| state | action |
| --- | --- |
| all required checks pass for current SHA | continue to review snapshot |
| code-caused failure | fix, validate, commit, push, and restart CI |
| infrastructure/flaky failure | rerun that exact run once, then poll again |
| second failure, timeout, cancellation, or unknown state | hold and report |

Never treat a skipped, missing, or `continue-on-error` result as a passing
required check. After any new commit or rerun, re-fetch the PR head and
evaluate the complete set again. Do not merge while CI is pending or tied to a
different SHA.
