# Debt to Console Ratio agent guide

This repository owns the static debt comparison website. It must build and run without the other Hero of Bitcoin repositories. The checked-in debt snapshot is the offline fallback; `npm run data:update` is an explicit network-backed maintenance action and is not part of ordinary verification.

Install locked dependencies with `npm ci`, then run `npm run verify`. Keep `node_modules/`, `dist/`, browser output, and private notes ignored. Put private follow-ups in `.state/todo_local.md`. Do not deploy or refresh external data unless the user explicitly authorizes that action.
