import { validationResult } from 'express-validator';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register new user (Signup for early access)
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req, res) => {
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

    const { fullName, username, email, password } = req.body;

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered for early access'
      });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'Username is already taken'
      });
    }

    // Create new user
    const user = await User.create({
      fullName,
      username: username.toLowerCase().replace(/@/g, ''), // Remove @ if included
      email: email.toLowerCase(),
      password
    });

    res.status(201).json({
      success: true,
      message: "You're in! We'll email you when it's ready.",
      data: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
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

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    res.json({
      success: true,
      message: 'Welcome back!',
      data: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email
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

// @desc    Google OAuth login/signup
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required'
      });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google token'
      });
    }

    const { email, name, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email not provided by Google'
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // Existing user - update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }

      return res.json({
        success: true,
        message: 'Welcome back!',
        data: {
          id: user._id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          isNewUser: false
        }
      });
    }

    // Create new user from Google data
    // Generate a unique username from email
    const emailPrefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let username = emailPrefix;
    let counter = 1;
    
    // Ensure unique username
    while (await User.findOne({ username })) {
      username = `${emailPrefix}${counter}`;
      counter++;
    }

    // Generate a random password (user won't use it, they login via Google)
    const randomPassword = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);

    user = await User.create({
      fullName: name || username,
      username,
      email: email.toLowerCase(),
      password: randomPassword,
      googleId,
      signupSource: 'google_oauth'
    });

    res.status(201).json({
      success: true,
      message: "You're in! We'll email you when it's ready.",
      data: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        isNewUser: true,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    // Don't log sensitive error details
    res.status(500).json({
      success: false,
      message: 'Google authentication failed. Please try again.'
    });
  }
};

// @desc    Check if email exists (for frontend validation)
// @route   GET /api/auth/check-email/:email
// @access  Public
export const checkEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email: email.toLowerCase() });
    
    res.json({
      success: true,
      exists: !!user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Check if username exists (for frontend validation)
// @route   GET /api/auth/check-username/:username
// @access  Public
export const checkUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ 
      username: username.toLowerCase().replace(/@/g, '') 
    });
    
    res.json({
      success: true,
      exists: !!user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all early access signups (for admin use)
// @route   GET /api/auth/signups
// @access  Public (you might want to add admin auth later)
export const getAllSignups = async (req, res) => {
  try {
    const signups = await User.find({})
      .select('-password') // Exclude password
      .sort({ createdAt: -1 }); // Newest first

    res.json({
      success: true,
      count: signups.length,
      data: signups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get signup stats
// @route   GET /api/auth/stats
// @access  Public
export const getStats = async (req, res) => {
  try {
    const totalSignups = await User.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySignups = await User.countDocuments({
      createdAt: { $gte: today }
    });

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const monthlySignups = await User.countDocuments({
      createdAt: { $gte: thisMonth }
    });

    res.json({
      success: true,
      data: {
        total: totalSignups,
        today: todaySignups,
        thisMonth: monthlySignups
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
