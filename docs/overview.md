# Overview

This chapter describes the protocol in five minutes, no code. If you
want the *why* first, read [Motivation](motivation.md) — this chapter
assumes you already accept that owning your own knowledge graph is
worth specifying. If you want the wire-level rules, jump to
[Conventions](spec/00-conventions.md).

## The picture

A user runs a small mesh of nodes — typically a phone, a laptop, and
maybe a server they own. Each node is a self-contained implementation
of the protocol: a local database, a sync engine, and (where the
hardware allows) an inference engine. The nodes talk to each other
directly over the local network or the public internet, never through
a central service.

What the nodes share is a single append-only log of signed operations.
The log is the canonical state. Everything else — what the user sees
on a card, what the model is given as context, what is highlighted as
"important today" — is a projection of the log, regenerable from it.

## What's on the log

Operations come in a few categories.

**Evidence operations** record raw inputs the user has chosen to
ingest: a photo (referenced by content hash, not embedded), a calendar
event, a contact card, a message thread. Evidence is immutable once
written. Removing it requires a tombstone op, which cascades through
everything derived from it.

**Entity operations** record the things the user's life is *about*:
people, places, organisations, events, commitments, concepts. Entities
are not pre-defined by the protocol; they are derived. The protocol
specifies how an implementation may merge two entities ("Sarah" the
contact is the same as "Sarah M." extracted from a photo caption), how
it may split one back apart, and how it must record the provenance of
those decisions.

**Claim operations** record the working hypotheses the system is
operating on: "Sarah is a close contact." "Tuesday mornings are gym
mornings." "The next coffee with Mike is overdue." Claims have a
status — *hint*, *claim*, *fact* — that reflects how strongly they
are believed and whether the user has confirmed them. Claims have
explicit confidence and explicit provenance: every claim links back
through the operations that derived it to the evidence at the bottom.

**Episode operations** record clusters of claims and evidence that
form a meaningful unit — a trip, a project, a relationship arc, a
day. Episodes are how the system surfaces narratives instead of
isolated facts.

**Suggested-action operations** record proposals the system makes to
the user: "message Sarah," "review Friday's calendar," "stop tracking
that goal." Suggested actions have their own lifecycle: proposed,
shown, acted on, dismissed. They are the system's recommendations,
made visible and refutable like everything else.

**User-assertion operations** record what the user themselves has
said: "yes, that's right," "no, refute that," "merge those two."
User assertions take precedence over derived claims. They are the
mechanism by which the user is the final authority on facts about
themselves.

**Job and lease operations** record work the mesh has scheduled,
claimed, completed, or yielded — for example, "this server should
synthesise an episode for last week." This is how a phone offloads
inference to a laptop without anyone having to be in charge of the
whole mesh.

**Capability operations** record permissions: who may write what, who
may read what, who may schedule what kind of work. They use UCAN
delegations, rooted at the user.

**Coordinator and routing operations** record decisions about *who
does what* in the mesh: which node coordinates derivation, which
kinds of jobs route to which node.

The full taxonomy is in [Operations](spec/02-operations.md). For now
the important point is: every state change is one of these
operations, every operation is signed by its author, every operation
is timestamped with a hybrid logical clock so causal order is total
across the mesh.

## What you read from

A naive reader of an append-only log would have to fold over the
whole thing every time they wanted to know whether Sarah was a close
contact. Implementations don't. They maintain a small set of
projections — materialized read views — that an op-application
function keeps in sync with the log.

The protocol distinguishes four projections by purpose:

- A small, in-memory, ranking-oriented view used to decide what's
  salient *now*.
- A larger, in-memory, model-prompt-oriented view used to assemble
  context windows for inference calls.
- A durable, on-disk, lookup-oriented view used by the user
  interface for "show me everything you know about Sarah."
- A debug-only, full-graph view, used by inspection tooling.

Each projection consumes the log; none of them are canonical. Any of
them can be discarded and rebuilt. The protocol specifies what each
one must be able to answer; how an implementation builds it is open.

## How nodes converge

There is one HTTP endpoint and one cursor. A node asks a peer for
"the operations you have that I don't," sending its causal frontier
as the cursor. The peer returns the matching slice of its log. Both
nodes apply received operations into their local log idempotently.
Because operations are timestamped with a hybrid logical clock and
the merge rules for any conflicting updates are deterministic, two
nodes that have seen the same set of operations agree on the same
projected state.

There is no leader. There is no central coordinator. There is no
handshake more elaborate than "what's your causal frontier; here is
the set difference." Sync is the same operation whether two nodes are
catching up after a week apart or staying current minute-by-minute.

Capabilities filter what crosses the wire. A node holding only a
read-only delegation for calendar evidence will not be served claims
about photos. The filter runs on the source side. Operations that
must be sanitised before crossing — strip GPS, redact participants,
truncate body text — have their signatures cleared at sanitisation
time, which makes the change visible to the recipient as a
deliberate intent rather than a corruption.

## How permissions work

Every node has a key. Every operation is signed by a node key. Every
node key is itself the subject of capability delegations issued by
the user (or by another node the user has delegated authority to).

A capability is a triple: a *resource* (operations of a certain
class, evidence of a certain class, jobs of a certain kind), an
*action* (read, write, schedule, claim, complete), and a set of
*caveats* that narrow it (only evidence of these source types, only
claims with these predicates, only jobs in this time range, only
operations that have been sanitised in these specific ways).

Delegations form a graph rooted at the user. Revoking a delegation
prunes the subgraph beneath it. The protocol specifies how a node
must interpret an incoming op against its capability set, so any
two implementations agree on whether a given op was authorised at
the moment it was sent.

## How inference is audited

When an implementation calls a model — to summarise a window, to
draft a suggested action, to extract entities from a photo caption
— the call itself is an operation. The retrieved context, the
prompt, the model identity, the timing, and the output are all
recorded as an *inference snapshot* artefact on the log.

The snapshot is referenced from any claim or suggested action the
call produced. Asking "why did the system suggest I message Sarah
today" follows the link from the suggested action to the snapshot
to the inputs. There is no operation in the system that produces
user-visible recommendations without leaving this trail.

Snapshots are themselves bounded — they have a TTL, they can be
evicted, they can be tombstoned with the rest of an evidence
cascade. But while they exist, they are the audit record.

## A day in the life

A user takes a photo. The phone ingests it as an evidence operation
(content hash + EXIF + Vision labels), runs the deterministic
extraction pass on the labels and any visible text, and emits some
candidate claims as hint-status operations. Nothing has been shown to
the user yet.

Overnight, the user's laptop — which has more capable hardware —
claims the synthesise job for yesterday. It pulls the relevant slice
of the log, assembles a model context, makes one inference call, and
writes the resulting episode and suggested actions back as
operations. The inference snapshot is also written.

The phone receives the new operations on next sync. Its salience
projection rebuilds. The next time the user opens the app, a card
appears: "Coffee with Mike — last seen at the same shop two weeks
ago, your usual rhythm is monthly." The user taps "show why." The
app follows the suggested-action's link to its snapshot, which lists
the evidence, the claims, the model used, and the literal prompt.

The next day the user refutes one of the claims — the system
assumed Mike worked nearby, but he doesn't. That refutation is a
user-assertion op. The derivation cascade fires: claims that
depended on Mike's location are invalidated. The next salience
projection no longer surfaces the suggestion that depended on it.

None of this required a service. None of it required a vendor.
None of it could have happened in a way the user couldn't audit
or undo.

## Where to go next

- [Concepts](concepts.md) — the mental model in more depth, with
  diagrams.
- [Comparison](comparison.md) — how this protocol relates to Solid,
  AT Protocol, Nostr, Iroh, the local-first manifesto, and UCAN.
- [Conventions](spec/00-conventions.md) — the start of the normative
  specification.
