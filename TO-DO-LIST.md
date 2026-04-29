** TO-DO-LIST.md

This is claude code's to do list to read when a session starts.  Wiz will add things to this list for claude to review every time a session starts.
Begin my reviewing and then interview with questions to plan on how to act on these items.
Once an item is completed it can be removed from the list but the file should remain even if it is empty.
THe items on the list are numbered just for convenience and not order of importance.

1. Circle back and verify page header icons (invoices, printers, filament inventory) are displaying correctly without white backgrounds after cache clears. mix-blend-screen was removed from PageIcon — all icons are RGBA with transparent backgrounds so no blend mode should be needed.

2. Apply BuildKit GIT_SHA cache-bust standard — Add `ARG GIT_SHA` + `RUN echo "Building for $GIT_SHA"` immediately before source COPY in each Dockerfile. Add `GIT_SHA=${GIT_SHA:-unknown}` to compose.yaml build.args. Update deploy playbook to capture `git rev-parse HEAD` and inject as `GIT_SHA` env on `docker compose build` step. Reference impl: media-kennel v0.69.2. Full standard: ~/.claude/projects/-home-shad/memory/feedback_buildkit_git_sha_standard.md

