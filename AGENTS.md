# Working in this repository

Each top-level folder is one agent skill. `.claude-plugin/marketplace.json` lists the ones the `bevan` plugin installs.

## Releasing boundary-object

The boundary-object skill doesn't run the code in `boundary-object/app/`. It runs the tarball of a GitHub release, and `boundary-object/SKILL.md` names that release's URL. A change to the app reaches users only through a new version, and the *boundary-object check* workflow fails any pull request that changes the app without one. Changes to `app/ci/` and `app/.gitignore` don't count, since they aren't shipped.

When a pull request changes `boundary-object/app/`:

1. Run `npm run bump -- patch` in `boundary-object/app`. Use `minor` instead for a new feature, or for a change to the `doc.json` format or to a CLI command. The script bumps the version in `package.json` and `package-lock.json` and points `SKILL.md` and `README.md` at the release the merge will make.
2. Commit that on its own, as `boundary-object: release <version>`, after the commits that change the app. Doc changes that describe the new app, such as a new block in `references/blocks.md`, go in that commit or after it, so that no commit's `SKILL.md` describes a release it doesn't run.
3. Run `npm run version-check -- origin/main` in `boundary-object/app` to confirm.

If the branch already has a release commit and the app changes again before merge, don't bump twice. Leave the version as it is, since it hasn't been released yet.

Don't create tags or releases by hand. The *boundary-object release* workflow makes the release after the merge, and until it does, the URL in `SKILL.md` returns 404.

To use your changes on a real board before they're released, set `BOUNDARY_CLI` to the absolute path of `boundary-object/app/bin/boundary.mjs`. `SKILL.md` then runs that file instead of the release.
