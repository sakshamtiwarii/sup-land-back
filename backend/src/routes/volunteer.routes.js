import express from 'express';
import { volunteerValidation, submitVolunteer, getAllVolunteers, getVolunteerStats, updateVolunteer, deleteVolunteer } from '../controllers/volunteer.controller.js';

const router = express.Router();

// Routes
router.post('/', volunteerValidation, submitVolunteer);
router.get('/', getAllVolunteers);
router.get('/stats', getVolunteerStats);
router.put('/:id', updateVolunteer);
router.delete('/:id', deleteVolunteer);

export default router;
