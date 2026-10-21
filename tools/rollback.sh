#!/bin/sh
# Put the live site back to an earlier release: ./tools/rollback.sh 2.11.5
# Finds the last commit on main whose version (top entry of CHANGES in index.html) was that
# one, restores its files as a new commit (history is kept, so rolling forward again is just
# another rollback to the newer version) and pushes; GitHub Pages redeploys in a minute or two.
# A tag or commit hash works too.
set -e
want="$1"
[ -n "$want" ] || { echo "usage: $0 <version, e.g. 2.11.5>"; exit 1; }
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "run this on main"; exit 1; }
git fetch -q origin main
git reset -q --hard origin/main
ver() { git show "$1:index.html" 2>/dev/null | grep -m1 -o "{ v: '[0-9.]*'" | grep -o "[0-9][0-9.]*"; }
target=""
if git rev-parse -q --verify "$want^{commit}" >/dev/null; then target=$(git rev-parse "$want^{commit}")
else
  for h in $(git rev-list --first-parent -n 300 origin/main); do
    if [ "$(ver "$h")" = "$want" ]; then target=$h; break; fi
  done
fi
[ -n "$target" ] || { echo "no release $want found"; exit 1; }
[ "$(ver HEAD)" != "$want" ] || { echo "$want is already live"; exit 1; }
echo "Rolling back from $(ver HEAD) to $want ($(git log -1 --format='%h %s' "$target"))"
git rm -rq --ignore-unmatch .
git checkout "$target" -- .
git commit -qm "Roll back to $want"
git push origin main
echo "Done. Live in a minute or two."
