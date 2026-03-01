import express from 'express';
import { suggestionValidation, submitSuggestion, getAllSuggestions, getSuggestionStats, updateSuggestion, deleteSuggestion } from '../controllers/suggestion.controller.js';

const router = express.Router();

// Routes
router.post('/', suggestionValidation, submitSuggestion);
router.get('/', getAllSuggestions);
router.get('/stats', getSuggestionStats);
router.put('/:id', updateSuggestion);
router.delete('/:id', deleteSuggestion);

export default router;
