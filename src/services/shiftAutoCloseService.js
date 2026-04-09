// services/shiftAutoCloseService.js - Automatic Shift Closing Service
import cron from 'node-cron';
import ShiftSession from '../models/ShiftSession.js';
import Cashier from '../models/Cashier.js';
import Payment from '../models/Payment.js';
import { sendEmail } from './emailService.js';

/**
 * Auto-close all open shifts at 6:00 PM daily
 */
export const startShiftAutoCloseScheduler = () => {
  // Schedule job to run every day at 6:00 PM IST
  // 6:00 PM IST = 12:30 PM UTC, but with timezone option we use local IST time
  cron.schedule('0 18 * * *', async () => {
    console.log('⏰ Running automatic shift closing at 6:00 PM IST...');
    await autoCloseAllOpenShifts();
  }, {
    timezone: 'Asia/Kolkata'
  });

  console.log('✅ Shift auto-close scheduler started (Daily at 6:00 PM IST)');
};

/**
 * Auto-close all open shifts
 */
const autoCloseAllOpenShifts = async () => {
  try {
    // Find all open shifts
    const openShifts = await ShiftSession.find({ status: 'open' })
      .populate('cashier', 'firstName lastName email employeeId')
      .populate('openedBy', 'email name');

    console.log(`📊 Found ${openShifts.length} open shifts to close`);

    for (const shift of openShifts) {
      try {
        // Calculate totals from payments
        const payments = await Payment.find({ 
          shiftId: shift._id,
          status: 'completed'
        });

        const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const cashAmount = payments
          .filter(p => p.paymentMethod === 'cash')
          .reduce((sum, p) => sum + p.amount, 0);
        const onlineAmount = payments
          .filter(p => p.paymentMethod === 'online')
          .reduce((sum, p) => sum + p.amount, 0);
        const upiAmount = payments
          .filter(p => p.paymentMethod === 'upi')
          .reduce((sum, p) => sum + p.amount, 0);
        const chequeAmount = payments
          .filter(p => ['cheque', 'dd'].includes(p.paymentMethod))
          .reduce((sum, p) => sum + p.amount, 0);
        const cardAmount = payments
          .filter(p => p.paymentMethod === 'card')
          .reduce((sum, p) => sum + p.amount, 0);
        const bankTransferAmount = payments
          .filter(p => p.paymentMethod === 'bank-transfer')
          .reduce((sum, p) => sum + p.amount, 0);

        // Update shift with final totals
        shift.closingTime = new Date();
        shift.closingBalance = totalAmount;
        shift.cashInHand = cashAmount;
        // CRITICAL: Variance = expected cash - actual cash (not total vs cash)
        // For auto-close, we assume cash in hand = cash collected (no physical count)
        shift.variance = 0; // Auto-close assumes no variance (cashier didn't report actual count)
        shift.status = 'closed';
        shift.notes = shift.notes
          ? `${shift.notes}\n\n[Auto-closed at 6:00 PM IST by system. Variance set to 0 - physical cash count not provided.]`
          : '[Auto-closed at 6:00 PM IST by system. Variance set to 0 - physical cash count not provided.]';

        shift.transactions = {
          count: payments.length,
          totalAmount: totalAmount,
          cash: cashAmount,
          online: onlineAmount,
          upi: upiAmount,
          cheque: chequeAmount,
          card: cardAmount,
          bankTransfer: bankTransferAmount
        };

        await shift.save();

        console.log(`✅ Auto-closed shift ${shift._id} for cashier ${shift.cashier?.email}`);

        // Send email notification to cashier
        if (shift.cashier?.email) {
          await sendShiftCloseEmail(shift, payments);
        }

        // CRITICAL FIX: Send admin notification if variance is significant
        const varianceThreshold = 500; // Notify admin if variance > ₹500
        if (Math.abs(variance) > varianceThreshold) {
          await sendAdminVarianceNotification(shift, payments, variance);
        }
      } catch (error) {
        console.error(`❌ Error closing shift ${shift._id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Error in auto-close shifts:', error.message);
  }
};

/**
 * Send shift closure email to cashier
 */
const sendShiftCloseEmail = async (shift, payments) => {
  try {
    const cashierEmail = shift.cashier.email;
    const cashierName = `${shift.cashier.firstName} ${shift.cashier.lastName}`;
    const employeeId = shift.cashier.employeeId;

    // Calculate summary
    const totalAmount = shift.transactions.totalAmount;
    const cashAmount = shift.transactions.cash;
    const onlineAmount = shift.transactions.online;
    const chequeAmount = shift.transactions.cheque;
    const transactionCount = shift.transactions.count;
    const variance = shift.variance;

    // Top 5 students who paid today
    const topPayments = payments
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((p, i) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${i + 1}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${p.studentId?.personal?.firstName || 'N/A'}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">₹${p.amount.toLocaleString('en-IN')}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${p.paymentMethod}</td>
        </tr>
      `)
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .summary-box { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .stat-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 4px; }
          .stat-label { font-weight: bold; color: #666; }
          .stat-value { font-size: 18px; font-weight: bold; color: #667eea; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
          .success { background: #d4edda; border-left: 4px solid #28a745; padding: 10px; margin: 15px 0; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background: #667eea; color: white; padding: 10px; text-align: left; }
          .footer { background: #333; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Shift Auto-Closed</h1>
            <p>Daily Shift Summary - ${new Date(shift.shiftDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <div class="content">
            <p>Dear ${cashierName},</p>
            <p>Your shift has been automatically closed at <strong>6:00 PM</strong> as per the daily schedule.</p>
            
            <div class="summary-box">
              <h3>📊 Shift Summary</h3>
              <div class="stat-row">
                <span class="stat-label">Employee ID:</span>
                <span class="stat-value">${employeeId}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Shift Date:</span>
                <span class="stat-value">${new Date(shift.shiftDate).toLocaleDateString('en-IN')}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Opening Time:</span>
                <span class="stat-value">${new Date(shift.openingTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Closing Time:</span>
                <span class="stat-value">${new Date(shift.closingTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div class="summary-box">
              <h3>💰 Collection Summary</h3>
              <div class="stat-row">
                <span class="stat-label">Total Transactions:</span>
                <span class="stat-value">${transactionCount}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Total Collection:</span>
                <span class="stat-value">₹${totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Cash:</span>
                <span class="stat-value">₹${cashAmount.toLocaleString('en-IN')}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Online/UPI:</span>
                <span class="stat-value">₹${onlineAmount.toLocaleString('en-IN')}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Cheque/DD:</span>
                <span class="stat-value">₹${chequeAmount.toLocaleString('en-IN')}</span>
              </div>
              ${variance !== 0 ? `
              <div class="stat-row" style="${variance < 0 ? 'background: #ffe6e6;' : 'background: #e6ffe6;'}">
                <span class="stat-label">Variance:</span>
                <span class="stat-value" style="color: ${variance < 0 ? '#dc3545' : '#28a745'}">
                  ${variance < 0 ? '₹' + Math.abs(variance).toLocaleString('en-IN') + ' (Shortage)' : '₹' + variance.toLocaleString('en-IN') + ' (Excess)'}
                </span>
              </div>
              ` : ''}
            </div>

            ${variance < 0 ? `
            <div class="warning">
              <strong>⚠️ Action Required:</strong> There is a cash shortage of ₹${Math.abs(variance).toLocaleString('en-IN')}. 
              Please reconcile and submit an explanation to the accounts department.
            </div>
            ` : variance > 0 ? `
            <div class="success">
              <strong>✅ Good Job!</strong> There is an excess of ₹${variance.toLocaleString('en-IN')}. 
              Please deposit this with the accounts department.
            </div>
            ` : `
            <div class="success">
              <strong>✅ Perfect Balance!</strong> Your cash handling is accurate.
            </div>
            `}

            <div class="summary-box">
              <h3>🏆 Top 5 Payments Today</h3>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Amount</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  ${topPayments || '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #999;">No payments recorded today</td></tr>'}
                </tbody>
              </table>
            </div>

            <p style="margin-top: 20px;"><strong>📝 Important Notes:</strong></p>
            <ul>
              <li>Please count your physical cash and match it with the cash amount shown above.</li>
              <li>Submit the cash deposit slip to the accounts department by 10:00 AM tomorrow.</li>
              <li>If there are any discrepancies, please report them immediately.</li>
              <li>Remember to open your shift on time tomorrow morning.</li>
            </ul>

            <p style="margin-top: 20px;">Thank you for your hard work today!</p>
            <p><strong>Best Regards,</strong><br>
            <strong>PMC Tech School Administration</strong></p>
          </div>

          <div class="footer">
            <p>This is an automated message. Please do not reply.</p>
            <p>PMC Tech School | Hosur - Krishnagiri Highways, Tamil Nadu - 635 117</p>
            <p>&copy; ${new Date().getFullYear()} PMC Tech School. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    await sendEmail({
      to: cashierEmail,
      subject: `🔔 Shift Auto-Closed - ${new Date(shift.shiftDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} - ₹${totalAmount.toLocaleString('en-IN')} Collected`,
      html: htmlContent
    });

    console.log(`📧 Email sent to ${cashierEmail} for shift closure`);
  } catch (error) {
    console.error('❌ Error sending shift close email:', error.message);
  }
};

/**
 * Send admin notification when shift variance is significant
 */
export const sendAdminVarianceNotification = async (shift, payments, variance) => {
  try {
    // Import dynamically to avoid circular dependency
    const { sendEmail } = await import('./emailService.js');
    const User = (await import('../models/User.js')).default;

    // Find all admin/owner users
    const adminUsers = await User.find({
      role: { $in: ['admin', 'owner'] },
      active: true
    }).select('email name');

    if (adminUsers.length === 0) {
      console.log('⚠️ No admin users found for variance notification');
      return;
    }

    const varianceType = variance > 0 ? 'SHORTAGE' : 'EXCESS';
    const varianceAmount = Math.abs(variance);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ Shift Variance Alert</h2>
        <p><strong>Cashier:</strong> ${shift.cashier?.email || 'Unknown'}</p>
        <p><strong>Shift Date:</strong> ${new Date(shift.shiftDate).toLocaleDateString('en-IN')}</p>
        <p><strong>Variance Type:</strong> <span style="color: #dc2626; font-weight: bold;">${varianceType}</span></p>
        <p><strong>Variance Amount:</strong> <span style="color: #dc2626; font-weight: bold; font-size: 18px;">₹${varianceAmount.toLocaleString('en-IN')}</span></p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <h3>Shift Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Collected</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₹${shift.transactions.totalAmount.toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Cash</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₹${shift.transactions.cash.toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Online/UPI</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₹${(shift.transactions.online + shift.transactions.upi).toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Cheque/DD</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₹${shift.transactions.cheque.toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Transactions</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${shift.transactions.count}</td></tr>
        </table>
        <p style="margin-top: 20px; color: #666;">This is an automated notification. Please review the shift details in the admin dashboard.</p>
      </div>
    `;

    // Send to each admin
    for (const admin of adminUsers) {
      if (admin.email) {
        await sendEmail({
          to: admin.email,
          subject: `⚠️ Shift Variance Alert - ${varianceType} ₹${varianceAmount.toLocaleString('en-IN')}`,
          html
        });
        console.log(`✅ Admin variance notification sent to ${admin.email}`);
      }
    }
  } catch (error) {
    console.error('❌ Error sending admin variance notification:', error.message);
  }
};

/**
 * Manual trigger for testing
 */
export const triggerManualAutoClose = async (req, res) => {
  try {
    await autoCloseAllOpenShifts();
    res.json({
      success: true,
      message: 'Auto-close process completed. Check logs for details.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
