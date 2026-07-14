# Security Policy

## Supported versions

This project follows semantic versioning. Security fixes are applied to the
latest published release. Please upgrade to the latest version before reporting
an issue.

## Reporting a vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Instead, use GitHub's private
[security advisory](https://github.com/igorvelho/opencode-session-correlation/security/advisories/new)
feature to report the issue privately.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce, or a proof of concept.
- The plugin version and environment (OS, Bun/Node version) where you observed it.

You can expect an initial acknowledgement within a few business days. We will
work with you to understand the issue, prepare a fix, and coordinate disclosure.

## Scope

This plugin runs locally within OpenCode. Its security-relevant surface is
limited to:

- The local mapping file it reads and writes
  (`session-correlation.json`), which stores native OpenCode session IDs mapped
  to generated UUIDs.
- The single correlation header it injects into outbound requests for
  explicitly configured providers.

The plugin does not transmit native session IDs, prompts, secrets, or request
bodies to any provider. Reports demonstrating that these guarantees are broken
are especially valuable.
