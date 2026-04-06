// services/emailService.js - Email Sending Service
import nodemailer from 'nodemailer';

// Create transporter with SMTP configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @param {string} options.cc - CC recipients (optional)
 * @param {string} options.bcc - BCC recipients (optional)
 * @param {Array} options.attachments - Attachments (optional)
 */
export const sendEmail = async ({ to, subject, html, text, cc, bcc, attachments }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"AI School ERP" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for plain text
      cc,
      bcc,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send bulk emails
 * @param {Array} emails - Array of email objects {to, subject, html}
 */
export const sendBulkEmails = async (emails) => {
  const results = [];
  const transporter = createTransporter();
  
  for (const email of emails) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || `"AI School ERP" <${process.env.SMTP_USER}>`,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text || email.html.replace(/<[^>]*>/g, '')
      };

      const info = await transporter.sendMail(mailOptions);
      results.push({ 
        email: email.to, 
        success: true,
        messageId: info.messageId 
      });
      console.log('📧 Email sent to:', email.to);
    } catch (error) {
      console.error('❌ Email failed to:', email.to, error.message);
      results.push({ 
        email: email.to, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  return results;
};

/**
 * Send bulk emails with rate limiting (to avoid SMTP throttling)
 */
export const sendBulkEmailsWithRateLimit = async (emails, delayMs = 1000) => {
  const results = [];
  
  for (let i = 0; i < emails.length; i++) {
    const result = await sendEmail(emails[i]);
    results.push({
      email: emails[i].to,
      ...result
    });
    
    // Add delay between emails (except for last one)
    if (i < emails.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
};
