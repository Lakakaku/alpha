import { Router } from 'express';
import { supabase } from '../../config/supabase';
import { authenticateRequest } from '../../middleware/auth';
import { OpenAIService } from '../../services/openai';
import { contextExtractionService } from '../../services/context-extraction';
import { validationScoringService } from '../../services/validation-scoring';

const router = Router();
const openAIService = new OpenAIService();

router.use(authenticateRequest);

router.post('/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, stream = false } = req.body;
    const businessId = req.user.businessId;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'Message content is required'
      });
    }

    const { data: conversation, error: convError } = await supabase
      .from('ai_conversations')
      .select('id, store_id, business_id')
      .eq('id', conversationId)
      .eq('business_id', businessId)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({
        error: 'Conversation not found'
      });
    }

    const userMessage = {
      conversation_id: conversationId,
      role: 'user',
      content: content.trim(),
      metadata: {},
      created_at: new Date().toISOString()
    };

    const { data: savedUserMessage, error: userMsgError } = await supabase
      .from('ai_messages')
      .insert(userMessage)
      .select()
      .single();

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError);
      return res.status(500).json({
        error: 'Failed to save message'
      });
    }

    const { data: existingContext } = await supabase
      .from('context_entries')
      .select('*')
      .eq('store_id', conversation.store_id);

    const conversationHistory = await getConversationHistory(conversationId);
    
    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      try {
        const systemPrompt = buildSystemPrompt(existingContext || [], conversation.store_id);
        let assistantResponse = '';

        const streamGenerator = openAIService.streamChatCompletion(
          conversationHistory.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })),
          systemPrompt
        );

        for await (const chunk of streamGenerator) {
          if (chunk.chunk) {
            assistantResponse += chunk.chunk;
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: chunk.chunk
            })}\n\n`);
          }

          if (chunk.isComplete) {
            const assistantMessage = {
              conversation_id: conversationId,
              role: 'assistant',
              content: assistantResponse,
              metadata: {
                tokens: chunk.totalTokens,
                model: openAIService.getModel()
              },
              created_at: new Date().toISOString()
            };

            const { data: savedAssistantMessage } = await supabase
              .from('ai_messages')
              .insert(assistantMessage)
              .select()
              .single();

            await processMessageContext(content, conversation.store_id, existingContext || []);
            await updateConversationActivity(conversationId);

            res.write(`data: ${JSON.stringify({
              type: 'complete',
              messageId: savedAssistantMessage?.id,
              totalTokens: chunk.totalTokens
            })}\n\n`);

            res.write('data: [DONE]\n\n');
            res.end();
            break;
          }
        }
      } catch (error) {
        console.error('Streaming error:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Failed to generate response'
        })}\n\n`);
        res.end();
      }
    } else {
      try {
        const systemPrompt = buildSystemPrompt(existingContext || [], conversation.store_id);
        
        const { content: aiResponse, tokens } = await openAIService.getChatCompletion(
          conversationHistory.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })),
          systemPrompt
        );

        const assistantMessage = {
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse,
          metadata: {
            tokens,
            model: openAIService.getModel()
          },
          created_at: new Date().toISOString()
        };

        const { data: savedAssistantMessage, error: assistantMsgError } = await supabase
          .from('ai_messages')
          .insert(assistantMessage)
          .select()
          .single();

        if (assistantMsgError) {
          console.error('Error saving assistant message:', assistantMsgError);
          return res.status(500).json({
            error: 'Failed to save AI response'
          });
        }

        await processMessageContext(content, conversation.store_id, existingContext || []);
        await updateConversationActivity(conversationId);

        res.json({
          userMessage: savedUserMessage,
          assistantMessage: savedAssistantMessage
        });
      } catch (error) {
        console.error('Message processing error:', error);
        res.status(500).json({
          error: 'Failed to process message'
        });
      }
    }
  } catch (error) {
    console.error('Message route error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.get('/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const businessId = req.user.businessId;

    const { data: conversation } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('business_id', businessId)
      .single();

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found'
      });
    }

    const { data: messages, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({
        error: 'Failed to fetch messages'
      });
    }

    res.json({
      messages: messages || [],
      total: messages?.length || 0
    });
  } catch (error) {
    console.error('Message fetch error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

async function getConversationHistory(conversationId: string) {
  const { data: messages } = await supabase
    .from('ai_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return messages || [];
}

async function processMessageContext(
  message: string,
  storeId: string,
  existingContext: any[]
) {
  try {
    const contextResult = await contextExtractionService.extractContextFromMessage(
      message,
      storeId,
      existingContext
    );

    for (const extracted of contextResult.extracted) {
      const contextEntry = {
        store_id: storeId,
        category: extracted.category,
        type: extracted.type,
        content: extracted.content,
        confidence: extracted.confidence,
        metadata: extracted.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await supabase
        .from('context_entries')
        .insert(contextEntry);
    }
  } catch (error) {
    console.error('Context processing error:', error);
  }
}

async function updateConversationActivity(conversationId: string) {
  try {
    const { data: messageCount } = await supabase
      .from('ai_messages')
      .select('id', { count: 'exact' })
      .eq('conversation_id', conversationId);

    const { data: contextEntries } = await supabase
      .from('context_entries')
      .select('*')
      .eq('store_id', conversationId);

    let contextScore = 0;
    if (contextEntries && contextEntries.length > 0) {
      const validationResult = await validationScoringService.calculateContextScore(
        conversationId,
        contextEntries
      );
      contextScore = validationResult.overallScore;
    }

    await supabase
      .from('ai_conversations')
      .update({
        message_count: messageCount?.length || 0,
        context_score: contextScore,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);
  } catch (error) {
    console.error('Conversation activity update error:', error);
  }
}

function buildSystemPrompt(existingContext: any[], storeId: string): string {
  const contextSummary = existingContext.length > 0 
    ? existingContext.map(ctx => `${ctx.category}/${ctx.type}: ${ctx.content}`).join('\n')
    : 'No existing context available.';

  return `You are an AI assistant helping a business owner build comprehensive store context for better customer feedback collection.

Your role is to:
1. Guide the conversation to gather detailed business information
2. Ask clarifying questions to build complete context
3. Suggest improvements to existing information
4. Help identify gaps in their current context

Current store context:
${contextSummary}

Context categories to focus on:
- Business Information: name, type, size, hours, location
- Products/Services: main offerings, specialties, price ranges
- Customer Demographics: target audience, typical customers
- Store Environment: atmosphere, layout, unique features
- Operational Details: staff size, peak hours, processes
- Goals & Challenges: business objectives, pain points
- Quality Standards: service expectations, standards

Guidelines:
- Be conversational and helpful
- Ask one focused question at a time
- Acknowledge what they've already shared
- Suggest specific improvements when relevant
- Keep responses concise but informative
- Focus on information that will help generate better customer feedback questions

Respond naturally and help them build the most complete picture of their business possible.`;
}

export default router;