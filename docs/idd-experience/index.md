# IDD experience routing index

Use this file only to choose relevant topic files. The index is deliberately small so IDD does not turn experience lookup into a global context dump.

| Topic | Typical scope | Experience file |
| --- | --- | --- |
| workflow | IDD phases, claims, review/CI routing, branch/merge authority, agent execution behavior | [`workflow.md`](workflow.md) |
| ci | GitHub Actions, validation failures, check registration, CI-only failure modes | create `ci.md` on the first qualifying lesson |
| save-system | serialization, migration, import/export, persistence compatibility | create `save-system.md` on the first qualifying lesson |
| gameplay | formulas, progression invariants, balance implementation traps | create `gameplay.md` on the first qualifying lesson |
| ui | DOM/layout/rendering/mobile interaction and browser-only behavior | create `ui.md` on the first qualifying lesson |
| architecture | module boundaries, runtime ordering, non-obvious dependencies | create `architecture.md` on the first qualifying lesson |

A single Issue may route to more than one topic, but only open the files that match the actual scope. Missing topic files mean no recorded lesson, not a retrieval failure.