# Clocks

This chapter specifies the Hybrid Logical Clock (HLC) used to
timestamp operations. The HLC is the mechanism by which two
operations can be totally ordered across a mesh whose nodes
disagree about wall-clock time.

The chapter fills the gap that v0.1 implementations had handled
implicitly: the **discipline** by which a node updates its HLC.
The clock value alone is not enough; a clock without a discipline
will, eventually, produce two operations from different authors
with the same `(wall_ms, logical, node)` triple, and a mesh that
permits that has no way to converge.

## 1. The HLC value

An HLC value is a triple:

| Field | Type | Notes |
|-------|------|-------|
| `wall_ms` | unsigned 64-bit | Milliseconds since the Unix epoch (1970-01-01T00:00:00Z), as best the node can estimate. |
| `logical` | unsigned 32-bit | A counter that advances within a single `wall_ms`. |
| `node` | `NodeId` | The authoring node. |

The wire encoding is specified in
[Wire Format](03-wire-format.md#3-hybrid-logical-clock-encoding).

## 2. Total order

For any two HLC values `a` and `b`:

`a < b` if and only if `(a.wall_ms, a.logical, a.node) <
(b.wall_ms, b.logical, b.node)` in lexicographic order.

This induces a strict total order on operations within a mesh.
Where the rest of this specification refers to the order of
operations, it means this order.

A receiver MUST apply received operations in this order
regardless of the sequence position they arrived in (see
[Sync](04-sync.md#8-order-of-application-on-the-receiver)).

## 3. Per-node state

Each node maintains a single HLC value, called its **local clock**.
The local clock has the same fields as an HLC value above; its
`node` field is the node's own `NodeId`.

The local clock advances under two disciplines: the **tick**
discipline on emit, and the **recv** discipline on receive.

## 4. The tick discipline

Before authoring a new operation, a node MUST advance its local
clock by the following procedure. Let `prior` be the local clock
value before tick, and `wall_now` be the node's current
wall-clock reading (in milliseconds since Unix epoch).

```
tick(prior, wall_now) -> next:
    if wall_now > prior.wall_ms:
        next.wall_ms = wall_now
        next.logical = 0
    else:
        next.wall_ms = prior.wall_ms
        next.logical = prior.logical + 1
    next.node = prior.node
    return next
```

The newly authored operation MUST carry `next` as its `timestamp`.
After authoring, the node's local clock MUST equal `next`.

Two requirements follow from this procedure:

1. **Strict monotonicity.** `next > prior` for any prior. A node
   MUST NOT author two operations with the same timestamp.
2. **Wall-clock dominance.** `next.wall_ms >= wall_now` if
   `wall_now > prior.wall_ms`. The HLC tracks reality forward
   when it can.

If `prior.logical` is at the maximum representable value, the
node MUST treat the case as a clock overflow and refuse to
author further operations until the wall component advances. In
practice this is unreachable at the millisecond resolution and
32-bit counter v0.1 specifies, but conformant implementations
MUST still handle it.

## 5. The recv discipline

When a node receives a remote operation with timestamp `remote`,
it MUST update its local clock by the following procedure. Let
`prior` be the local clock and `wall_now` be the current wall
reading.

```
recv(prior, remote, wall_now) -> next:
    let max_wall = max(prior.wall_ms, remote.wall_ms, wall_now)

    if max_wall == prior.wall_ms and max_wall == remote.wall_ms:
        next.logical = max(prior.logical, remote.logical) + 1
    elif max_wall == prior.wall_ms:
        next.logical = prior.logical + 1
    elif max_wall == remote.wall_ms:
        next.logical = remote.logical + 1
    else:
        next.logical = 0

    next.wall_ms = max_wall
    next.node = prior.node
    return next
```

After applying `recv`, the node's local clock MUST equal `next`.
The next op the node authors will then dominate `remote`,
preserving the invariant that any op authored by this node after
seeing `remote` is later in the total order than `remote`.

The recv discipline MUST be applied for every remote operation,
including operations that the receiver chooses to discard for
authorisation reasons. (Failing to advance the clock for
filtered-out ops produces an observable hole in causal ordering
that breaks the frontier invariant.)

## 6. Wall-clock skew

The HLC is robust to bounded wall-clock skew between nodes —
that is, two nodes whose clocks are within some bound of each
other will produce timestamps whose order tracks the real order
of authoring. A node whose clock is far ahead of its peers will
"pull" the mesh's timestamps forward (other nodes will adopt the
larger `wall_ms` on receive). A node whose clock is far behind
will not.

The protocol does not specify a skew bound. Implementations
SHOULD:

- Synchronise their wall clocks against an external time source
  when one is available (NTP, a peer's clock).
- Treat as suspicious any received op whose `wall_ms` is more
  than one hour ahead of `wall_now`.
- Continue to apply such ops in the total order, while logging
  the anomaly for operator inspection.

Skew tolerance is a known
[open issue](99-open-issues.md): the v0.1 specification does
not give an implementation tools to *reject* a peer producing
wildly future-dated timestamps. A future revision is expected to
add an out-of-band skew limit negotiated as part of mesh-rules.

## 7. Lease expiry uses HLC, not wall clock

Lease-based work claims (`ClaimWork`) carry a `lease_duration_ms`
that is interpreted against the HLC wall component, not against
the local wall clock of any single node:

```
expired_at(claim_op) -> hlc_threshold
    let claimed_wall = claim_op.timestamp.wall_ms
    return claimed_wall + claim_op.payload.lease_duration_ms

is_expired(claim_op, current_hlc) -> bool
    return current_hlc.wall_ms > expired_at(claim_op)
```

This makes lease expiry robust to clock skew across the mesh in
the same way the rest of the protocol is. See
[Mesh Coordination](09-mesh-coordination.md).

## 8. Informative: why HLC instead of vector clocks

> Informative section. Does not impose requirements.

A vector clock would carry a logical counter per author and let
two ops be partially ordered. The HLC is strictly less
expressive: it produces a total order, breaking concurrency ties
arbitrarily by `node`. This is acceptable for Cortex Protocol
because:

- The protocol's merge semantics are last-write-wins by `OpId`
  for the cases where two ops conflict; partial order would not
  give an implementation more information than total order
  already provides.
- The total order plus a per-author causal frontier gives sync a
  clean cursor: "everything past this frontier" is unambiguous.
- A vector clock requires a per-author entry that grows with
  mesh size; the HLC is fixed-size.

The cost is that the protocol is not a CRDT in the strict sense
— two nodes with the same set of operations agree on order
regardless of how they observed them, but they don't have richer
concurrency information to inspect. For Cortex Protocol's
domain — a single user's mesh — that cost is the right trade.
