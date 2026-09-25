---
type: reference
title: IDD — Advisory-Wait Shell Fallback (inactive)
description: The repository-local no-advisory profile does not use an external reviewer wait or shell fallback.
tags: [review-policy, no-advisory]
---

# Inactive under the no-advisory profile

Angle Incremental does not install or invoke an external advisory reviewer.
Consequently there is no shell fallback, request marker, recovery marker, or
polling window for one. E14 proceeds from human-review handling to CI, and F2
and F3 use the remaining merge-safety evidence directly.

Human review comments and unresolved conversations remain covered by the
review snapshot and triage instructions. Codex critique is an internal,
bounded work/review check and is not implemented through this document.
