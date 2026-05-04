# Wire Format

This chapter specifies the byte-level encoding of operations and
related structures as they cross between nodes. It defines:

- the canonical encoding used for signature computation,
- the encoding of operation identifiers, hashes, and clocks,
- the framing for collections of operations on the wire,
- the encoding of cursors and frontiers used by the sync endpoint.

The transport-layer protocol that carries these encoded bytes is
specified in [Sync](04-sync.md). The signature algorithm and
detached-JWS envelope are specified in [Signatures](06-signatures.md).

## 1. Encoding format

The canonical encoding is **postcard**, a compact deterministic
binary serialisation defined at
<https://postcard.jamesmunns.com/>. Implementations MUST use
postcard's deterministic ordering and varint conventions.

Postcard was chosen for v0.1 because it is compact, deterministic,
and has independent implementations in multiple languages. The
choice is not load-bearing in the long run; an implementation MAY
expose alternative encodings (JSON, CBOR, MessagePack) for
debugging or for application-layer interop, but operations
authored or accepted on the wire MUST be the postcard encoding.
The signature is computed over the postcard bytes.

### 1.1 Determinism requirements

Two implementations encoding the same operation values MUST
produce byte-identical postcard output. Implementations MUST:

- Encode struct fields in the order this specification declares
  them (subsequent chapters declare order alongside payloads).
- Encode option-typed fields as `0x00` for `None` and `0x01`
  followed by the value bytes for `Some`.
- Encode collections as `varint(len)` followed by the elements
  in their authored order.
- Encode booleans as a single byte: `0x00` false, `0x01` true.
- Encode integers as varints unless this specification specifies
  fixed-width.

### 1.2 Versioning of the encoding

The wire encoding does not carry an explicit version tag at the
op level. Schema evolution within a minor version is constrained
to backwards-compatible additions only — see
[Conventions](00-conventions.md). The absence of an explicit
version tag is one of the
[known cross-implementation hazards](99-open-issues.md) and is
expected to be addressed in a subsequent major version.

## 2. Identifier encodings

### 2.1 NodeId

A `NodeId` is encoded as an unsigned 64-bit varint. The mapping
from `NodeId` value to the corresponding Ed25519 public key is
established by `DelegateUcan` ops on the log; see
[Signatures](06-signatures.md).

### 2.2 ULID-shaped record identifiers

`OpId`, `EvidenceId`, `EntityId`, `ClaimId`, `JobId`, `ArtifactId`,
`EpisodeId`, and `ActionId` are encoded as 16 raw bytes (the
canonical ULID byte form, big-endian: 48-bit timestamp + 80-bit
randomness).

### 2.3 ContentHash

A `ContentHash` is encoded as 32 raw bytes (the BLAKE3 output).
Hex encoding MAY be used in human-readable contexts (debugging,
log lines, headers) but MUST NOT be used on the canonical wire.

### 2.4 DID

A DID is encoded as a length-prefixed UTF-8 string, with the full
URI form (`did:method:identifier`).

## 3. Hybrid logical clock encoding

A `Timestamp` is encoded as a struct in the following order:

1. `wall_ms`: 64-bit unsigned integer (varint).
2. `logical`: 32-bit unsigned integer (varint).
3. `node`: a `NodeId` (varint as above).

The clock value's semantics and tick rules are specified in
[Clocks](05-clocks.md).

## 4. Operation envelope encoding

Every operation is encoded as a struct in the order this section
declares.

| Field | Type | Encoding |
|-------|------|----------|
| `id` | `OpId` | 16 bytes. |
| `schema_version` | varint | Currently `1`. |
| `timestamp` | `Timestamp` | as above. |
| `node_id` | `NodeId` | varint. |
| `causal_deps` | `Vec<OpId>` | `varint(len)` + 16 × len bytes. |
| `payload` | tagged union | varint discriminant + variant body; see [Operations](02-operations.md). |
| `signature` | `Option<Vec<u8>>` | option byte + length-prefixed bytes when `Some`. |

The variant discriminants for the payload union are assigned by
this specification and MUST be stable across implementations of
the same major version.

## 5. Canonical signing form

The signature is computed over the operation's canonical
encoding **with the `signature` field cleared to `None`**.

Procedure:

1. Set `signature = None` on the operation.
2. Encode the operation per Section 4.
3. Compute the Ed25519 signature over the resulting bytes using
   the authoring node's private key.
4. Set `signature = Some(<signature bytes wrapped in a detached
   JWS envelope>)` per [Signatures](06-signatures.md).

The reverse-verification procedure for receivers is specified in
[Signatures](06-signatures.md).

This rule — that the signature is cleared during signing — is
the single most error-prone aspect of v0.1 implementation.
Implementers SHOULD test it explicitly in cross-language
interoperability fixtures.

## 6. Sanitised operations

When an operation is sanitised (a caveat strips fields before
crossing a delegation; see [UCAN and Caveats](07-ucan-and-caveats.md)),
the sender MUST clear the `signature` field. The recipient MUST
NOT attempt to verify a signature on a sanitised op.

Sanitisation happens at the sender. The recipient distinguishes
sanitised ops from corrupted ops by the presence of a
caveat-derived sanitisation marker on the op envelope (described
in [UCAN and Caveats](07-ucan-and-caveats.md)). An op that
arrives without a signature **and** without the sanitisation
marker MUST be rejected.

## 7. Operation collections on the wire

The sync endpoint exchanges sequences of operations. The
on-the-wire encoding of `Vec<Operation>` is the postcard encoding
of the sequence: `varint(len)` followed by each operation in
order.

The order in the sequence is significant only as a hint:
recipients MUST apply received ops by their HLC total order, not
by sequence position.

## 8. Causal frontier encoding

A `CausalFrontier` is a per-author summary of the maximum
operation seen from each node. It is encoded as a map with the
following structure:

```
varint(num_authors)
for each author:
  NodeId         (varint)
  Timestamp      (struct)
```

The order of map entries on the wire is by ascending `NodeId`.

For use as a sync cursor in HTTP query parameters, the frontier
is base64url-encoded (RFC 4648, no padding). The cursor is
opaque to clients beyond this format; clients MUST NOT attempt
to construct cursor values other than by echoing back values
received from a server, except for the empty frontier (encoded as
`varint(0)`, base64url `AA`), which means "from the beginning."

## 9. UCAN token wire format

A UCAN delegation referenced by `DelegateUcan` is carried as
opaque bytes (`Vec<u8>`) — specifically, the detached-JWS form of
a UCAN v0.10 token over a JSON payload. The UCAN content hash
(`ucan_cid`) is the BLAKE3 of these bytes.

The UCAN token format is specified externally; see
[UCAN and Caveats](07-ucan-and-caveats.md) for the v0.10 details
and the v1.0 migration plan.

## 10. Mesh-rules hash

The mesh-rules document is a small structured value carrying the
non-negotiable parameters of a mesh (protocol version, agreed
caveat vocabulary, agreed sanitisation rules). It is encoded
canonically per Section 1, and its hash is the BLAKE3 of those
bytes.

The mesh-rules hash is exchanged on every sync exchange via the
`X-Cortex-Mesh-Rules-Hash` HTTP header (see [Sync](04-sync.md))
to detect rule drift between peers.

## 11. Header conventions

When operations are exchanged over HTTP, the following headers
have normative meaning:

- `Content-Type: application/octet-stream` for postcard bodies.
- `X-Cortex-Next-Frontier: <base64url>` — set by a server on
  successful pull responses; tells the client what frontier to
  send next.
- `X-Cortex-Mesh-Rules-Hash: <hex>` — set by both sides on every
  request and response; mismatch triggers the handshake-pause
  behaviour specified in [Sync](04-sync.md).

Implementations MAY define additional headers for diagnostics,
provided they do not begin with `X-Cortex-` (which is reserved
for protocol-defined headers).
