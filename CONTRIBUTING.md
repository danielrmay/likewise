# Contributing to Cortex Protocol

Cortex Protocol is a specification, not a piece of software. Contributions
take the form of clarifications, corrections, and proposals to evolve the
spec — not pull requests against an implementation.

## Reporting issues

Open an issue if you find:

- An ambiguity or contradiction in the spec.
- A wire format or behaviour the spec describes but no compatible
  implementation could reasonably interoperate from.
- A claim about an "Open issue" in `docs/spec/99-open-issues.md` that has
  since been resolved or invalidated.
- A factual mistake in the higher-level documents (`motivation`,
  `overview`, `concepts`, `comparison`).

When in doubt, file an issue rather than a PR. The discussion is usually
more valuable than the diff.

## Proposing changes

Pull requests are welcome for editorial fixes (typos, broken links,
wording cleanups) and for clarifications that don't change normative
behaviour.

Substantive changes — anything that affects what a compatible
implementation MUST or MUST NOT do — should start as an issue, reach
rough consensus, and then land as a PR that explicitly notes which
normative sections it touches.

The protocol is versioned. Backwards-incompatible changes go in a new
major version. Backwards-compatible additions (new op variants, new
caveats) go in a new minor version. The current version lives in
`docs/spec/00-conventions.md`.

## Scope

In scope:

- The wire-level protocol: operations, sync, signatures, capabilities,
  clocks, projections, state machines.
- High-level explanatory documents (`motivation`, `overview`,
  `concepts`, `comparison`) when they have drifted from the normative
  spec or from current public understanding.
- The reference-implementation pointer (`docs/implementations.md`) when
  new compatible implementations appear.

Out of scope:

- Implementation choices specific to a single language or runtime.
- Application-level features built on top of the protocol (UI design,
  particular ML models, particular ingestion connectors).
- Roadmap promises beyond the next minor version.

## Style

Normative spec sections use RFC 2119 keywords (`MUST`, `MUST NOT`,
`SHOULD`, `MAY`). Non-normative material — examples, explanations,
rationale — is clearly marked.

Don't reference Rust types, crate names, or the reference
implementation's source layout in normative sections. Cite behaviour,
not source.

## License

By contributing you agree that your contributions are licensed under
the same terms as the rest of the specification: Creative Commons
Attribution 4.0 International (CC-BY-4.0). See `LICENSE`.
