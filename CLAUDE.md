# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Package Manager

**ALWAYS use `pnpm` instead of `npm` or `yarn`.**

- Install dependencies: `pnpm install`
- Add package: `pnpm add <package>`
- Run scripts: `pnpm run <script>` or `pnpm <script>`

## General Rules

## Monorepo Structure

This is a monorepo. Be aware of the package structure and use appropriate paths when installing dependencies or running commands from specific packages.

## Security Guidelines

### Dangerous APIs - DO NOT USE

- `eval`, `exec`, `Function`
- `child_process.exec*` with unsanitized input
- SQL built via string concatenation
- Unsafe deserialization
- `Math.random()` for secrets

## Solidity Smart Contracts

When working with Solidity files in the `contracts/` directory:

- Follow the Blueprint project structure
- Follow the Solidity Style Guide from official documentation
- Use abstract contracts for base functionality
- Separate storage layouts into dedicated contracts
- Use ERC-7201 Namespaced Storage Layout for upgradeable contracts
- Use custom errors instead of revert strings
- Emit events for all state-changing operations
- Include both old and new values in events when updating state
- Follow the initializer rules documented in `.cursor/rules/solidity-rules.mdc`
