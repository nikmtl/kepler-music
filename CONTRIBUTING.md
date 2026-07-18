# Contributing

Thanks for your interest in contributing to Kepler Music Search

- If you have a feature request or bug report, please open an issue
- If you want to contribute code, please read the following guidelines

## Development setup

```bash
pnpm install
pnpm build
```

After any code change, run `pnpm build` again and reload the plugins in Kepler.

## Quality checks

Before opening a pull request, run:

```bash
pnpm ci:check
pnpm build
```

## Code style

Prittier is used for code formatting. Run `pnpm format` to format the codebase, or `pnpm format:check` to check for formatting issues.

## Commit style

Use Conventional Commits for commit messages and pull request titles when possible.

## Pull request guidelines

- Keep pull requests focused and small when possible.
- Explain user-visible changes in the PR description.
- Update documentation if behavior or configuration changed.
- Use a linear history branch strategy for `main`.
- Rebase before merging when needed to avoid merge commits.

## Versioning and releases

- Keep `package.json` and `plugin.config.json` versions in sync.
- The release workflow is triggered by tags matching `v*`.
- Example release tag flow:

```bash
git tag v0.2.0
git push origin v0.2.0
```

You can check version consistency with `pnpm check:versions`.
