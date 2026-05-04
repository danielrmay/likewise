# Cortex Protocol

A protocol for **decentralized personal knowledge graphs**.

A user runs a node on each of their own devices. Nodes share an
append-only log of signed operations. The log encodes evidence (photos,
calendar events, contacts), the working hypotheses derived from that
evidence, the permissions governing who may read or derive from what,
and a record of every inference call made against any of it.

This book is the protocol specification.

## How to read it

If you are encountering Cortex Protocol for the first time, read in
this order:

1. **[Motivation](motivation.md)** — why this protocol exists, and what
   the status quo gets wrong.
2. **[Overview](overview.md)** — the system in five minutes, no code.
3. **[Concepts](concepts.md)** — the mental model. Evidence, ops,
   claims, projections, capabilities, mesh.
4. **[Comparison](comparison.md)** — honest contrast with Solid, AT
   Protocol, Nostr, Iroh, the local-first manifesto, and UCAN.

If you are implementing a compatible node, the normative specification
begins at **[Conventions](spec/00-conventions.md)** and runs through
[Open Issues](spec/99-open-issues.md). The high-level chapters above
are non-normative; the spec chapters are normative and use RFC 2119
keywords.

If you are looking for an existing implementation, see
**[Implementations](implementations.md)**.

## What this protocol is not

It is not a particular application. It is not a particular AI model.
It is not a synchronization library or a database engine. It is the
**wire-level agreement** that lets independently-built nodes
interoperate over a single user's knowledge graph.

## Status

**v0.1 — draft for public review.** The wire format is exercised by
an end-to-end reference implementation. It is not yet stable across
major versions. Known cross-implementation hazards are catalogued in
[Open Issues](spec/99-open-issues.md).

## License

[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
(CC-BY-4.0).
