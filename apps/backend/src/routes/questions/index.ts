import { Router } from 'express';
import { selectQuestions, getQuestionConfig } from './select';

const router = Router();

// Question selection endpoints
router.post('/select', selectQuestions);
router.get('/:businessId/config', getQuestionConfig);

export default router;