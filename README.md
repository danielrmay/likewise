# Cortex Protocol

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

A reference implementation in Rust is tracked in
[`docs/implementations.md`](docs/implementations.md).

## Status

Cortex Protocol is at **v0.1 — draft for public review**. The wire
format is exercised by an end-to-end reference implementation but is
not yet considered stable across major versions. See
[`docs/spec/99-open-issues.md`](docs/spec/99-open-issues.md) for known
hazards.

## License

This specification is licensed under
[Creative Commons Attribution 4.0 International](LICENSE)
(CC-BY-4.0). You may share and adapt it, including commercially, with
attribution.

The reference implementation is licensed separately; see its repository
for terms.
