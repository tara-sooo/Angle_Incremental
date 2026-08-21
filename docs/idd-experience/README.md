# IDD experience store

This directory is Angle Incremental's durable, repository-local memory for reusable lessons discovered while running IDD.

It is intentionally not a transcript archive. The goal is to make a later Issue benefit from a prior Issue's debugging and project-specific discoveries without depending on one model session remembering them.

## Authority

Experience is advisory. Resolve conflicts in this order:

1. the current Issue and explicit maintainer decisions;
2. current repository policy/configuration and gameplay specification;
3. verified current code behavior and current tests/CI evidence;
4. active experience entries;
5. promoted/superseded entries as historical provenance only.

A stale experience entry is evidence to update, not a reason to preserve old behavior.

## How to read it

Start with [`index.md`](index.md). Route from the Issue scope and likely touched paths to only the matching topic file(s). Do not load the whole directory on every Issue.

If the index names a topic but no topic file exists yet, there is simply no stored experience for that topic. Do not create an empty file just to satisfy routing.

## How to write it

Follow `.github/instructions/idd-experience.instructions.md`. Records are created only for reusable, non-obvious lessons. Prefer updating a matching record over adding a duplicate.

Capture happens while the implementation branch is still mutable, after the C-phase diff has stabilized and before PR submission. If capture changes the diff, it goes through the normal critique/validation loop. F4 is report-only for experience and does not mutate the repository after merge.

## Promotion

The store is a staging layer:

- one contextual reusable observation -> `active` experience;
- repeated/stable rule -> normal docs/policy, experience becomes `promoted`;
- mechanically enforceable rule -> test/helper/CI, experience becomes `promoted`;
- invalidated lesson -> `superseded`.

Promoted records point to the authoritative location rather than duplicating the full normative rule.

## Privacy and scope

Never store private chain-of-thought, full chat/session transcripts, secrets, credentials, or unrelated personal context here. Store only concise project evidence that another contributor can audit from repository/GitHub provenance.