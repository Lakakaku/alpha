# Feature Specification: Swish Payment Integration

**Feature Branch**: `019-step-6-1` **Created**: 2025-09-25 **Status**: Draft
**Input**: User description: "Step 6.1: Swish Payment Integration - Set up Swish
merchant account, integrate Swish payment API, create batch payment processing,
build payment verification system, create feedback quality scoring, build reward
percentage calculation (2-15%), implement weekly reward aggregation, set up
payment timing optimization, create payment status monitoring, build payment
failure handling, implement payment history tracking, set up reconciliation
reporting"

## Execution Flow (main)

```
1. Parse user description from Input
   → Extracted: Payment integration, reward calculation, payment tracking
2. Extract key concepts from description
   → Actors: Customers, Admin, Swish Payment System
   → Actions: Calculate rewards, process payments, track status, reconcile
   → Data: Feedback quality scores, reward amounts, payment records
   → Constraints: 2-15% reward range, weekly payment cycle
3. For each unclear aspect:
   → [NEEDS CLARIFICATION: Swish API credentials and merchant account not yet available]
4. Fill User Scenarios & Testing section
   → User flow: Customer receives feedback-based reward via Swish
5. Generate Functional Requirements
   → All requirements testable with mock Swish integration
6. Identify Key Entities (payment records, reward calculations, transactions)
7. Run Review Checklist
   → WARN "Spec requires Swish API credentials for full implementation"
8. Return: SUCCESS (spec ready for planning with preparation phase)
```

---

## ⚡ Quick Guidelines

- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-09-25

- Q: How should the quality score (0-100) map to the reward percentage (2-15%)? → A: Threshold-based (Below 50 → no reward, 50-100 → linear 2-15%)
- Q: What is the maximum number of automatic retry attempts for failed Swish payments? → A: 3 retries (total 4 attempts including initial)
- Q: What is the minimum payout amount threshold for Swish payments? → A: 5 SEK (hold smaller amounts until threshold met)
- Q: How should the system handle currency rounding for reward calculations? → A: Round to nearest öre (0.01 SEK) using standard rounding
- Q: When should the weekly payment batch process run? → A: Sunday midnight 00:00 (end of calendar week)

---

## User Scenarios & Testing

### Primary User Story

As a customer who provided high-quality feedback through the AI phone call
system, I receive my earned cashback reward (2-15% of my transaction value) via
Swish once per week, aggregated across all stores where I gave feedback. The
system ensures legitimate transactions are rewarded while fraudulent feedback is
filtered out through business verification.

### Acceptance Scenarios

1. **Given** a customer has completed 3 verified feedback calls this week (Store
   A: 100 SEK transaction, 10% reward; Store B: 200 SEK transaction, 8% reward;
   Store C: 150 SEK transaction, 12% reward), **When** the weekly payment batch
   runs, **Then** the customer receives a single Swish payment of 44 SEK (10 +
   16 + 18 SEK combined)

2. **Given** a customer provided feedback with a quality score of 85/100,
   **When** the reward calculation runs, **Then** the system awards
   11.1% cashback (linear mapping: (85-50)/(100-50) × (15%-2%) + 2% = 11.1%)

3. **Given** a business verifies 20 feedback transactions and marks 3 as
   fraudulent, **When** the payment processing runs, **Then** only the 17
   verified legitimate feedbacks generate reward payments

4. **Given** a Swish payment fails due to invalid phone number, **When** the
   payment processor detects the failure, **Then** the system logs the failure,
   notifies admin, and schedules a retry with manual review

5. **Given** the admin reviews weekly payment reconciliation, **When** viewing
   the payment report, **Then** the system shows total rewards paid, admin fees
   (20% of rewards), number of successful/failed payments, and store-by-store
   breakdown

### Edge Cases

- What happens when a customer's phone number is no longer valid for Swish?
  - System marks payment as failed, holds reward for manual resolution, notifies
    admin

- What happens when aggregated weekly rewards are below 5 SEK minimum threshold?
  - System carries forward unpaid rewards to next week, continuing to accumulate
    until 5 SEK threshold is reached

- How does the system handle multiple feedback submissions from the same
  customer at the same store within one week?
  - Each verified feedback generates separate reward, all aggregated in weekly
    payment

- What if a business doesn't verify transactions by the payment deadline?
  - Unverified feedback does not generate payments, customer notification sent,
    business invoice excludes unverified transactions

- How are partial verifications handled (e.g., business verifies 10 out of 15
  submissions)?
  - Only verified transactions generate rewards, unverified feedback is marked
    as unprocessed and excluded from current payment cycle

- What happens if Swish API is unavailable during scheduled payment batch?
  - System retries payment batch automatically, logs downtime, sends admin
    notification, reschedules to next available window

## Requirements

### Functional Requirements

#### Feedback Quality Scoring

- **FR-001**: System MUST evaluate each feedback call based on legitimacy,
  depth, and usefulness criteria
- **FR-002**: System MUST assign a quality score from 0-100 for each feedback
  submission
- **FR-003**: System MUST use AI analysis (GPT-4o-mini) to detect fraudulent or
  nonsensical feedback
- **FR-004**: System MUST immediately delete low-grade feedback content (quality score below 50
  threshold) while preserving quality_score metadata for system analytics and reward calculation tracking
- **FR-005**: System MUST summarize high-grade feedback while preserving all
  information for business delivery

#### Reward Calculation

- **FR-006**: System MUST calculate reward percentage between 2-15% based on
  feedback quality score using threshold-based mapping: scores below 50 receive
  no reward, scores 50-100 map linearly to 2-15% (score 50 → 2%, score 100 → 15%)
- **FR-007**: System MUST apply the calculated percentage to the verified
  transaction value
- **FR-008**: System MUST calculate rewards in Swedish Kronor (SEK) with
  precision to 0.01 SEK (öre), using standard rounding (round half up)
- **FR-009**: System MUST aggregate all rewards per customer phone number across
  all stores for the week
- **FR-010**: System MUST include only business-verified transactions in reward
  calculations
- **FR-011**: System MUST exclude fraudulent or unverified feedback from reward
  calculations

#### Weekly Payment Processing

- **FR-012**: System MUST process payments once per week on Sunday at 00:00
  (midnight), marking the end of the calendar week (Monday-Sunday)
- **FR-013**: System MUST send a single aggregated Swish payment per customer
  per week if the total amount meets or exceeds 5 SEK minimum threshold
- **FR-014**: System MUST batch process all pending rewards for the week in a
  single operation
- **FR-015**: System MUST verify customer phone numbers are Swish-compatible
  before initiating payment
- **FR-016**: System MUST track payment status (pending, processing, successful,
  failed) for each transaction
- **FR-017**: System MUST generate invoice to business showing: total rewards +
  20% admin fee

#### Payment Verification & Tracking

- **FR-018**: System MUST confirm successful Swish payment completion for each
  transaction
- **FR-019**: System MUST detect and log payment failures with failure reason
- **FR-020**: System MUST store complete payment history including: amount,
  recipient, timestamp, status, store association
- **FR-021**: System MUST track payment attempts and retry count for failed
  payments
- **FR-022**: System MUST notify admin of payment failures requiring manual
  intervention
- **FR-023**: System MUST prevent duplicate payments for the same feedback
  submission

#### Payment Failure Handling

- **FR-024**: System MUST automatically retry failed payments up to 3 times
  (total 4 attempts including initial payment attempt)
- **FR-025**: System MUST implement exponential backoff between payment retry
  attempts
- **FR-026**: System MUST hold rewards for manual resolution after automatic
  retry limit is exceeded
- **FR-027**: System MUST provide admin interface to manually trigger payment
  retry for failed transactions
- **FR-028**: System MUST notify customers when payment cannot be completed and
  action is required

#### Reconciliation & Reporting

- **FR-029**: System MUST generate weekly reconciliation report showing: total
  rewards paid, admin fees collected, successful payment count, failed payment
  count
- **FR-030**: System MUST provide store-by-store breakdown of rewards paid per
  business
- **FR-031**: System MUST track and display payment processing costs and net
  revenue
- **FR-032**: System MUST reconcile business invoices against actual payments
  made to customers
- **FR-033**: System MUST identify discrepancies between expected and actual
  payment amounts
- **FR-034**: System MUST provide admin dashboard showing real-time payment
  processing status
- **FR-035**: System MUST generate exportable payment history reports for
  accounting purposes

#### Swish Integration Preparation

- **FR-036**: System MUST prepare data structures to interface with Swish
  payment API : Swish merchant account not yet available, prepare mock
  integration structure -- I do not have a Swish API right now.
- **FR-037**: System MUST implement payment request formatting compatible with
  Swish API specifications
- **FR-038**: System MUST handle Swish API responses and map status codes to
  internal payment states
- **FR-039**: System MUST store Swish transaction references for each payment
- **FR-040**: System MUST implement secure credential management for Swish API
  authentication : Credential storage approach pending merchant account setup --
  Find the best and most reasonable solution.

### Key Entities

- **Feedback Quality Score**: Numeric evaluation (0-100) of feedback legitimacy,
  depth, and usefulness, used to determine reward percentage
  - Attributes: score value, evaluation criteria breakdown, AI analysis
    timestamp
  - Relationships: Linked to specific feedback submission, influences reward
    calculation

- **Reward Calculation**: Record of how much cashback a customer earns for a
  specific feedback submission
  - Attributes: transaction value, quality score, reward percentage, reward
    amount in SEK, calculation timestamp
  - Relationships: Linked to feedback submission, customer phone number, store,
    verification status

- **Weekly Payment Batch**: Aggregated payment operation processing all pending
  rewards for a week
  - Attributes: batch ID, processing date (Sunday 00:00), week period
    (Monday-Sunday), total reward amount, total customer count, successful
    payment count, failed payment count
  - Relationships: Contains multiple payment transactions, links to
    reconciliation report

- **Payment Transaction**: Individual Swish payment record for one customer
  - Attributes: customer phone number, aggregated amount, Swish transaction ID,
    status (pending/processing/successful/failed), retry count, timestamp,
    failure reason
  - Relationships: Linked to multiple reward calculations (aggregated), linked
    to weekly batch, linked to payment history

- **Payment Failure Record**: Detailed tracking of failed payment attempts
  - Attributes: original transaction, failure reason, failure timestamp, retry
    attempts, resolution status, admin notes
  - Relationships: Linked to payment transaction, linked to retry history

- **Reconciliation Report**: Weekly summary of all payment activity and business
  invoicing
  - Attributes: report period, total rewards paid, admin fees collected (20% of
    rewards), payment success rate, discrepancy count, business invoice totals
  - Relationships: Linked to weekly payment batch, linked to business invoices,
    linked to payment transactions

- **Business Invoice**: Billing record sent to business for verified feedback
  rewards
  - Attributes: business ID, store IDs included, total reward amount, admin fee
    (20%), total invoice amount, payment due date, payment status
  - Relationships: Linked to reconciliation report, linked to verified feedback
    submissions, linked to business account

---

## Review & Acceptance Checklist

### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] Requirements are testable and unambiguous (with preparation phase noted)
- [x] Success criteria are measurable
- [x] Scope is clearly bounded (payment integration only)
- [x] Dependencies identified (Swish merchant account, business verification
      process)
- [x] Assumptions identified (Swish API credentials will be obtained, weekly
      payment cycle)

**Note**: Two [NEEDS CLARIFICATION] markers remain intentionally as they
reference external dependencies (Swish merchant account) that are acknowledged
as not yet available. The specification is designed to enable maximum
preparation work until these dependencies are resolved.

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (external dependencies noted)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
