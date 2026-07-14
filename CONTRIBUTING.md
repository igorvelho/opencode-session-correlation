# Contributing to opencode-session-correlation

Thanks for your interest in contributing. This document describes how to set up
the project, the standards we follow, and how to submit changes.

By participating in this project you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- Report bugs by opening an [issue](https://github.com/igorvelho/opencode-session-correlation/issues).
- Propose features or behavior changes via an issue before opening a large PR.
- Improve documentation.
- Submit bug fixes or features via a pull request.

For anything security-related, do **not** open a public issue. Follow
[SECURITY.md](SECURITY.md) instead.

## Development setup

This project uses [Bun](https://bun.sh) for development and tests, and `tsc`
for type checking and the published build.

```bash
git clone https://github.com/igorvelho/opencode-session-correlation.git
cd opencode-session-correlation
bun install
```

### Common commands

```bash
bun test          # run the test suite
bun run typecheck # type-check without emitting
bun run build     # compile to dist/ with tsc
```

All three must pass before a change is merged. `prepublishOnly` runs the same
gate automatically before publishing.

## Coding standards

- **Language:** TypeScript in `strict` mode. Do not weaken `tsconfig.json`
  strictness or add `// @ts-ignore` / `any` to bypass the type checker unless
  there is a documented reason.
- **Style:** Match the existing style in `src/` — 2-space indentation, single
  quotes, no semicolons where the surrounding code omits them. Keep the code
  dependency-free at runtime; this plugin ships with no runtime dependencies and
  should stay that way unless discussed first.
- **Scope:** Keep the plugin's behavior narrow and predictable. It must not
  change request bodies, models, endpoints, or authentication, and it must not
  send end-user metadata, prompts, secrets, or request bodies anywhere. See the
  "What it does not do" section of the [README](README.md).
- **Privacy:** Native OpenCode session IDs stay in the local mapping file only.
  Never add code that transmits them or logs prompt/request content.
- **Filesystem safety:** Preserve the atomic write pattern (write to a temp file,
  then `rename`) so a crash cannot corrupt the mapping store.

## Tests

- Every behavioral change needs test coverage. Tests live in
  `src/index.test.ts` and run with `bun test`.
- Prefer injecting dependencies (`createUUID`, `getSession`, `storagePath`) over
  touching real global state, as the existing tests do.
- Do not rely on committed real session IDs or UUIDs; generate deterministic
  fixtures inside the test.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add X
fix: correct Y
docs: clarify Z
chore: tidy build config
test: cover edge case
```

Keep commits focused and self-contained.

## Pull request process

1. Fork the repository and create a branch from `main`.
2. Make your change, adding or updating tests as needed.
3. Run `bun test`, `bun run typecheck`, and `bun run build` locally.
4. Update the [README](README.md) if you change configuration options or
   behavior.
5. Open a pull request with a clear description of the change and its
   motivation. Link any related issue.
6. Be responsive to review feedback. A maintainer will merge once the change is
   approved and CI is green.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE) that covers this project.
