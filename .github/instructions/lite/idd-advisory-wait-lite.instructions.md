# IDD — Advisory-Wait Protocol (Lite, inactive)

The repository selects `no-advisory` for both normal and lite instruction
routes. Lite sessions do not request, wait for, or recover an external
reviewer. They use human review, the shared review snapshot, bounded Codex
critique, CI, and the same `human_merge` boundary.

This file remains only to make the profile explicit for resume routing. Do
not add an external reviewer path here without changing the repository review
policy and all normal/lite phase files together.
