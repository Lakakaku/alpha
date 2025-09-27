# Research: AI Call Integration Infrastructure

**Date**: 2025-09-22 **Feature**: AI Call Integration Infrastructure **Branch**:
010-step-3-2

## Telephony Provider Selection

### Decision: 46elks (Primary) with Twilio (Fallback)

**Rationale**:

- 46elks is a native Swedish provider with excellent local support and GDPR
  compliance
- EU-based infrastructure ensures low latency for Swedish customers
- Transparent pricing with no minimums (pay-as-you-go)
- Strong Node.js SDK support with webhook integration
- Twilio as enterprise fallback for reliability and global features

**Alternatives Considered**:

- **Twilio**: Industry leader but higher costs and not Swedish-native
- **Telnyx**: Cost-effective with technical excellence but less Swedish market
  focus
- **Vonage**: Solid alternative but limited Swedish market specialization
- **Plivo**: Cost-effective but basic feature set

**Implementation Details**:

- Primary: 46elks for Swedish market operations
- SDK: `fortysixelks-node` npm package
- Webhooks: Call events and status updates
- Recording: Built-in call recording with configurable limits

## GPT-4o-mini Voice Integration

### Decision: OpenAI Real-time API with gpt-4o-mini-realtime-preview

**Rationale**:

- Native Swedish language support with real-time audio processing
- Sub-600ms latency achievable with proper optimization
- Cost-effective: ~$0.06-0.24 per minute for 1-2 minute calls
- Built-in transcription and voice synthesis
- WebSocket-based streaming for real-time interaction

**Alternatives Considered**:

- **Azure OpenAI Service**: Sweden Central region available but higher
  complexity
- **Custom STT+GPT+TTS pipeline**: More control but higher latency and cost
- **Other voice AI services**: Limited Swedish language quality

**Implementation Pattern**:

```javascript
// WebSocket connection for real-time streaming
const sessionConfig = {
  model: 'gpt-4o-mini-realtime-preview',
  voice: 'alloy',
  input_audio_format: 'pcm16',
  output_audio_format: 'pcm16',
  instructions:
    'Du är en svensk AI-assistent som genomför strukturerade intervjuer.',
  max_response_output_tokens: 1500,
  temperature: 0.6,
}
```

## Call Duration Monitoring

### Decision: Multi-layer timeout system with graceful degradation

**Rationale**:

- Hard timeout at 2 minutes prevents cost overruns
- Warning at 80% duration (96 seconds) allows graceful conclusion
- Real-time monitoring prevents unexpected charges
- Automatic cutoff with polite Swedish farewell message

**Implementation Strategy**:

- JavaScript `setTimeout` for hard limits
- Real-time duration tracking in call session
- Progressive warnings to user
- Graceful conversation conclusion

## Question Selection Algorithm

### Decision: Frequency-based priority queue with context awareness

**Rationale**:

- Balances question frequency requirements with time constraints
- Prioritizes high-priority questions when multiple are due
- Groups related questions for natural conversation flow
- Considers business context and customer history

**Algorithm Components**:

1. **Priority Calculation**: frequency × priority_weight × context_relevance
2. **Time Budget Management**: Questions selected to fit 1-2 minute window
3. **Context Grouping**: Related questions asked together for flow
4. **Fallback Logic**: Essential questions guaranteed inclusion

## Call State Management

### Decision: Node-based conversation flow with state persistence

**Rationale**:

- Structured interview format ensures consistent data collection
- State persistence allows call recovery if needed
- Modular design supports different question types
- Real-time flow adaptation based on responses

**Flow Architecture**:

- **Introduction Node**: Consent and explanation
- **Question Nodes**: Dynamic based on selection algorithm
- **Transition Logic**: Response analysis determines next question
- **Conclusion Node**: Thank you and call completion

## Error Handling and Reliability

### Decision: Multi-layer fallback with retry mechanisms

**Rationale**:

- Production-ready reliability for customer-facing calls
- Graceful degradation maintains user experience
- Multiple failure points covered (telephony, AI, network)
- Cost protection through automatic cutoffs

**Fallback Layers**:

1. **WebSocket Reconnection**: Up to 3 attempts with exponential backoff
2. **Telephony Failover**: 46elks to Twilio automatic switching
3. **AI Fallback**: Pre-recorded messages if GPT-4o-mini fails
4. **Timeout Protection**: Multiple timeout layers prevent infinite calls

## Integration Architecture

### Decision: Microservices with event-driven communication

**Rationale**:

- Separation of concerns for telephony, AI, and business logic
- Scalable architecture supporting multiple concurrent calls
- Event-driven design enables real-time monitoring
- Fits existing monorepo structure with Railway deployment

**Service Components**:

- **Call Orchestrator**: Manages call lifecycle and state
- **Telephony Service**: 46elks/Twilio integration
- **AI Service**: GPT-4o-mini real-time API integration
- **Question Service**: Business context and question selection
- **Analytics Service**: Call logging and metrics

## Cost Optimization

### Decision: Token limiting with usage monitoring

**Rationale**:

- Predictable costs: ~$0.06-0.24 per call maximum
- Real-time monitoring prevents budget overruns
- Efficient token usage through response limiting
- Cost per successful call aligns with business model

**Optimization Strategies**:

- Maximum 1500 output tokens per response
- Temperature 0.6 for focused responses
- Conversation history truncation after 10 exchanges
- Real-time cost tracking with automatic cutoffs

## Implementation Priority

1. **Phase 1**: Basic telephony integration with 46elks
2. **Phase 2**: GPT-4o-mini real-time API integration
3. **Phase 3**: Question selection and flow management
4. **Phase 4**: Advanced monitoring and analytics
5. **Phase 5**: Failover and reliability enhancements

---

**All NEEDS CLARIFICATION items resolved** **Ready for Phase 1: Design &
Contracts**
