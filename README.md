# Likewise

A protocol for **decentralized personal knowledge graphs**.

A user runs a node on each of their own devices. Nodes share an
append-only log of signed operations describing the user's evidence
(photos, calendar, contacts), the working hypotheses derived from that
evidence ("Sarah is a close contact", "Tuesdays are gym day"), and the
permissions governing who may read or derive from what.

Inference happens on user-owned hardware. Every model call is recorded
with its retrieved context, so nothing the user is told about themselves
is unauditable.

The full specification is in [`docs/`](docs/SUMMARY.md). Start with
[Motivation](docs/motivation.md), then [Overview](docs/overview.md),
then [Concepts](docs/concepts.md). The normative wire-level spec begins
at [Conventions](docs/spec/00-conventions.md).

An in-progress Rust reference implementation called **Cortex** is
under private development. It is not yet publicly available; see
[`docs/implementations.md`](docs/implementations.md) for status.

## Status

Likewise is at **v0.1 — draft for public review**. The wire
format was developed alongside an in-progress reference
implementation but is not yet considered stable across major
versions, and there is no public implementation an interested
party can run today. See
[`docs/spec/99-open-issues.md`](docs/spec/99-open-issues.md) for
known cross-implementation hazards.

## License

This specification is licensed under
[Creative Commons Attribution 4.0 International](LICENSE)
(CC-BY-4.0). You may share and adapt it, including commercially, with
attribution.

The Cortex implementation, when released, will be licensed
separately.
