import nodemailer from 'nodemailer';

// Create email transporter
const createTransporter = () => {
  // Check if SendGrid API key is available
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }
  
  // Fallback to Gmail SMTP
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  
  // Fallback to custom SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // No email configured
  return null;
};

const transporter = createTransporter();

// Check if email is configured
export const isEmailConfigured = () => {
  return transporter !== null;
};

// Send email helper
const sendEmail = async (options) => {
  if (!transporter) {
    console.log('Email not configured. Skipping email send.');
    console.log('To enable emails, set up environment variables in backend/.env');
    return null;
  }
  
  try {
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.GMAIL_USER || process.env.SMTP_USER || 'noreply@sup.com',
      ...options,
    });
    // Email sent successfully - don't log details
    return info;
  } catch (error) {
    // Don't log email errors - silently fail so submission still works
    return null;
  }
};

// Send suggestion notification to admin
export const sendSuggestionNotification = async (suggestionData) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
  
  if (!adminEmail) {
    console.log('No admin email configured. Skipping notification.');
    return;
  }
  
  const { isAnonymous, name, email, suggestion, createdAt } = suggestionData;
  
  const subject = isAnonymous 
    ? '📝 New Anonymous Suggestion for Sup!'
    : `📝 New Suggestion from ${name}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Suggestion</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0; }
        .logo { font-size: 32px; font-weight: bold; background: linear-gradient(135deg, #8b5cf6, #d946ef); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .badge-anonymous { background: #fef3c7; color: #92400e; }
        .badge-identified { background: #dbeafe; color: #1e40af; }
        .field { margin-bottom: 20px; }
        .field-label { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .field-value { font-size: 16px; color: #111; }
        .suggestion-box { background: #f9fafb; border-left: 4px solid #8b5cf6; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
        .suggestion-text { font-size: 16px; line-height: 1.8; color: #374151; white-space: pre-wrap; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; }
        .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #8b5cf6, #d946ef); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Sup!</div>
          <p style="color: #6b7280; margin-top: 10px;">New Suggestion Received</p>
        </div>
        
        <div style="text-align: center; margin-bottom: 20px;">
          <span class="badge ${isAnonymous ? 'badge-anonymous' : 'badge-identified'}">
            ${isAnonymous ? '🔒 Anonymous' : '👤 Identified'}
          </span>
        </div>
        
        ${!isAnonymous ? `
        <div class="field">
          <div class="field-label">From</div>
          <div class="field-value">${name} (${email})</div>
        </div>
        ` : ''}
        
        <div class="field">
          <div class="field-label">Received At</div>
          <div class="field-value">${new Date(createdAt).toLocaleString()}</div>
        </div>
        
        <div class="field">
          <div class="field-label">Suggestion</div>
          <div class="suggestion-box">
            <div class="suggestion-text">${suggestion}</div>
          </div>
        </div>
        
        <div style="text-align: center;">
          <a href="${process.env.ADMIN_PANEL_URL || '#'}/suggestions" class="button">View in Admin Panel</a>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from Sup!</p>
          <p style="font-size: 12px; margin-top: 10px;">
            ${isAnonymous 
              ? 'This suggestion was submitted anonymously.' 
              : `You can reply directly to ${email} if you'd like to follow up.`}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
New Suggestion for Sup!

${isAnonymous ? 'Anonymous Submission' : `From: ${name} (${email})`}
Received: ${new Date(createdAt).toLocaleString()}

SUGGESTION:
${suggestion}

---
This is an automated notification from Sup!
  `;
  
  await sendEmail({
    to: adminEmail,
    subject,
    text,
    html,
  });
};

// Send volunteer application notification to admin
export const sendVolunteerNotification = async (volunteerData) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
    
    if (!adminEmail) {
      console.log('No admin email configured. Skipping notification.');
      return;
    }
    
    const { name, email, skills, timeAvailability, message, createdAt } = volunteerData;
    
    const skillLabels = {
      development: '💻 Development',
      design: '🎨 Design',
      marketing: '📢 Marketing',
      community: '👥 Community',
      product: '💡 Product'
    };
    
    const timeLabels = {
      '5-10': '5-10 hours/week',
      '10-20': '10-20 hours/week',
      '20+': '20+ hours/week',
      'flexible': 'Flexible / As needed'
    };
    
    const subject = `🤝 New Volunteer Application from ${name}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Volunteer Application</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
          .container { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0; }
          .logo { font-size: 32px; font-weight: bold; background: linear-gradient(135deg, #8b5cf6, #d946ef); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: #d1fae5; color: #065f46; }
          .field { margin-bottom: 20px; }
          .field-label { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
          .field-value { font-size: 16px; color: #111; }
          .skills-container { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px; }
          .skill-tag { display: inline-block; padding: 6px 12px; background: #f3e8ff; color: #7c3aed; border-radius: 20px; font-size: 13px; font-weight: 500; }
          .message-box { background: #f9fafb; border-left: 4px solid #ec4899; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
          .message-text { font-size: 16px; line-height: 1.8; color: #374151; white-space: pre-wrap; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; }
          .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
          .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Sup!</div>
            <p style="color: #6b7280; margin-top: 10px;">New Volunteer Application</p>
          </div>
          
          <div style="text-align: center; margin-bottom: 20px;">
            <span class="badge">🤝 New Volunteer</span>
          </div>
          
          <div class="field">
            <div class="field-label">Name</div>
            <div class="field-value" style="font-size: 20px; font-weight: 600;">${name}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Email</div>
            <div class="field-value">
              <a href="mailto:${email}" style="color: #8b5cf6; text-decoration: none;">${email}</a>
            </div>
          </div>
          
          <div class="field">
            <div class="field-label">Skills</div>
            <div class="skills-container">
              ${skills.map(skill => `<span class="skill-tag">${skillLabels[skill] || skill}</span>`).join('')}
            </div>
          </div>
          
          <div class="field">
            <div class="field-label">Time Availability</div>
            <div class="field-value">
              <span class="highlight">${timeLabels[timeAvailability] || timeAvailability}</span>
            </div>
          </div>
          
          <div class="field">
            <div class="field-label">Applied At</div>
            <div class="field-value">${new Date(createdAt).toLocaleString()}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Why They Want to Volunteer</div>
            <div class="message-box">
              <div class="message-text">${message}</div>
            </div>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.ADMIN_PANEL_URL || '#'}/volunteers" class="button">View in Admin Panel</a>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from Sup!</p>
            <p style="font-size: 12px; margin-top: 10px;">
              You can reply directly to <a href="mailto:${email}" style="color: #8b5cf6;">${email}</a> to get in touch.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
New Volunteer Application for Sup!

APPLICANT DETAILS:
Name: ${name}
Email: ${email}
Skills: ${skills.map(s => skillLabels[s] || s).join(', ')}
Time Available: ${timeLabels[timeAvailability] || timeAvailability}
Applied: ${new Date(createdAt).toLocaleString()}

WHY THEY WANT TO VOLUNTEER:
${message}

---
This is an automated notification from Sup!
Reply to ${email} to get in touch with the applicant.
    `;
    
    await sendEmail({
      to: adminEmail,
      subject,
      text,
      html,
    });
  } catch (error) {
    // Silently fail - data is already saved to MongoDB
    console.log('Email notification failed, but data was saved successfully');
  }
};

// Send confirmation email to user (optional)
export const sendUserConfirmation = async (type, userEmail, userName) => {
  try {
    if (!transporter || !userEmail) return;
    
    const isSuggestion = type === 'suggestion';
    
    const subject = isSuggestion 
      ? '✅ We received your suggestion!'
      : '✅ We received your volunteer application!';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
          .container { background: white; border-radius: 12px; padding: 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; background: linear-gradient(135deg, #8b5cf6, #d946ef); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 20px; }
          .icon { font-size: 48px; margin-bottom: 20px; }
          h1 { color: #111; font-size: 22px; margin-bottom: 15px; }
          p { color: #6b7280; font-size: 16px; line-height: 1.6; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">Sup!</div>
          <div class="icon">${isSuggestion ? '💡' : '🤝'}</div>
          <h1>Hi ${userName || 'there'}!</h1>
          <p>
            ${isSuggestion 
              ? "Thank you for your suggestion! We've received it and will review it soon. Your feedback helps us build a better platform." 
              : "Thank you for your interest in volunteering! We've received your application and will be in touch soon."}
          </p>
          <div class="footer">
            <p>This is an automated confirmation from Sup!</p>
            <p>Questions? Reply to this email or contact us at contact@orsup.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail({
      to: userEmail,
      subject,
      html,
      text: `Hi ${userName || 'there'}!\n\n${isSuggestion 
        ? "Thank you for your suggestion! We've received it and will review it soon."
        : "Thank you for your interest in volunteering! We've received your application and will be in touch soon."}
\n\n- The Sup! Team`,
    });
  } catch (error) {
    // Silently fail - data is already saved to MongoDB
    console.log('Confirmation email failed, but data was saved successfully');
  }
};
