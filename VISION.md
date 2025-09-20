# VISION.md - Customer Feedback Reward System

## Overview
A comprehensive customer feedback system for businesses with physical stores, where customers scan QR codes to provide feedback through AI-powered phone calls and receive cashback rewards based on the quality of their feedback.

## System Flow

### 1. Initial Customer Interaction
- **QR Code Display**: Physical stores display QR codes on paper in their locations
- **Customer Scan**: Customers scan the QR code with their phones
- **Landing Page**: Customers are directed to a verification page

### 2. Customer Verification Process
Customers must provide three pieces of information:
- **Transaction Time**: Time of purchase (�2 minutes tolerance)
  - Default value: Current time
- **Transaction Value**: Amount spent in SEK (�2 SEK tolerance)
- **Telephone Number**: Customer's phone number for callback

### 3. AI-Powered Feedback Call
- **Technology**: Swedish-speaking GPT-4o-mini bot conducts the call
- **Duration**: 1-2 minutes per call
- **Purpose**: Collect detailed feedback about the store experience
- **Guidance**: Questions are based on the business's context window settings

### 4. Feedback Analysis & Grading
- **Analyzer**: Another GPT-4o-mini instance evaluates the feedback
- **Grading Criteria**:
  - Legitimacy (fraud detection)
  - Depth of feedback
  - Usefulness of information
- **Reward Calculation**: 2-15% cashback based on feedback grade
- **Fraud Detection**: Identifies fake or nonsensical feedback (e.g., "store should buy flying elephants")

## Business Context Window (Context Route)

### Purpose
Central information hub where businesses configure their feedback system and provide comprehensive context for AI analysis. This is accessed through the "Context Route" in the business account interface.

### Core Business Information Section

#### Store Profile
- **Store Type**: Category and subcategory of business (grocery, electronics, clothing, etc.)
- **Store Size**: Square footage, number of departments
- **Operating Hours**: Daily schedule, special hours
- **Location Details**: Address, parking availability, accessibility features

#### Personnel Information
- **Staff Count**: Number of employees per shift
- **Departments**: Staff allocation by department
- **Key Personnel**: Manager names, department heads
- **Customer Service Points**: Information desk locations, checkout counters

#### Physical Layout Documentation
- **Store Map**: Detailed layout of all sections
- **Department Locations**: Exact positioning of each department
- **Recent Changes**: Any layout modifications with dates
- **Special Areas**: Customer service, returns, pickup points
- **Navigation Flow**: How customers typically move through store

#### Inventory & Services
- **Product Categories**: Complete list of what store offers
- **Special Services**: Delivery, installation, custom orders
- **Payment Methods**: Accepted payment options
- **Loyalty Programs**: Existing customer programs

### Custom Questions Configuration Panel

#### Question Creation Interface
- **Question Text Field**: Write the exact question for customers
- **Frequency Settings**:
  - Dropdown menu: "Ask every [X] customer"
  - Range: 1-100 customers
  - Can set multiple questions with different frequencies
- **Department/Area Tags**: Link questions to specific store areas
- **Priority Levels**: High/Medium/Low priority questions
- **Active Period**: Set start and end dates for temporary questions

#### Question Categories & Examples

**Product Feedback**:
- "Every 5th customer: What products were you looking for but couldn't find?"
- "Every 10th customer: Rate the freshness of our produce section"

**Service Quality**:
- "Every 3rd customer: How was your interaction with our staff today?"
- "Every 7th customer: Was checkout time acceptable?"

**Store Environment**:
- "Every 4th customer: How clean did you find our store?"
- "Every 8th customer: Was the store temperature comfortable?"

**Specific Campaigns**:
- "Every 5th customer: Have you noticed our new organic section?"
- "Every 6th customer: Thoughts on our renovated bakery department?"

**Problem Identification**:
- "Every customer: What's the worst aspect of shopping here?"
- "Every 15th customer: Any accessibility issues you encountered?"

#### Dynamic Question Triggers
- **Purchase-Based**: "If customer bought from meat section, ask about meat quality"
- **Time-Based**: "During lunch hours, ask about queue times"
- **Amount-Based**: "For purchases over 500 SEK, ask about value perception"

### AI Assistant Interface (Context Builder)

#### Conversation Panel
- **Chat Interface**: Natural language conversation with AI
- **Suggested Topics**: AI prompts for missing information
- **Context Gaps Identified**: Red flags for incomplete information
- **Auto-Save**: All conversation data automatically added to context

#### AI Capabilities

**Information Extraction**:
- Asks about recent renovations and dates
- Inquires about known customer complaints
- Requests competitor information
- Gathers seasonal variation details

**Context Enhancement**:
- Suggests missing personnel information
- Identifies unlisted departments
- Recommends layout details to add
- Proposes customer journey mapping

#### Proactive Suggestions

**Question Recommendations**:
- Based on store type (grocery vs electronics)
- Based on recent changes (post-renovation feedback)
- Based on season (summer vs winter specific)
- Based on missing context areas

**Frequency Optimization**:
- AI suggests optimal question frequencies
- Balances between data collection and customer experience
- Ensures 1-2 minute call duration is maintained

### Context Validation System

#### Completeness Checker
- **Required Fields**: Highlighted in red if missing
- **Recommended Fields**: Highlighted in yellow if missing
- **Context Score**: 0-100% completeness rating
- **Improvement Suggestions**: Specific actions to improve context

#### Fraud Detection Configuration
- **Baseline Facts**: Unmutable truths about the store
- **Acceptable Creativity Range**: Define boundaries for suggestions
- **Red Flag Keywords**: Terms that indicate fake feedback
- **Verification Thresholds**: Set sensitivity levels

### Question Combination Logic Engine

#### Automatic Combination Rules
- **Time Constraint**: Ensures total questions fit within 1-2 minute call
- **Topic Grouping**: Related questions asked together
- **Priority Balancing**: High priority questions get precedence
- **Frequency Harmonization**: Combines questions with compatible frequencies

#### Examples of Combinations
- **Customer 5**: Gets meat section + general satisfaction questions
- **Customer 10**: Gets produce freshness + checkout experience
- **Customer 15**: Gets accessibility + worst aspect questions
- **Customer 20**: Gets all accumulated questions that align

### Context History & Versioning

#### Version Control
- **Change Log**: Every modification tracked with timestamp
- **Rollback Option**: Restore previous context versions
- **Comparison View**: See differences between versions
- **Change Authorization**: Who made what changes when

#### Performance Tracking
- **Question Effectiveness**: Which questions generate best feedback
- **Context Accuracy**: How well context prevents fraud
- **AI Suggestion Success**: Track adopted vs rejected suggestions

## Data Management System

### Database Structure

#### Store-Specific Databases
- **Unique Identifier**: Store ID from individual QR code
- **Data Stored**:
  - Feedback content (summarized by GPT-4o-mini for reward-eligible calls)
  - Transaction time
  - Transaction value
  - User telephone number
- **Location**: Accessible through admin website HTML blocks

#### Feedback Processing
- **Low-Grade Feedback , the feedback that is not good enough for getting rewards from**: Deleted immediately (no reward eligibility)
- **High-Grade Feedback**: Summarized while preserving all information

### Weekly Verification Cycle

#### Step 1: Admin to Business Upload
- **Frequency**: Once per week
- **Content**: Database with transaction times and values only (no phone numbers or feedback)
- **Purpose**: Business verification against POS system

#### Step 2: Business Verification
- Business checks each transaction against their POS system
- Marks feedback as either:
  - **Verified**: Legitimate transaction confirmed
  - **Fake**: No matching transaction found

#### Step 3: Return to Admin
- Business sends back verified database
- Admin processes verified feedback
- Fake feedback is automatically filtered out

#### Step 4: Invoicing & Final Upload
- **Invoice Amount**: Total rewards + 20% admin fee
- **After Payment**: Feedback database uploaded to business
- **Privacy**: Business receives feedback but cannot see it directly in database

#### Telephone Number Database
- **Purpose**: Track all rewards across all stores per phone number
- **Weekly Processing**:
  - Aggregates all rewards per phone number
  - Single lump sum payment via Swish
  - One payment per week per phone number (combines all store rewards)

## Business Account Website Interface

### Main Features

#### QR Code Management
- One unique QR code per store
- Multiple codes for businesses with multiple locations

#### Navigation Elements
- Company email display
- Logout button
- Context route (to context window)
- Feedback analysis route
- Feedback database access

#### Database Functions
- View uploaded verification database
- Verify transactions button
- Send back verified database button

## Admin Account Interface

### Store Management
- Display list of all stores in HTML blocks

### HTML Block Contents (Per Store)
- Store ID
- Store name
- Business account association
- Business email address
- Database access
- Upload button for weekly database transfer
- All required functional buttons

## Feedback Analysis Page (Business Account)

### Features

#### Store Selection
- Filter feedback by specific store location

#### AI-Powered Analysis (GPT-4o-mini)
- **Data Source**: Current week's feedback only
- **Analysis Categories**:
  - Negative feedback summary
  - Positive feedback summary
  - General opinions
  - New critique from last week
  - Additional insights

#### Search Functionality
- Smart search capabilities
- Query specific departments (e.g., "meat section opinions")
- Natural language queries through chatbot interface

#### Temporal Comparison
- Week-over-week feedback comparison
- Track if previous issues were resolved
- Identify new emerging issues
- Store development over time

#### Default Display
- Maximum analysis information shown by default
- Minimize need for chatbot interaction
- Comprehensive dashboard view

## Technical Specifications

### AI Components
- **Feedback Collection**: GPT-4o-mini (Swedish language)
- **Feedback Analysis**: GPT-4o-mini (grading and fraud detection)
- **Feedback Summarization**: GPT-4o-mini (for reward-eligible feedback)
- **Business Analysis**: GPT-4o-mini (feedback analysis page)

### Payment System
- **Method**: Swish (Swedish mobile payment)
- **Frequency**: Weekly batch payments
- **Range**: 2-15% of transaction value

### Data Retention
- **Low-grade feedback**: Immediate deletion
- **High-grade feedback**: Summarized and stored
- **Verification cycle**: Weekly

## Security & Privacy Considerations

### Customer Privacy
- Phone numbers not shared with businesses during verification
- Feedback anonymized in final delivery
- Aggregated rewards for multiple stores

### Fraud Prevention
- Transaction time verification (�2 minutes)
- Transaction value verification (�2 SEK)
- POS system cross-reference
- Context-based legitimacy analysis
- Creative but reasonable proposal acceptance

### Business Protection
- 20% admin fee on rewards
- Verification before payment
- Fake feedback filtering
- Context-based fraud detection