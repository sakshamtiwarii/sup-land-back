import mongoose from 'mongoose';

const volunteerSchema = new mongoose.Schema({
  // Personal info
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  
  // Skills they're offering
  skills: {
    type: [String],
    required: [true, 'At least one skill is required'],
    validate: {
      validator: function(v) {
        return v.length > 0;
      },
      message: 'Please select at least one skill'
    },
    enum: {
      values: ['development', 'design', 'marketing', 'community', 'product'],
      message: '{VALUE} is not a valid skill'
    }
  },
  
  // Time availability
  timeAvailability: {
    type: String,
    required: [true, 'Time availability is required'],
    enum: {
      values: ['5-10', '10-20', '20+', 'flexible'],
      message: '{VALUE} is not a valid time availability option'
    }
  },
  
  // Their message/why they want to volunteer
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [20, 'Message must be at least 20 characters'],
    maxlength: [3000, 'Message cannot exceed 3000 characters']
  },
  
  // Application status
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'contacted', 'accepted', 'declined'],
    default: 'pending'
  },
  
  // For internal tracking
  adminNotes: {
    type: String,
    default: ''
  },
  
  // Track if we've sent a response email
  responseSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Index for faster queries
volunteerSchema.index({ createdAt: -1 }); // Newest first
volunteerSchema.index({ status: 1 });
volunteerSchema.index({ email: 1 }); // Prevent duplicates

// Prevent duplicate applications from same email
volunteerSchema.index({ email: 1, status: 1 }, { 
  unique: true, 
  partialFilterExpression: { status: { $in: ['pending', 'reviewed', 'contacted'] } }
});

const Volunteer = mongoose.model('Volunteer', volunteerSchema);

export default Volunteer;
