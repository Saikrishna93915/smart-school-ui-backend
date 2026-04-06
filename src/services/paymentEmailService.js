// services/paymentEmailService.js - Payment Confirmation & Follow-up Email Service
import { sendEmail, sendBulkEmails } from './emailService.js';
import Student from '../models/Student.js';
import Payment from '../models/Payment.js';

/**
 * Send payment confirmation email to parent
 * Called automatically when payment is processed
 */
export const sendPaymentConfirmationEmail = async (payment) => {
  try {
    // Get student details
    const student = await Student.findById(payment.studentId)
      .populate('academic.class')
      .populate('transport.route');

    if (!student) {
      console.error('Student not found for payment:', payment._id);
      return { success: false, error: 'Student not found' };
    }

    const parentEmail = student.personal?.email || student.parentInfo?.email;
    const parentPhone = student.personal?.phone || student.parentInfo?.phone;
    const studentName = `${student.personal?.firstName || ''} ${student.personal?.lastName || ''}`;
    const className = student.academic?.class?.name || student.academic?.class || 'N/A';
    const section = student.academic?.section || 'N/A';
    const admissionNumber = student.academic?.admissionNumber || 'N/A';

    if (!parentEmail) {
      console.error('Parent email not found for student:', student._id);
      return { success: false, error: 'Parent email not found' };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 25px; border-radius: 8px 8px 0 0; text-align: center; }
          .logo { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .content { background: #f9f9f9; padding: 25px; border: 1px solid #ddd; }
          .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .details-box { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .row { display: flex; justify-content: space-between; margin: 12px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
          .label { font-weight: bold; color: #666; }
          .value { font-weight: bold; color: #28a745; }
          .amount { font-size: 28px; font-weight: bold; color: #28a745; text-align: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
          .footer { background: #333; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; margin-top: 20px; font-size: 12px; }
          .receipt-btn { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background: #28a745; color: white; padding: 10px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎓 PMC Tech School</div>
            <h1>Payment Confirmation</h1>
            <p>Fee Payment Successful</p>
          </div>
          
          <div class="content">
            <div class="success-box">
              <h2 style="margin: 0; color: #28a745;">✅ Payment Successful!</h2>
              <p style="margin: 10px 0 0 0;">Your fee payment has been received and processed successfully.</p>
            </div>

            <p>Dear Parent/Guardian,</p>
            <p>We are pleased to confirm that we have received your fee payment for <strong>${studentName}</strong>.</p>

            <div class="amount">
              ₹${payment.amount.toLocaleString('en-IN')}
            </div>

            <div class="details-box">
              <h3 style="margin-top: 0; color: #28a745;">📝 Payment Details</h3>
              <div class="row">
                <span class="label">Receipt Number:</span>
                <span class="value">${payment.receiptNumber}</span>
              </div>
              <div class="row">
                <span class="label">Payment Date:</span>
                <span class="value">${new Date(payment.transactionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div class="row">
                <span class="label">Payment Time:</span>
                <span class="value">${new Date(payment.transactionDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div class="row">
                <span class="label">Payment Method:</span>
                <span class="value" style="text-transform: capitalize;">${payment.paymentMethod}</span>
              </div>
              ${payment.paymentMethod === 'upi' && payment.upiId ? `
              <div class="row">
                <span class="label">UPI ID:</span>
                <span class="value">${payment.upiId}</span>
              </div>
              ` : ''}
              ${payment.paymentMethod === 'cheque' && payment.chequeNumber ? `
              <div class="row">
                <span class="label">Cheque Number:</span>
                <span class="value">${payment.chequeNumber}</span>
              </div>
              ` : ''}
              <div class="row">
                <span class="label">Payment Status:</span>
                <span class="value">✓ Completed</span>
              </div>
            </div>

            <div class="details-box">
              <h3 style="margin-top: 0; color: #28a745;">👨‍🎓 Student Details</h3>
              <div class="row">
                <span class="label">Student Name:</span>
                <span class="value">${studentName}</span>
              </div>
              <div class="row">
                <span class="label">Admission Number:</span>
                <span class="value">${admissionNumber}</span>
              </div>
              <div class="row">
                <span class="label">Class & Section:</span>
                <span class="value">${className} - ${section}</span>
              </div>
              <div class="row">
                <span class="label">Fee Type:</span>
                <span class="value">${payment.feeType || 'School Fee'}</span>
              </div>
              ${payment.feeCategory ? `
              <div class="row">
                <span class="label">Fee Category:</span>
                <span class="value">${payment.feeCategory}</span>
              </div>
              ` : ''}
            </div>

            ${payment.discount > 0 || payment.fine > 0 ? `
            <div class="details-box">
              <h3 style="margin-top: 0; color: #28a745;">💰 Fee Breakdown</h3>
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Base Fee Amount</td>
                    <td style="text-align: right;">₹${(payment.amount - (payment.discount || 0) + (payment.fine || 0)).toLocaleString('en-IN')}</td>
                  </tr>
                  ${payment.discount > 0 ? `
                  <tr style="color: #28a745;">
                    <td>Discount Applied</td>
                    <td style="text-align: right;">-₹${payment.discount.toLocaleString('en-IN')}</td>
                  </tr>
                  ` : ''}
                  ${payment.fine > 0 ? `
                  <tr style="color: #dc3545;">
                    <td>Late Fee</td>
                    <td style="text-align: right;">+₹${payment.fine.toLocaleString('en-IN')}</td>
                  </tr>
                  ` : ''}
                  <tr style="font-weight: bold; font-size: 16px; background: #f8f9fa;">
                    <td>Total Paid</td>
                    <td style="text-align: right; color: #28a745;">₹${payment.amount.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            ` : ''}

            <div class="details-box">
              <h3 style="margin-top: 0; color: #28a745;">📞 Contact Information</h3>
              <p><strong>School Office:</strong> ${process.env.SCHOOL_PHONE || '+91 XXXXXXXXXX'}</p>
              <p><strong>Email:</strong> ${process.env.SCHOOL_EMAIL || 'office@school.com'}</p>
              <p><strong>Office Hours:</strong> Monday - Saturday, 9:00 AM - 4:00 PM</p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <p style="color: #666; font-size: 14px;">This is a computer-generated email. Please do not reply.</p>
              <p style="color: #666; font-size: 14px;">For any queries, please contact the school office.</p>
            </div>
          </div>

          <div class="footer">
            <p><strong>PMC Tech School</strong></p>
            <p>Hosur - Krishnagiri Highways, Nallaganakothapalli, Tamil Nadu - 635 117</p>
            <p>Phone: ${process.env.SCHOOL_PHONE || '+91 XXXXXXXXXX'} | Email: ${process.env.SCHOOL_EMAIL || 'office@pmctechschool.com'}</p>
            <p>&copy; ${new Date().getFullYear()} PMC Tech School. All Rights Reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail({
      to: parentEmail,
      cc: parentPhone ? `${parentPhone}@sms.gateway.com` : undefined, // Optional SMS gateway
      subject: `✅ Payment Confirmation - ₹${payment.amount.toLocaleString('en-IN')} Received - ${studentName} (${admissionNumber})`,
      html: htmlContent
    });

    console.log(`📧 Payment confirmation email sent to ${parentEmail} for receipt ${payment.receiptNumber}`);
    return result;
  } catch (error) {
    console.error('❌ Error sending payment confirmation email:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send fee reminder/follow-up email to parent
 * For pending fee payments
 */
export const sendFeeReminderEmail = async (student, pendingFee, reminderType = 'first') => {
  try {
    const parentEmail = student.personal?.email || student.parentInfo?.email;
    const studentName = `${student.personal?.firstName || ''} ${student.personal?.lastName || ''}`;
    const className = student.academic?.class?.name || student.academic?.class || 'N/A';
    const admissionNumber = student.academic?.admissionNumber || 'N/A';

    if (!parentEmail) {
      return { success: false, error: 'Parent email not found' };
    }

    const dueDate = new Date(pendingFee.dueDate);
    const today = new Date();
    const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

    let subject = '';
    let urgencyColor = '#ffc107';
    let urgencyText = 'Reminder';
    let urgencyIcon = '⏰';

    if (reminderType === 'final') {
      subject = `🔴 URGENT: Final Notice - Pending Fee Payment`;
      urgencyColor = '#dc3545';
      urgencyText = 'Final Notice';
      urgencyIcon = '🔴';
    } else if (daysOverdue > 30) {
      subject = `⚠️ Overdue: Fee Payment Pending for ${daysOverdue} Days`;
      urgencyColor = '#dc3545';
      urgencyText = 'Overdue';
      urgencyIcon = '⚠️';
    } else if (daysOverdue > 0) {
      subject = `⏰ Reminder: Fee Payment Overdue by ${daysOverdue} Days`;
      urgencyColor = '#ffc107';
      urgencyText = 'Overdue';
      urgencyIcon = '⏰';
    } else {
      subject = `📝 Fee Payment Reminder - Due on ${dueDate.toLocaleDateString('en-IN')}`;
      urgencyColor = '#17a2b8';
      urgencyText = 'Due Soon';
      urgencyIcon = '📝';
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}cc 100%); color: white; padding: 25px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9f9f9; padding: 25px; border: 1px solid #ddd; }
          .warning-box { background: #fff3cd; border-left: 4px solid ${urgencyColor}; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .details-box { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .row { display: flex; justify-content: space-between; margin: 12px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
          .label { font-weight: bold; color: #666; }
          .value { font-weight: bold; color: ${urgencyColor}; }
          .amount { font-size: 28px; font-weight: bold; color: ${urgencyColor}; text-align: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
          .footer { background: #333; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; margin-top: 20px; font-size: 12px; }
          .pay-btn { display: inline-block; background: ${urgencyColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; }
          .timeline { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
          .timeline-item { display: flex; align-items: center; margin: 10px 0; }
          .timeline-dot { width: 12px; height: 12px; border-radius: 50%; background: ${urgencyColor}; margin-right: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="font-size: 40px; margin-bottom: 10px;">${urgencyIcon}</div>
            <h1>${urgencyText}</h1>
            <p>Fee Payment Pending</p>
          </div>
          
          <div class="content">
            <div class="warning-box">
              <h3 style="margin: 0; color: #856404;">Dear Parent/Guardian,</h3>
              <p style="margin: 10px 0 0 0;">This is a gentle reminder regarding the pending fee payment for <strong>${studentName}</strong>.</p>
            </div>

            <p>We hope this email finds you well. We would like to bring to your kind attention that the following fee payment is still pending:</p>

            <div class="amount">
              ₹${pendingFee.pendingAmount.toLocaleString('en-IN')}
            </div>

            <div class="details-box">
              <h3 style="margin-top: 0; color: ${urgencyColor};">👨‍🎓 Student Details</h3>
              <div class="row">
                <span class="label">Student Name:</span>
                <span class="value">${studentName}</span>
              </div>
              <div class="row">
                <span class="label">Admission Number:</span>
                <span class="value">${admissionNumber}</span>
              </div>
              <div class="row">
                <span class="label">Class:</span>
                <span class="value">${className}</span>
              </div>
            </div>

            <div class="details-box">
              <h3 style="margin-top: 0; color: ${urgencyColor};">💰 Fee Details</h3>
              <div class="row">
                <span class="label">Fee Type:</span>
                <span class="value">${pendingFee.feeType || 'School Fee'}</span>
              </div>
              <div class="row">
                <span class="label">Total Fee:</span>
                <span class="value">₹${pendingFee.totalFee.toLocaleString('en-IN')}</span>
              </div>
              <div class="row">
                <span class="label">Amount Paid:</span>
                <span class="value">₹${pendingFee.paidAmount.toLocaleString('en-IN')}</span>
              </div>
              <div class="row" style="background: #fff3cd;">
                <span class="label" style="color: #856404;">Pending Amount:</span>
                <span class="value">₹${pendingFee.pendingAmount.toLocaleString('en-IN')}</span>
              </div>
              <div class="row">
                <span class="label">Due Date:</span>
                <span class="value">${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              ${daysOverdue > 0 ? `
              <div class="row" style="background: #f8d7da;">
                <span class="label" style="color: #721c24;">Days Overdue:</span>
                <span class="value" style="color: #721c24;">${daysOverdue} days</span>
              </div>
              ` : ''}
            </div>

            <div class="timeline">
              <h4 style="margin-top: 0; color: ${urgencyColor};">📅 Payment Timeline</h4>
              <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div>
                  <strong>Due Date:</strong> ${dueDate.toLocaleDateString('en-IN')}
                  ${daysOverdue > 0 ? ` (${daysOverdue} days ago)` : ''}
                </div>
              </div>
              ${reminderType === 'final' ? `
              <div class="timeline-item">
                <div class="timeline-dot" style="background: #dc3545;"></div>
                <div>
                  <strong style="color: #dc3545;">Final Notice:</strong> Please pay within 7 days to avoid late fees
                </div>
              </div>
              ` : ''}
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <p style="color: #666; margin-bottom: 15px;">Please make the payment at the earliest to avoid any inconvenience.</p>
              <p style="color: #666; font-size: 14px;">If you have already made the payment, please ignore this email.</p>
            </div>

            <div class="details-box">
              <h3 style="margin-top: 0; color: ${urgencyColor};">📞 Contact Information</h3>
              <p><strong>School Office:</strong> ${process.env.SCHOOL_PHONE || '+91 XXXXXXXXXX'}</p>
              <p><strong>Email:</strong> ${process.env.SCHOOL_EMAIL || 'office@school.com'}</p>
              <p><strong>Office Hours:</strong> Monday - Saturday, 9:00 AM - 4:00 PM</p>
            </div>
          </div>

          <div class="footer">
            <p><strong>AI School ERP</strong></p>
            <p>This is an automated reminder. Please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} All Rights Reserved</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail({
      to: parentEmail,
      subject: subject,
      html: htmlContent
    });

    console.log(`📧 Fee reminder email sent to ${parentEmail} for student ${studentName}`);
    return result;
  } catch (error) {
    console.error('❌ Error sending fee reminder email:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send bulk fee reminder emails to multiple parents
 * Used by cashier for follow-up campaigns
 */
export const sendBulkFeeReminders = async (studentsWithFees, reminderType = 'first') => {
  const emails = [];

  for (const item of studentsWithFees) {
    const student = item.student;
    const pendingFee = item.pendingFee;

    const parentEmail = student.personal?.email || student.parentInfo?.email;
    const studentName = `${student.personal?.firstName || ''} ${student.personal?.lastName || ''}`;

    if (!parentEmail) continue;

    // Generate email content (reuse sendFeeReminderEmail logic)
    const dueDate = new Date(pendingFee.dueDate);
    const today = new Date();
    const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

    let subject = '';
    let urgencyColor = '#ffc107';

    if (reminderType === 'final') {
      subject = `🔴 URGENT: Final Notice - Pending Fee Payment - ${studentName}`;
      urgencyColor = '#dc3545';
    } else if (daysOverdue > 30) {
      subject = `⚠️ Overdue: Fee Payment Pending - ${studentName}`;
      urgencyColor = '#dc3545';
    } else {
      subject = `📝 Fee Payment Reminder - ${studentName}`;
      urgencyColor = '#17a2b8';
    }

    // Simplified HTML for bulk sending
    const htmlContent = `
      <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, ${urgencyColor}, ${urgencyColor}cc); color: white; padding: 20px; text-align: center;">
          <h1>Fee Payment Reminder</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <p>Dear Parent/Guardian,</p>
          <p>This is a reminder regarding the pending fee payment for <strong>${studentName}</strong>.</p>
          <div style="font-size: 24px; font-weight: bold; color: ${urgencyColor}; text-align: center; margin: 20px 0; padding: 15px; background: white;">
            ₹${pendingFee.pendingAmount.toLocaleString('en-IN')}
          </div>
          <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString('en-IN')}</p>
          <p><strong>Class:</strong> ${student.academic?.class?.name || student.academic?.class || 'N/A'}</p>
          <p style="margin-top: 20px;">Please make the payment at the earliest.</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">This is an automated email. Please do not reply.</p>
        </div>
      </body>
      </html>
    `;

    emails.push({
      to: parentEmail,
      subject: subject,
      html: htmlContent
    });
  }

  console.log(`📧 Sending ${emails.length} bulk reminder emails...`);
  
  // Send with rate limiting to avoid SMTP throttling
  const results = await sendBulkEmailsWithRateLimit(emails, 2000); // 2 second delay between emails
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`✅ Bulk email campaign completed: ${successCount} sent, ${failCount} failed`);

  return {
    total: emails.length,
    success: successCount,
    failed: failCount,
    results
  };
};
