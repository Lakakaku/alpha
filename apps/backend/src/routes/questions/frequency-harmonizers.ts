import express from 'express';
import { z } from 'zod';
import { FrequencyHarmonizerService } from '../../services/questions/frequency-harmonizer';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';

const router = express.Router();

const CreateFrequencyHarmonizerSchema = z.object({
  question_id_1: z.string().uuid(),
  question_id_2: z.string().uuid(),
  resolution_strategy: z.enum(['combine', 'priority', 'alternate', 'custom']),
  custom_frequency: z.number().int().positive().optional(),
  priority_question_id: z.string().uuid().optional()
});

const UpdateFrequencyHarmonizerSchema = CreateFrequencyHarmonizerSchema.partial();

// GET /api/questions/harmonizers/{ruleId}
router.get('/:ruleId', authMiddleware, async (req, res) => {
  try {
    const { ruleId } = req.params;

    if (!z.string().uuid().safeParse(ruleId).success) {
      return res.status(400).json({
        error: 'Invalid rule ID format'
      });
    }

    const harmonizers = await FrequencyHarmonizerService.getByRuleId(ruleId);

    res.json(harmonizers);
  } catch (error) {
    console.error('Error fetching frequency harmonizers:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch harmonizers'
    });
  }
});

// POST /api/questions/harmonizers/{ruleId}
router.post('/:ruleId', 
  authMiddleware, 
  validateRequest(CreateFrequencyHarmonizerSchema),
  async (req, res) => {
    try {
      const { ruleId } = req.params;
      const harmonizerData = req.body;

      if (!z.string().uuid().safeParse(ruleId).success) {
        return res.status(400).json({
          error: 'Invalid rule ID format'
        });
      }

      // Validate that the two questions are different
      if (harmonizerData.question_id_1 === harmonizerData.question_id_2) {
        return res.status(400).json({
          error: 'Question IDs must be different'
        });
      }

      // Validate priority_question_id if resolution_strategy is 'priority'
      if (harmonizerData.resolution_strategy === 'priority' && !harmonizerData.priority_question_id) {
        return res.status(400).json({
          error: 'priority_question_id is required when resolution_strategy is priority'
        });
      }

      // Validate custom_frequency if resolution_strategy is 'custom'
      if (harmonizerData.resolution_strategy === 'custom' && !harmonizerData.custom_frequency) {
        return res.status(400).json({
          error: 'custom_frequency is required when resolution_strategy is custom'
        });
      }

      // Validate priority_question_id is one of the two questions
      if (harmonizerData.priority_question_id && 
          harmonizerData.priority_question_id !== harmonizerData.question_id_1 &&
          harmonizerData.priority_question_id !== harmonizerData.question_id_2) {
        return res.status(400).json({
          error: 'priority_question_id must be one of the two questions in the pair'
        });
      }

      const harmonizer = await FrequencyHarmonizerService.create(ruleId, harmonizerData);

      res.status(201).json(harmonizer);
    } catch (error) {
      console.error('Error creating frequency harmonizer:', error);
      
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({
          error: 'Frequency harmonizer already exists for this question pair'
        });
      }

      if (error.code === '23503') { // Foreign key constraint violation
        return res.status(404).json({
          error: 'Referenced rule or questions not found'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to create harmonizer'
      });
    }
  }
);

// PUT /api/questions/harmonizers/{ruleId}/{harmonizerId}
router.put('/:ruleId/:harmonizerId',
  authMiddleware,
  validateRequest(UpdateFrequencyHarmonizerSchema),
  async (req, res) => {
    try {
      const { ruleId, harmonizerId } = req.params;
      const updateData = req.body;

      if (!z.string().uuid().safeParse(ruleId).success || 
          !z.string().uuid().safeParse(harmonizerId).success) {
        return res.status(400).json({
          error: 'Invalid ID format'
        });
      }

      // Apply same validation as POST if fields are being updated
      if (updateData.resolution_strategy === 'priority' && updateData.priority_question_id === undefined) {
        return res.status(400).json({
          error: 'priority_question_id is required when resolution_strategy is priority'
        });
      }

      if (updateData.resolution_strategy === 'custom' && updateData.custom_frequency === undefined) {
        return res.status(400).json({
          error: 'custom_frequency is required when resolution_strategy is custom'
        });
      }

      const harmonizer = await FrequencyHarmonizerService.update(harmonizerId, updateData);

      if (!harmonizer) {
        return res.status(404).json({
          error: 'Frequency harmonizer not found'
        });
      }

      res.json(harmonizer);
    } catch (error) {
      console.error('Error updating frequency harmonizer:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to update harmonizer'
      });
    }
  }
);

// DELETE /api/questions/harmonizers/{ruleId}/{harmonizerId}
router.delete('/:ruleId/:harmonizerId', authMiddleware, async (req, res) => {
  try {
    const { ruleId, harmonizerId } = req.params;

    if (!z.string().uuid().safeParse(ruleId).success || 
        !z.string().uuid().safeParse(harmonizerId).success) {
      return res.status(400).json({
        error: 'Invalid ID format'
      });
    }

    const success = await FrequencyHarmonizerService.delete(harmonizerId);

    if (!success) {
      return res.status(404).json({
        error: 'Frequency harmonizer not found'
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting frequency harmonizer:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to delete harmonizer'
    });
  }
});

export default router;