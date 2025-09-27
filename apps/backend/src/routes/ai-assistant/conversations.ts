import { Router } from 'express';
import { supabase } from '../../config/supabase';
import { authenticateRequest } from '../../middleware/auth';
import { validateStoreAccess } from '../../middleware/store-access';

const router = Router();

router.use(authenticateRequest);

router.get('/', async (req, res) => {
  try {
    const { store_id } = req.query;
    const businessId = req.user.businessId;

    if (!store_id) {
      return res.status(400).json({
        error: 'Missing required parameter: store_id'
      });
    }

    const { data: conversations, error } = await supabase
      .from('ai_conversations')
      .select(`
        id,
        store_id,
        title,
        status,
        context_score,
        message_count,
        last_activity_at,
        created_at,
        updated_at
      `)
      .eq('store_id', store_id)
      .eq('business_id', businessId)
      .order('last_activity_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({
        error: 'Failed to fetch conversations'
      });
    }

    res.json({
      conversations: conversations || [],
      total: conversations?.length || 0
    });
  } catch (error) {
    console.error('Conversation list error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { store_id, title } = req.body;
    const businessId = req.user.businessId;

    if (!store_id) {
      return res.status(400).json({
        error: 'Missing required field: store_id'
      });
    }

    await validateStoreAccess(businessId, store_id);

    const conversationData = {
      store_id,
      business_id: businessId,
      title: title || `Context Building Session - ${new Date().toLocaleDateString()}`,
      status: 'active',
      context_score: 0,
      message_count: 0,
      last_activity_at: new Date().toISOString(),
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: conversation, error } = await supabase
      .from('ai_conversations')
      .insert(conversationData)
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return res.status(500).json({
        error: 'Failed to create conversation'
      });
    }

    res.status(201).json({
      conversation
    });
  } catch (error) {
    console.error('Conversation creation error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;

    const { data: conversation, error } = await supabase
      .from('ai_conversations')
      .select(`
        id,
        store_id,
        title,
        status,
        context_score,
        message_count,
        last_activity_at,
        metadata,
        created_at,
        updated_at,
        ai_messages (
          id,
          conversation_id,
          role,
          content,
          metadata,
          created_at
        )
      `)
      .eq('id', id)
      .eq('business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Conversation not found'
        });
      }
      console.error('Error fetching conversation:', error);
      return res.status(500).json({
        error: 'Failed to fetch conversation'
      });
    }

    const messages = conversation.ai_messages || [];
    const sortedMessages = messages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    res.json({
      conversation: {
        ...conversation,
        messages: sortedMessages
      }
    });
  } catch (error) {
    console.error('Conversation fetch error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, status } = req.body;
    const businessId = req.user.businessId;

    if (!title && !status) {
      return res.status(400).json({
        error: 'At least one field (title, status) is required'
      });
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (title) updateData.title = title;
    if (status) updateData.status = status;

    const { data: conversation, error } = await supabase
      .from('ai_conversations')
      .update(updateData)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Conversation not found'
        });
      }
      console.error('Error updating conversation:', error);
      return res.status(500).json({
        error: 'Failed to update conversation'
      });
    }

    res.json({
      conversation
    });
  } catch (error) {
    console.error('Conversation update error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;

    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) {
      console.error('Error deleting conversation:', error);
      return res.status(500).json({
        error: 'Failed to delete conversation'
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Conversation deletion error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;