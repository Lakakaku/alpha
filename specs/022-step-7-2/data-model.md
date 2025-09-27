# Data Model: Security & Privacy Testing

**Feature**: Security & Privacy Testing Framework **Date**: 2025-09-27

## Core Entities

### Security Test Case

**Purpose**: Represents individual security testing scenarios with comprehensive
validation criteria

**Fields**:

- `id`: UUID - Unique identifier for test case
- `name`: string - Descriptive test case name
- `category`: enum - Authentication, Authorization, Privacy, GDPR,
  Vulnerability, Fraud
- `attack_vector`: string - Specific attack method being tested
- `expected_defense`: string - Expected system behavior to block attack
- `pass_criteria`: string[] - Conditions that must be met for test to pass
- `performance_impact_limit`: number - Maximum acceptable performance
  degradation percentage (≤10%)
- `execution_frequency`: enum - On-demand, Daily, Weekly, Monthly
- `priority`: enum - Critical, High, Medium, Low
- `created_at`: timestamp
- `updated_at`: timestamp

**Relationships**:

- Has many `SecurityTestResults`
- Belongs to `SecurityTestSuite`

**State Transitions**:

- Draft → Active → Deprecated
- Active → Maintenance → Active

**Validation Rules**:

- Performance impact limit must be ≤10%
- Attack vector must be non-empty and specific
- Pass criteria must include measurable conditions

### Privacy Assessment

**Purpose**: Tracks data flow analysis and personal data identification across
system components

**Fields**:

- `id`: UUID - Unique identifier
- `component_name`: string - System component being assessed (API, Database,
  Frontend)
- `data_flow_path`: string[] - Sequence of data movement through system
- `personal_data_types`: enum[] - PhoneNumber, TransactionData, FeedbackContent,
  SessionData
- `anonymization_status`: enum - Required, Applied, Verified, Failed
- `anonymization_method`: string - Technique used for data anonymization
- `verification_result`: boolean - Whether anonymization was successful
- `compliance_score`: number - 0-100 score for privacy compliance
- `risk_level`: enum - Low, Medium, High, Critical
- `assessment_date`: timestamp
- `next_review_date`: timestamp

**Relationships**:

- References `DataProtectionAudit`
- Has many `PrivacyViolations`

**Validation Rules**:

- Compliance score must be 0-100
- High/Critical risk levels require immediate review
- Anonymization verification required for customer data

### GDPR Compliance Record

**Purpose**: Documents legal requirement testing and data subject rights
validation

**Fields**:

- `id`: UUID - Unique identifier
- `request_type`: enum - DataDeletion, DataAccess, DataExport, ConsentWithdrawal
- `customer_identifier`: string - Anonymized customer reference
- `request_timestamp`: timestamp - When request was received
- `completion_timestamp`: timestamp - When request was fulfilled
- `response_time_hours`: number - Time to complete request
- `compliance_status`: enum - Pending, Completed, Failed, Overdue
- `deletion_scope`: string[] - Data types/tables affected by deletion
- `verification_method`: string - How completion was verified
- `audit_trail`: string[] - Step-by-step processing log
- `legal_basis`: string - GDPR article justifying processing

**Relationships**:

- Links to `DataProtectionAudit`
- References `SecurityTestCase` for validation testing

**State Transitions**:

- Pending → InProgress → Completed
- Pending → InProgress → Failed → Retry → Completed

**Validation Rules**:

- Data deletion requests must complete within 72 hours
- All deletion operations must be verifiable
- Audit trail must be immutable and complete

### Vulnerability Report

**Purpose**: Contains discovered security issues with risk assessment and
remediation tracking

**Fields**:

- `id`: UUID - Unique identifier
- `vulnerability_type`: enum - OWASP category or custom type
- `severity`: enum - Critical, High, Medium, Low, Info
- `cve_reference`: string - Common Vulnerabilities and Exposures ID
- `affected_component`: string - System component with vulnerability
- `discovery_method`: enum - AutomatedScan, PenetrationTest, CodeReview,
  External
- `discovery_date`: timestamp
- `description`: string - Detailed vulnerability description
- `exploit_scenario`: string - How vulnerability could be exploited
- `impact_assessment`: string - Potential business/security impact
- `remediation_steps`: string[] - Actions required to fix vulnerability
- `remediation_status`: enum - Open, InProgress, Fixed, Accepted, WontFix
- `remediation_deadline`: timestamp
- `retest_required`: boolean
- `retest_result`: enum - Pass, Fail, NotTested

**Relationships**:

- Has many `VulnerabilityRetests`
- References `SecurityTestCase` that discovered it

**Validation Rules**:

- Critical vulnerabilities require remediation within 24 hours
- High severity vulnerabilities require remediation within 72 hours
- All fixed vulnerabilities must be retested

### Access Control Matrix

**Purpose**: Maps user roles to system resources with authorization boundary
validation

**Fields**:

- `id`: UUID - Unique identifier
- `user_role`: enum - Admin, Business, Customer, SecurityTester, Anonymous
- `resource_type`: enum - API, Database, File, AdminPanel, BusinessDashboard
- `resource_identifier`: string - Specific resource path or ID
- `permission_type`: enum - Read, Write, Delete, Execute, Admin
- `access_granted`: boolean - Whether access should be allowed
- `test_result`: enum - Pass, Fail, NotTested
- `test_method`: string - How access control was tested
- `bypass_attempts`: string[] - Attack methods attempted
- `security_boundary`: string - Description of security control
- `last_tested`: timestamp
- `test_frequency`: enum - PerDeployment, Daily, Weekly

**Relationships**:

- References `SecurityTestCase` for validation
- Links to specific user accounts for testing

**Validation Rules**:

- Security testers must have full admin access (per clarifications)
- Business accounts must not access other business data
- Customer data access must be logged and authorized

### Data Protection Audit

**Purpose**: Records comprehensive data handling throughout QR verification and
payment workflows

**Fields**:

- `id`: UUID - Unique identifier
- `workflow_type`: enum - QRVerification, FeedbackCollection,
  BusinessVerification, PaymentProcessing
- `customer_data_types`: enum[] - PhoneNumber, TransactionAmount,
  TransactionTime, FeedbackContent
- `data_entry_point`: string - Where data enters the system
- `processing_steps`: object[] - Detailed processing workflow with timestamps
- `data_transformations`: object[] - How data is modified during processing
- `storage_locations`: string[] - Where data is stored (tables, cache, logs)
- `access_attempts`: object[] - Who accessed data and when
- `anonymization_applied`: boolean - Whether data was anonymized
- `retention_period`: number - Days data is retained
- `deletion_triggered`: boolean - Whether automatic deletion occurred
- `compliance_violations`: string[] - Any detected compliance issues
- `audit_timestamp`: timestamp

**Relationships**:

- Has many `PrivacyAssessments`
- Links to `GDPRComplianceRecords`

**Validation Rules**:

- All customer data access must be logged
- Retention periods must align with legal requirements
- Anonymization must be verified for business data delivery

## Relationships Overview

```
SecurityTestCase 1:N SecurityTestResults
SecurityTestCase N:1 SecurityTestSuite
PrivacyAssessment 1:N PrivacyViolations
PrivacyAssessment N:1 DataProtectionAudit
GDPRComplianceRecord N:1 DataProtectionAudit
VulnerabilityReport 1:N VulnerabilityRetests
AccessControlMatrix N:1 SecurityTestCase
DataProtectionAudit 1:N PrivacyAssessments
```

## State Machines

### Security Test Case Lifecycle

```
[Draft] → [Active] → [Deprecated]
[Active] ↔ [Maintenance]
```

### GDPR Request Processing

```
[Pending] → [InProgress] → [Completed]
[InProgress] → [Failed] → [Retry] → [Completed]
```

### Vulnerability Remediation

```
[Open] → [InProgress] → [Fixed] → [Retested] → [Closed]
[Fixed] → [Failed Retest] → [InProgress]
[Open] → [Accepted] (with justification)
[Open] → [WontFix] (with justification)
```

## Data Retention and Privacy

### Personal Data Handling

- Customer phone numbers: Encrypted at rest, access logged
- Transaction data: Anonymized after verification cycle
- Feedback content: Summarized and anonymized for business delivery
- Session data: Automatic expiration per security policy

### GDPR Compliance Data

- Request processing logs: Retained for 6 years (legal requirement)
- Deletion audit trails: Permanent retention for compliance proof
- Access logs: Retained for 2 years for security analysis
- Test result data: Anonymized after 1 year

### Security Test Data

- Test execution logs: Retained for 1 year
- Vulnerability reports: Retained until remediation verified
- Performance metrics: Retained for 6 months for trend analysis
- Access control test results: Retained for compliance audits
