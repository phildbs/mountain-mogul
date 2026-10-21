#!/bin/sh
# Put the live site back to an earlier release: ./tools/rollback.sh v2.11.5
# Restores that release's files as a new commit on main (history is kept, so rolling
# forward again is just another rollback to the newer tag) and pushes; GitHub Pages
# redeploys in a minute or two. Releases are tagged vX.Y.Z on main; `git tag` lists them.
set -e
tag="$1"
[ -n "$tag" ] || { echo "usage: $0 <tag>   (one of: $(git tag -l 'v*' --sort=-v:refname | head -5 | tr '\n' ' '))"; exit 1; }
git fetch origin main --tags
git rev-parse -q --verify "refs/tags/$tag" >/dev/null || { echo "no tag $tag"; exit 1; }
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "run this on main"; exit 1; }
git reset -q --hard origin/main
git rm -rq --ignore-unmatch .
git checkout "$tag" -- .
git commit -qm "Roll back to $tag"
git push origin main
echo "Rolled back to $tag. Live in a minute or two."
