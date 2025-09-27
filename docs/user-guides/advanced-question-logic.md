# Advanced Question Logic User Guide

## Introduction

The Advanced Question Logic system in Vocilia Alpha helps you maximize the value
of your customer feedback calls by intelligently combining and triggering the
most relevant questions for each customer. The system ensures you collect the
most valuable insights within the 1-2 minute call duration while avoiding
customer fatigue.

## Key Benefits

- **Intelligent Question Selection**: Automatically chooses the most relevant
  questions based on customer purchase behavior
- **Time Optimization**: Ensures important questions are asked first when call
  time is limited
- **Reduced Customer Fatigue**: Avoids asking irrelevant or repetitive questions
- **Improved Feedback Quality**: Higher response rates due to personalized
  question selection
- **Business Insights**: Better understanding of what drives customer
  satisfaction

## Core Features

### 1. Question Combination Rules

Question combination rules define how your questions are grouped and prioritized
during customer calls.

#### Setting Up Combination Rules

1. **Navigate to Questions > Advanced Settings** in your business dashboard
2. **Create a New Rule** or modify your existing default rule
3. **Configure Time Thresholds**:
   - **Call Duration**: Set maximum call length (60-180 seconds, recommended:
     120 seconds)
   - **Priority Thresholds**: Define when to switch to higher priority questions
     - Critical: 0 seconds (always ask critical questions)
     - High: 60 seconds (ask high priority when 60+ seconds remain)
     - Medium: 90 seconds (ask medium priority when 90+ seconds remain)
     - Low: 120 seconds (ask low priority when full time available)

#### Best Practices for Combination Rules

- Start with the default 120-second call duration
- Set critical priority for your most important questions (customer
  satisfaction, safety issues)
- Use high priority for business-critical feedback (service quality, product
  issues)
- Reserve low priority for nice-to-have insights (suggestions, demographics)

### 2. Dynamic Triggers

Dynamic triggers automatically select specific questions based on customer
behavior and purchase data.

#### Trigger Types

##### Purchase-Based Triggers

Activate questions based on what customers bought.

**Example Setup**:

- **Trigger Name**: "Meat Department Quality"
- **Categories**: ["meat", "deli"]
- **Minimum Items**: 1
- **Questions Triggered**: "How was the freshness of our meat products?"

**Configuration Tips**:

- Use broad categories (meat, produce, bakery) for consistent triggering
- Combine related departments for comprehensive feedback
- Set minimum item counts to avoid triggering on small purchases

##### Time-Based Triggers

Activate questions based on when customers shop.

**Example Setup**:

- **Trigger Name**: "Lunch Rush Experience"
- **Time Window**: 11:30 AM - 1:30 PM
- **Days**: Monday-Friday
- **Questions Triggered**: "How was the queue time today?"

**Configuration Tips**:

- Identify your busy periods and create specific triggers
- Use different triggers for weekdays vs. weekends
- Consider seasonal variations (holidays, summer hours)

##### Amount-Based Triggers

Activate questions based on purchase value.

**Example Setup**:

- **Trigger Name**: "High Value Customer"
- **Minimum Amount**: 500 SEK
- **Questions Triggered**: "Did you find everything you needed?", "How was our
  premium service?"

**Configuration Tips**:

- Set thresholds based on your average transaction value
- Create multiple tiers (medium spenders, high spenders, VIP)
- Use currency-appropriate values for your market

#### Managing Trigger Priority

Each trigger has a priority level (1-5):

- **5 (Critical)**: Safety issues, major complaints
- **4 (High)**: Service quality, product problems
- **3 (Medium)**: General satisfaction, suggestions
- **2 (Low)**: Demographics, preferences
- **1 (Optional)**: Marketing research, future planning

#### Trigger Sensitivity

Control how often triggers activate using the sensitivity threshold (1-100):

- **1**: Triggers every customer (100% activation)
- **5**: Triggers every 5th eligible customer (20% activation)
- **10**: Triggers every 10th eligible customer (10% activation)
- **50**: Triggers every 50th eligible customer (2% activation)

**Recommendation**: Start with sensitivity of 10 for new triggers, adjust based
on response volume.

### 3. Question Prioritization

The system automatically prioritizes your questions using a 5-level system:

#### Priority Levels Explained

1. **Critical (5)**: Must-ask questions about safety, major issues
2. **High (4)**: Important business insights, service quality
3. **Medium (3)**: General satisfaction, routine feedback
4. **Low (2)**: Nice-to-have insights, suggestions
5. **Optional (1)**: Research questions, future planning

#### Setting Question Priorities

1. **Go to Questions > Manage Questions**
2. **Select a question** to edit
3. **Choose Priority Level** from dropdown
4. **Optional**: Set a **Weight Multiplier** (0.5-2.0) for fine-tuning

**Weight Multiplier Examples**:

- 2.0: Double the effective priority (High becomes Critical-level)
- 1.5: Boost priority by 50%
- 1.0: Standard priority (default)
- 0.8: Slightly lower priority
- 0.5: Half the effective priority

### 4. Frequency Harmonization

When multiple questions have different frequency settings, the system needs
rules for resolving conflicts.

#### Resolution Strategies

##### Combine Strategy

Ask both questions in the same call when possible.

- **Best for**: Related questions that complement each other
- **Example**: Product quality + Service quality

##### Priority Strategy

Always prioritize one question over another.

- **Best for**: When one question is more important
- **Example**: Safety concerns always override satisfaction questions

##### Alternate Strategy

Take turns asking questions over multiple calls.

- **Best for**: Questions that provide similar value
- **Example**: Alternate between different product categories

##### Custom Strategy

Define a specific frequency interval.

- **Best for**: Special cases needing precise control
- **Example**: Ask VIP questions every 3 calls instead of every 5

#### Setting Up Harmonizers

1. **Go to Questions > Advanced Settings > Frequency Harmonization**
2. **Review Detected Conflicts** (system automatically finds conflicts)
3. **Choose Resolution Strategy** for each conflict
4. **Test Configuration** with preview tool

### 5. Question Groups and Topics

The system groups related questions to create natural conversation flow.

#### Automatic Topic Grouping

The system uses AI to group questions by topic:

- **Service**: Staff friendliness, checkout speed, assistance
- **Product**: Quality, freshness, variety, availability
- **Environment**: Cleanliness, layout, atmosphere
- **Value**: Pricing, promotions, value perception

#### Custom Topic Configuration

1. **Go to Questions > Manage Questions**
2. **Edit a question**
3. **Set Topic Category** from predefined list or create custom
4. **Set Estimated Response Time** (in tokens/seconds)

**Estimation Guidelines**:

- Simple yes/no: 10-15 tokens (5-10 seconds)
- Rating scale: 15-25 tokens (10-15 seconds)
- Short description: 25-40 tokens (15-25 seconds)
- Detailed feedback: 40-60+ tokens (25-35+ seconds)

## Getting Started Guide

### Step 1: Review Current Questions

1. **Audit Existing Questions**: Review all active questions in your account
2. **Assign Priorities**: Set appropriate priority levels (1-5) for each
   question
3. **Categorize Topics**: Ensure each question has the correct topic category

### Step 2: Create Basic Triggers

Start with simple, high-impact triggers:

**Recommended First Triggers**:

1. **High Value Purchase**: Amount-based, >500 SEK, triggers service quality
   questions
2. **Peak Hours**: Time-based, lunch/evening rush, triggers queue/staff
   questions
3. **Fresh Departments**: Purchase-based, meat/produce/bakery, triggers
   freshness questions

### Step 3: Configure Combination Rules

1. **Create Default Rule**: 120-second duration with standard thresholds
2. **Test Time Allocation**: Use preview tool to see question selection
3. **Adjust Thresholds**: Modify based on your question priorities

### Step 4: Monitor and Optimize

1. **Review Analytics**: Check trigger effectiveness weekly
2. **Adjust Sensitivity**: Increase/decrease trigger frequency based on response
   volume
3. **Refine Priorities**: Update question priorities based on business insights

## Advanced Configuration

### Multiple Combination Rules

Create different rules for different scenarios:

- **Busy Periods**: Shorter duration (90 seconds), higher priority thresholds
- **Quiet Periods**: Longer duration (150 seconds), more comprehensive
  questioning
- **Special Events**: Custom rules for holidays, promotions, new product
  launches

### Complex Trigger Conditions

Combine multiple conditions for precise targeting:

**Example - Weekend Family Shoppers**:

- **Time**: Saturday-Sunday, 10 AM - 4 PM
- **Amount**: >300 SEK
- **Categories**: Include produce, bakery, household
- **Questions**: Family-friendly service, product variety, convenience

### Dynamic Priority Adjustment

Use weight multipliers for seasonal adjustments:

- **Summer**: Boost fresh produce questions (multiplier: 1.5)
- **Holidays**: Prioritize customer service questions (multiplier: 1.3)
- **New Store**: Emphasize layout and navigation questions (multiplier: 1.2)

## Troubleshooting Common Issues

### "My important questions aren't being asked"

**Solutions**:

1. **Check Priority Level**: Ensure critical questions are set to priority 4-5
2. **Review Time Thresholds**: Lower thresholds for high-priority questions
3. **Verify Triggers**: Confirm triggers are active and properly configured
4. **Check Frequency Conflicts**: Review harmonization settings

### "Customers are getting too many questions"

**Solutions**:

1. **Increase Sensitivity**: Raise trigger sensitivity thresholds
2. **Reduce Call Duration**: Lower maximum call duration to force prioritization
3. **Review Question Length**: Ensure estimated tokens are accurate
4. **Combine Similar Questions**: Merge related questions to reduce total count

### "Questions don't seem relevant to purchases"

**Solutions**:

1. **Review Trigger Categories**: Ensure categories match your product
   organization
2. **Check Minimum Items**: Adjust minimum item counts for triggers
3. **Verify Purchase Data**: Confirm customer purchase data is correctly
   categorized
4. **Update Trigger Conditions**: Refine conditions for better targeting

### "System is too slow during busy periods"

**Solutions**:

1. **Check Trigger Count**: Reduce number of active triggers (max
   recommended: 20)
2. **Simplify Conditions**: Use simpler trigger conditions
3. **Review Cache Settings**: Contact support to verify cache configuration
4. **Monitor Performance**: Use admin tools to track response times

## Analytics and Optimization

### Key Metrics to Monitor

1. **Trigger Effectiveness**: Percentage of triggered questions that provide
   valuable feedback
2. **Response Quality**: Average rating or sentiment of customer responses
3. **Call Duration**: Actual vs. planned call duration
4. **Question Coverage**: Percentage of important topics covered per customer

### Monthly Review Checklist

- [ ] Review trigger activation rates (target: 10-30% for most triggers)
- [ ] Check question priority distribution in actual calls
- [ ] Analyze customer feedback quality scores
- [ ] Update trigger sensitivity based on response volume
- [ ] Review and resolve new frequency conflicts
- [ ] Test new trigger configurations in staging environment

### Performance Optimization Tips

1. **Start Simple**: Begin with 3-5 basic triggers, expand gradually
2. **Monitor Cache Hit Rate**: Should be >90% for good performance
3. **Regular Cleanup**: Remove unused or ineffective triggers monthly
4. **Test Changes**: Always test configuration changes in staging first
5. **Seasonal Adjustments**: Plan trigger adjustments for seasonal business
   changes

## Support and Resources

### Getting Help

- **In-App Help**: Click the "?" icon in any advanced settings screen
- **Video Tutorials**: Available in Help > Video Guides
- **Live Support**: Chat support available during business hours
- **Documentation**: Comprehensive guides at docs.vocilia.com

### Best Practice Resources

- **Weekly Webinars**: Join "Question Logic Optimization" sessions
- **Case Studies**: Learn from successful implementations
- **Community Forum**: Share experiences with other businesses
- **Expert Consultation**: Book 1-on-1 sessions for complex setups

### Training Recommendations

1. **Basic Setup** (1 hour): Learn core concepts and create first triggers
2. **Advanced Configuration** (2 hours): Master complex triggers and
   harmonization
3. **Analytics & Optimization** (1 hour): Use data to improve question selection
4. **Troubleshooting** (30 minutes): Resolve common configuration issues

The Advanced Question Logic system becomes more valuable as you refine your
configuration. Start with basic triggers, monitor results, and gradually add
complexity as you learn what works best for your business and customers.
