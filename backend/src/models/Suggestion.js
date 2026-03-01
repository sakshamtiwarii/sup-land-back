import mongoose from 'mongoose';

const suggestionSchema = new mongoose.Schema({
  // Anonymous or identified
  isAnonymous: {
    type: Boolean,
    default: false,
    required: true
  },
  
  // User info (optional for anonymous)
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
    // Required only if not anonymous
    required: function() {
      return !this.isAnonymous;
    }
  },
  
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    // Required only if not anonymous
    required: function() {
      return !this.isAnonymous;
    }
  },
  
  // The suggestion content (always required)
  suggestion: {
    type: String,
    required: [true, 'Suggestion is required'],
    trim: true,
    minlength: [10, 'Suggestion must be at least 10 characters'],
    maxlength: [5000, 'Suggestion cannot exceed 5000 characters']
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['new', 'reviewed', 'considered', 'implemented', 'declined'],
    default: 'new'
  },
  
  // For internal notes
  adminNotes: {
    type: String,
    default: ''
  },
  
  // Track if we've responded
  responded: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Index for faster queries
suggestionSchema.index({ createdAt: -1 }); // Newest first
suggestionSchema.index({ status: 1 });
suggestionSchema.index({ isAnonymous: 1 });

const Suggestion = mongoose.model('Suggestion', suggestionSchema);

export default Suggestion;
