import { validationResult, body } from 'express-validator';
import Volunteer from '../models/Volunteer.js';
import { sendVolunteerNotification, sendUserConfirmation } from '../utils/emailService.js';

// Validation rules
export const volunteerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  
  body('skills')
    .isArray({ min: 1 })
    .withMessage('At least one skill is required')
    .custom((value) => {
      const validSkills = ['development', 'design', 'marketing', 'community', 'product'];
      const isValid = value.every(skill => validSkills.includes(skill));
      if (!isValid) {
        throw new Error('Invalid skill selected');
      }
      return true;
    }),
  
  body('timeAvailability')
    .isIn(['5-10', '10-20', '20+', 'flexible'])
    .withMessage('Invalid time availability option'),
  
  body('message')
    .trim()
    .isLength({ min: 20, max: 3000 })
    .withMessage('Message must be between 20 and 3000 characters')
];

// @desc    Submit volunteer application
// @route   POST /api/volunteers
// @access  Public
export const submitVolunteer = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, skills, timeAvailability, message } = req.body;

    // Check if there's already a pending application from this email
    const existingApplication = await Volunteer.findOne({
      email: email.toLowerCase(),
      status: { $in: ['pending', 'reviewed', 'contacted'] }
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending application. We will review it soon!'
      });
    }

    // Create new volunteer application
    const newVolunteer = await Volunteer.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      skills,
      timeAvailability,
      message: message.trim()
    });

    // Send email notification to admin (fire-and-forget)
    sendVolunteerNotification({
      name: newVolunteer.name,
      email: newVolunteer.email,
      skills: newVolunteer.skills,
      timeAvailability: newVolunteer.timeAvailability,
      message: newVolunteer.message,
      createdAt: newVolunteer.createdAt
    }).catch(() => {});

    // Send confirmation email to user (fire-and-forget)
    sendUserConfirmation('volunteer', email, name).catch(() => {});

    res.status(201).json({
      success: true,
      message: "Thank you for your interest! We've received your application and will be in touch soon.",
      data: {
        id: newVolunteer._id,
        createdAt: newVolunteer.createdAt,
        status: newVolunteer.status
      }
    });

  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending application. We will review it soon!'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

// @desc    Get all volunteer applications (for admin use)
// @route   GET /api/volunteers
// @access  Public (you might want to add admin auth later)
export const getAllVolunteers = async (req, res) => {
  try {
    const { status, skill, limit = 50, page = 1 } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (skill) filter.skills = skill;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const volunteers = await Volunteer.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Volunteer.countDocuments(filter);

    res.json({
      success: true,
      count: volunteers.length,
      total,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      },
      data: volunteers
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get volunteer statistics
// @route   GET /api/volunteers/stats
// @access  Public
export const getVolunteerStats = async (req, res) => {
  try {
    const total = await Volunteer.countDocuments();
    const pending = await Volunteer.countDocuments({ status: 'pending' });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Volunteer.countDocuments({
      createdAt: { $gte: today }
    });

    // Skills breakdown
    const skillsCounts = await Volunteer.aggregate([
      { $unwind: '$skills' },
      { $group: { _id: '$skills', count: { $sum: 1 } } }
    ]);

    // Status breakdown
    const statusCounts = await Volunteer.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Time availability breakdown
    const timeCounts = await Volunteer.aggregate([
      { $group: { _id: '$timeAvailability', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        today: todayCount,
        bySkill: skillsCounts.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        byStatus: statusCounts.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        byTimeAvailability: timeCounts.reduce((acc, curr) => {
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

// @desc    Update volunteer application status (for admin)
// @route   PUT /api/volunteers/:id
// @access  Public (you might want to add admin auth later)
export const updateVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, responseSent } = req.body;

    const volunteer = await Volunteer.findByIdAndUpdate(
      id,
      { 
        ...(status && { status }),
        ...(adminNotes !== undefined && { adminNotes }),
        ...(responseSent !== undefined && { responseSent })
      },
      { new: true, runValidators: true }
    );

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer application not found'
      });
    }

    res.json({
      success: true,
      message: 'Volunteer application updated successfully',
      data: volunteer
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete a volunteer application (for admin)
// @route   DELETE /api/volunteers/:id
// @access  Public (you might want to add admin auth later)
export const deleteVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const volunteer = await Volunteer.findByIdAndDelete(id);
    
    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer application not found'
      });
    }

    res.json({
      success: true,
      message: 'Volunteer application deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  };
};
