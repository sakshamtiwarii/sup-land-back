import { validationResult, body } from 'express-validator';
import Suggestion from '../models/Suggestion.js';
import { sendSuggestionNotification, sendUserConfirmation } from '../utils/emailService.js';

// Validation rules
export const suggestionValidation = [
  body('suggestion')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Suggestion must be between 10 and 5000 characters'),
  
  body('isAnonymous')
    .exists()
    .withMessage('Anonymous flag is required')
    .customSanitizer((value) => {
      // Convert various formats to boolean
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value === 'true';
      if (typeof value === 'number') return value === 1;
      return Boolean(value);
    }),
  
  body('name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address')
];

// @desc    Submit a new suggestion
// @route   POST /api/suggestions
// @access  Public
export const submitSuggestion = async (req, res) => {
  try {
    // Debug: log received data
    console.log('Received suggestion request:', {
      body: req.body,
      isAnonymous: req.body.isAnonymous,
      isAnonymousType: typeof req.body.isAnonymous
    });

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { suggestion, isAnonymous, name, email } = req.body;

    // Validate that name and email are provided if not anonymous
    if (!isAnonymous) {
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Name is required when not in anonymous mode'
        });
      }
      if (!email || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Email is required when not in anonymous mode'
        });
      }
    }

    // Create new suggestion
    const newSuggestion = await Suggestion.create({
      suggestion: suggestion.trim(),
      isAnonymous: Boolean(isAnonymous),
      name: isAnonymous ? undefined : name.trim(),
      email: isAnonymous ? undefined : email.toLowerCase().trim()
    });

    // Send email notification to admin (fire-and-forget)
    sendSuggestionNotification({
      isAnonymous: newSuggestion.isAnonymous,
      name: newSuggestion.name,
      email: newSuggestion.email,
      suggestion: newSuggestion.suggestion,
      createdAt: newSuggestion.createdAt
    }).catch(() => {});

    // Send confirmation email to user (if not anonymous) (fire-and-forget)
    if (!isAnonymous && email) {
      sendUserConfirmation('suggestion', email, name).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: isAnonymous 
        ? 'Thank you for your anonymous suggestion!' 
        : 'Thank you for your suggestion! We appreciate your input.',
      data: {
        id: newSuggestion._id,
        createdAt: newSuggestion.createdAt,
        status: newSuggestion.status
      }
    });

  } catch (error) {
    // Don't log sensitive error details
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

// @desc    Get all suggestions (for admin use)
// @route   GET /api/suggestions
// @access  Public (you might want to add admin auth later)
export const getAllSuggestions = async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const suggestions = await Suggestion.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Suggestion.countDocuments(filter);

    res.json({
      success: true,
      count: suggestions.length,
      total,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      },
      data: suggestions
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get suggestion statistics
// @route   GET /api/suggestions/stats
// @access  Public
export const getSuggestionStats = async (req, res) => {
  try {
    const total = await Suggestion.countDocuments();
    const newSuggestions = await Suggestion.countDocuments({ status: 'new' });
    const anonymous = await Suggestion.countDocuments({ isAnonymous: true });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Suggestion.countDocuments({
      createdAt: { $gte: today }
    });

    // Status breakdown
    const statusCounts = await Suggestion.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        total,
        new: newSuggestions,
        anonymous,
        today: todayCount,
        byStatus: statusCounts.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update suggestion status (for admin)
// @route   PUT /api/suggestions/:id
// @access  Public (you might want to add admin auth later)
export const updateSuggestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, responded } = req.body;

    const suggestion = await Suggestion.findByIdAndUpdate(
      id,
      { 
        ...(status && { status }),
        ...(adminNotes !== undefined && { adminNotes }),
        ...(responded !== undefined && { responded })
      },
      { new: true, runValidators: true }
    );

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found'
      });
    }

    res.json({
      success: true,
      message: 'Suggestion updated successfully',
      data: suggestion
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete a suggestion (for admin)
// @route   DELETE /api/suggestions/:id
// @access  Public (you might want to add admin auth later)
export const deleteSuggestion = async (req, res) => {
  try {
    const { id } = req.params;
    
    const suggestion = await Suggestion.findByIdAndDelete(id);
    
    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found'
      });
    }

    res.json({
      success: true,
      message: 'Suggestion deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
