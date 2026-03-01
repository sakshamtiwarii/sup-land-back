import express from 'express';
import { body } from 'express-validator';
import {
  signup,
  login,
  googleAuth,
  checkEmail,
  checkUsername,
  getAllSignups,
  getStats
} from '../controllers/auth.controller.js';

const router = express.Router();

// Validation rules
const signupValidation = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  
  body('password')
    .exists()
    .withMessage('Password is required')
];

// Routes
router.post('/signup', signupValidation, signup);
router.post('/login', loginValidation, login);
router.post('/google', googleAuth);
router.get('/check-email/:email', checkEmail);
router.get('/check-username/:username', checkUsername);
router.get('/signups', getAllSignups);
router.get('/stats', getStats);

export default router;
