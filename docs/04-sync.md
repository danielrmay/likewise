# Sync

This chapter specifies how nodes exchange operations. The protocol
defines exactly one endpoint, two HTTP methods, and one cursor.
The simplicity is intentional: synchronisation is the most
load-bearing operation in a decentralised system, and richer
protocols are harder to implement compatibly.

```mermaid
sequenceDiagram
    autonumber
    participant A as Peer A (requester)
    participant B as Peer B (responder)
    A->>B: GET /ops?since=[frontier] + bearer + mesh-hash
    alt mesh-rules hashes agree
        B->>B: filter ops by requester's caveats
        B-->>A: 200 OK + postcard ops + next-frontier
        A->>A: HLC-sort, dedup, apply, tick HLC
    else hashes disagree
        B-->>A: 409 Conflict
        A->>A: pause sync; surface drift to operator
    end
    Note over A,B: A may also POST /ops to push authored ops to B
```

## 1. Transport

Nodes communicate over **HTTP/1.1 or later** with TLS recommended
on any non-loopback transport. The v0.1 specification does not
require any particular HTTP feature beyond:

- Request and response bodies up to a server-advertised limit
  (default: 8 MiB; see Section 7).
- Custom request and response headers.
- Standard status codes.

WebSockets, gRPC, QUIC, or peer-to-peer transports MAY be used by
implementations as alternatives, but two implementations claiming
v0.1 conformance MUST both support the HTTP profile defined in
this chapter.

## 2. The single endpoint: `/ops`

A v0.1 node MUST expose `GET /ops` and `POST /ops`. A node MAY
expose additional administrative endpoints; they are not part of
this specification.

The path `/ops` is mounted at the root of the node's HTTP origin.
A node MAY operate behind a reverse proxy that adds path prefixes,
in which case the proxy is responsible for mapping back to `/ops`
for compliant peers.

## 3. Pulling operations: `GET /ops`

Pulls operations the requester does not already have.

### 3.1 Request

```
GET /ops?since=<base64url-frontier>&limit=<n>
X-Likewise-Mesh-Rules-Hash: <hex>
Authorization: Bearer <node-bearer-token>
```

Query parameters:

- `since` (required) — a base64url-encoded `CausalFrontier`
  representing the requester's high-water mark per author. The
  empty frontier (base64url `AA`) means "from the beginning of
  the log." See [Wire Format](03-wire-format.md).
- `limit` (optional) — an upper bound on the number of operations
  the server returns. The server MAY return fewer than `limit`
  even if more are available; clients MUST be prepared to issue
  follow-up requests using the returned next-frontier cursor.
  Servers MAY enforce an upper bound on `limit` and clamp values
  exceeding it.

The `Authorization` header carries a node-bearer token that
authenticates the requesting node. Token issuance and refresh are
specified in [Signatures](06-signatures.md).

### 3.2 Response

```
200 OK
Content-Type: application/octet-stream
X-Likewise-Next-Frontier: <base64url>
X-Likewise-Mesh-Rules-Hash: <hex>

<postcard-encoded Vec<Operation>>
```

Body: the postcard encoding of the sequence of operations the
server is willing to send, filtered by the requester's
capability set (Section 5).

Headers:

- `X-Likewise-Next-Frontier` — the cursor the requester should
  send on its next pull. This frontier MUST encompass every
  operation in the response and MAY encompass operations the
  server chose to filter.
- `X-Likewise-Mesh-Rules-Hash` — the server's current mesh-rules
  hash. The requester MUST compare to its own; on mismatch the
  pause-on-drift behaviour in Section 6 applies.

### 3.3 Idempotence and safety

`GET /ops` is safe and idempotent. Repeated calls with the same
`since` cursor MUST return the same operations modulo log growth
on the server in the interim.

## 4. Pushing operations: `POST /ops`

Submits operations the sender wants the recipient to apply.

### 4.1 Request

```
POST /ops
Content-Type: application/octet-stream
X-Likewise-Mesh-Rules-Hash: <hex>
Authorization: Bearer <node-bearer-token>

<postcard-encoded Vec<Operation>>
```

Body: a postcard-encoded sequence of operations.

### 4.2 Response

```
200 OK
Content-Type: application/json
X-Likewise-Mesh-Rules-Hash: <hex>

{ "appended": N, "duplicated": M, "rejected": K }
```

Where:

- `appended` is the number of operations newly added to the
  recipient's log.
- `duplicated` is the number that the recipient already had on its
  log (deduplicated by `OpId`).
- `rejected` is the number that failed authorisation, signature
  verification, or schema validation.

The recipient MUST verify each incoming operation per
[Signatures](06-signatures.md) and authorise it per
[UCAN and Caveats](07-ucan-and-caveats.md). Operations that fail
either check MUST be excluded from `appended` and counted toward
`rejected`. Implementations SHOULD log rejections with enough
detail for an operator to diagnose, but the wire response SHOULD
NOT leak per-op rejection reasons across capability boundaries.

### 4.3 Idempotence

Application of `POST /ops` MUST be idempotent: re-submitting the
same operations MUST result in the same recipient state, with
duplicates counted toward `duplicated` rather than appended a
second time.

## 5. Source-side filtering

A server MUST filter outbound operations by the requester's
capability set before responding. The filter:

1. Authorises each candidate operation against the requester's
   delegation chain. Operations the requester is not authorised to
   read are excluded.
2. Applies any `sanitize` caveats that govern the requester's
   delegation. Sanitised operations have signatures cleared
   per [Wire Format](03-wire-format.md#6-sanitised-operations).

The full filter pipeline is specified in
[UCAN and Caveats](07-ucan-and-caveats.md). The contract here is
that the wire never carries operations the requester is not
authorised to see.

## 6. The mesh-rules-hash handshake

Both sides include `X-Likewise-Mesh-Rules-Hash` on every request
and response. On mismatch:

- The receiving side MUST treat the request as a "drift"
  condition. It MAY return a `409 Conflict` response and abort
  the exchange, or it MAY continue the exchange while logging
  the drift; this is a deployment policy choice.
- The sending side, on receiving a `409 Conflict` for a
  mesh-rules-hash mismatch, MUST pause its sync loop with that
  peer and surface the condition to the operator. It MUST NOT
  re-attempt the same exchange before resolving the drift.

The rationale is that two nodes operating under different
mesh-rules documents may both believe a given op is authorised
but disagree about what its caveats mean. Continuing to sync in
that condition silently corrupts the shared interpretation of
the log.

The v0.1 protocol does not include an automatic mesh-rules
negotiation. Resolving drift requires operator action — typically
adopting a newer common rules document. A future revision is
expected to add a negotiation pre-handshake; this is an
[open issue](99-open-issues.md).

## 7. Limits

A v0.1 server MUST support requests and responses up to **8 MiB**
total body size. It MAY support larger sizes; clients MUST be
prepared to receive 413-Payload-Too-Large responses on push and
MUST batch their submissions accordingly.

A v0.1 server SHOULD enforce a per-peer rate limit. The
specification does not mandate a particular rate; servers MAY
return `429 Too Many Requests` and clients MUST honour `Retry-After`.

## 8. Order of application on the receiver

A receiver applying operations from a `POST /ops` body MUST:

1. Decode the postcard payload to a sequence of operations.
2. Sort by HLC total order: `(timestamp.wall_ms,
   timestamp.logical, timestamp.node)` ascending.
3. Apply each operation in order, deduplicating by `OpId`.
4. Update its causal frontier accordingly.
5. Tick its own HLC past the maximum received timestamp.

The fifth step is part of the HLC discipline specified in
[Clocks](05-clocks.md).

## 9. Liveness

A successful `GET /ops` exchange doubles as a liveness signal:
the requester learns that the responder is reachable and has not
revoked the requester's bearer. There is no separate heartbeat in
v0.1.

## 10. Polling cadence

The protocol does not specify how often a node should pull. A
plausible v0.1 default is 30 seconds for a node on a stable
local network and 5 minutes for a mobile node on metered
connectivity. Implementations MAY back off on transport errors
and SHOULD jitter their cadence to avoid thundering herds in a
large mesh.

A future revision is expected to add server-initiated push hints
(WebSocket or webhook) for lower-latency convergence. This is an
[open issue](99-open-issues.md); v0.1 conformant nodes use
polling.

## 11. Informative: why one endpoint

> Informative section. Does not impose requirements.

A reader familiar with replicated-log systems will recognise the
shape: a frontier-based pull plus an idempotent push is a
standard pattern. v0.1 deliberately resists adding more —
batched merkle-trees, differential range queries, sparse-index
exchanges — because every additional sync mode is a place where
two implementations can disagree without either being wrong.

The cost is that catching up a long-disconnected node from
genesis is a sequence of paginated pulls rather than a bulk
transfer. For the meshes this protocol targets — small, mostly
warm, mostly online — that cost is negligible. Future revisions
MAY add bulk-transfer modes for first-synchronisation and very-
large-mesh scenarios; v0.1 does not.
