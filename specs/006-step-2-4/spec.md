# Feature Specification: Custom Questions Configuration Panel

**Feature Branch**: `006-step-2-4` **Created**: 2025-09-21 **Status**: Draft
**Input**: User description: "### Step 2.4: Custom Questions Configuration Panel

- [ ] **Task 2.4.1**: Question creation interface
  - Build question text input with rich formatting
  - Create frequency settings dropdown (1-100 customers)
  - Implement department/area tagging system
  - Set up priority levels (High/Medium/Low)
- [ ] **Task 2.4.2**: Question management system
  - Create question categories organization
  - Build active period date selection
  - Implement question preview functionality
  - Set up question activation/deactivation
- [ ] **Task 2.4.3**: Dynamic question triggers
  - Create purchase-based trigger configuration
  - Build time-based trigger settings
  - Implement amount-based trigger rules
  - Set up conditional question logic ------ here is some overall context about
    the whole project: '/Users/lucasjenner/alpha/VISION.md'"

## Execution Flow (main)

```
1. Parse user description from Input
   � If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   � Identify: actors, actions, data, constraints
3. For each unclear aspect:
   � Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   � If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   � Each requirement must be testable
   � Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   � If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   � If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## � Quick Guidelines

-  Focus on WHAT users need and WHY
- L Avoid HOW to implement (no tech stack, APIs, code structure)
- =e Written for business stakeholders, not developers

### Section Requirements

- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation

When creating this spec from a user prompt:

1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for
   any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login
   system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable
   and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing _(mandatory)_

### Primary User Story

A business manager wants to create custom feedback questions to gather specific
insights about their store operations. They need to configure when these
questions are asked, how frequently they appear, and which customer interactions
should trigger them. The manager should be able to organize questions by
departments, set priorities, and control the active periods when questions are
available to customers.

### Acceptance Scenarios

1. **Given** a business manager is logged into their dashboard, **When** they
   access the questions configuration panel, **Then** they should see options to
   create new questions and manage existing ones
2. **Given** a manager is creating a new question, **When** they enter question
   text and select frequency settings, **Then** the system should validate the
   input and save the question configuration
3. **Given** a manager has created questions, **When** they organize them into
   categories and set active periods, **Then** the questions should only appear
   to customers during the specified timeframes
4. **Given** a manager configures question triggers, **When** customers meet the
   trigger conditions (purchase amount, time-based, etc.), **Then** the
   appropriate questions should be presented during their feedback session
5. **Given** a manager wants to preview a question, **When** they use the
   preview functionality, **Then** they should see exactly how the question will
   appear to customers
6. **Given** a manager needs to deactivate a question temporarily, **When** they
   toggle the question status, **Then** the question should stop appearing to
   new customers immediately

### Edge Cases

- What happens when a question's active period expires while a customer is
  mid-session?
- How does the system handle conflicting trigger conditions for multiple
  questions?
- What happens when the frequency limit is reached for a question?
- How are questions prioritized when multiple questions match the same trigger
  conditions?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow business managers to create custom feedback
  questions with rich text formatting capabilities
- **FR-002**: System MUST provide frequency settings allowing managers to
  specify how often questions appear (1-100 customers range)
- **FR-003**: System MUST enable department/area tagging so questions can be
  associated with specific store sections
- **FR-004**: System MUST support priority levels (High/Medium/Low) for question
  ordering and display logic
- **FR-005**: System MUST allow managers to organize questions into categories
  for better management
- **FR-006**: System MUST provide active period date selection to control when
  questions are available
- **FR-007**: System MUST include question preview functionality showing exactly
  how customers will see the question
- **FR-008**: System MUST allow managers to activate and deactivate questions
  without deleting them
- **FR-009**: System MUST support purchase-based triggers that show questions
  based on transaction amounts
- **FR-010**: System MUST provide time-based trigger settings for questions to
  appear at specific times or intervals
- **FR-011**: System MUST enable amount-based trigger rules linking questions to
  spending thresholds
- **FR-012**: System MUST support conditional question logic allowing complex
  trigger combinations
- **FR-013**: System MUST prevent questions from exceeding their configured
  frequency limits
- **FR-014**: System MUST prioritize questions according to their assigned
  priority levels when multiple questions qualify
- **FR-015**: System MUST persist all question configurations and trigger
  settings for future customer sessions

How should the system handle permission levels - the point is that one business
only should have one or few business accounts, meaning that all business
accounts should be able to do this. What is the maximum number of questions a
business can create? It depends on how many questions they create, for example;
they cannot have 10 questions, and each of them being asked to every second
customer, then the maths do not work. How long should question analytics and
response data be retained? When it is uploaded to the business' analytics
dashboard, then they may be removed?? Should there be approval workflows for
question creation or can managers publish immediately? I think the
business-accounts just can publish them immediately.

### Key Entities _(include if feature involves data)_

- **Custom Question**: Represents a business-created feedback question with text
  content, formatting, metadata, and status
- **Question Category**: Groups related questions for organizational purposes,
  belongs to a specific business
- **Question Trigger**: Defines conditions that determine when a question should
  be presented to customers
- **Question Schedule**: Manages active periods, frequency limits, and timing
  constraints for question display
- **Question Priority**: Determines display order and selection logic when
  multiple questions qualify for presentation

---

## Review & Acceptance Checklist

_GATE: Automated checks run during main() execution_

### Content Quality

- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status

_Updated by main() during processing_

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed

---
