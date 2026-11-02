# skills

Personal agent skills. This repository exists for backup and so the same skills can be installed on a work machine. It is public only because that is the simplest way to reach it from work; it is not maintained for anyone else, and skills may change or disappear without notice.

## Claude Code marketplace

`.claude-plugin/marketplace.json` publishes one plugin, `bevan`, containing `boundary-object` and `prose-style-review`. No other skill in the repository is loaded by it.

```sh
claude plugin marketplace add bevan-philip/skills
claude plugin install bevan@bevan-skills
```

The skills are then namespaced under the plugin, as `/bevan:boundary-object` and `/bevan:prose-style-review`. `claude plugin marketplace update bevan-skills` pulls later changes.

To expose another skill, add its directory to the `skills` array of the `bevan` entry and run `claude plugin validate .`.

## npx skills

[`npx skills`](https://github.com/vercel-labs/skills) installs any skill directory in the repository, independent of the marketplace file.

```sh
npx skills add bevan-philip/skills --list
npx skills add bevan-philip/skills --skill boundary-object -a claude-code
```

`add-place` and `grill-me` set `metadata.internal: true` in their frontmatter, so they are hidden from listing and installation unless `INSTALL_INTERNAL_SKILLS=1` is set. A skill needs a `name` field in its frontmatter to be found at all.
