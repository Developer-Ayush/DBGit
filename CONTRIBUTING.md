# Contributing to DBGit

We love your input! We want to make contributing to DBGit as easy and transparent as possible.

## Development Setup

```bash
git clone https://github.com/YOUR_USERNAME/dbgit
cd dbgit
npm install
npm run build
npm test
```

## Pull Request Process

1. Fork the repo and create your branch from `main`
2. Run `npm test` — all tests must pass
3. Run `npm run lint` — no lint errors
4. Update README.md if you changed any commands
5. Open a PR with a clear description

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `test:` adding tests
- `chore:` build/tooling changes

## Reporting Bugs

Open a GitHub Issue with:
- DBGit version (`dbgit --version`)
- PostgreSQL version
- Node.js version
- Steps to reproduce
- Expected vs actual behavior

## Code Style

- TypeScript strict mode — no `any`
- Descriptive variable names
- Every exported function must have a JSDoc comment
- Tests for every new feature

## License

By contributing, you agree your contributions will be licensed under the MIT License.
