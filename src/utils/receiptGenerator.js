import { convertToWords } from "./numberToWords.js";

export const generateReceiptHTML = (payment, receipt) => {
  const { schoolDetails, studentDetails, paymentDetails, amountDetails, feesBreakdown } = receipt;

  // Get logo URL if available
 const logoUrl = schoolDetails.logo || schoolDetails.logoUrl || '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt ${receipt.receiptNumber}</title>
      <style>
        @page {
          size: A4;
          margin: 10mm;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 10px; background: #fff; }
        .receipt-container { max-width: 800px; margin: 0 auto; }
        .receipt { background: white; border: 2px solid #000; padding: 15px; page-break-inside: avoid; }
        
        .header { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px; }
        .school-logo { max-width: 60px; max-height: 60px; margin: 0 auto 8px; display: block; }
        .school-name { font-size: 20px; font-weight: 700; margin-bottom: 5px; color: #2c3e50; }
        .school-info { font-size: 10px; line-height: 1.3; color: #6b7280; }
        
        .receipt-title { font-size: 16px; text-align: center; margin: 10px 0; font-weight: 700; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 8px 0; }
        
        .section { margin: 10px 0; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; background: #f9fafb; }
        .section-title { font-weight: 600; margin-bottom: 8px; color: #2c3e50; font-size: 11px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .detail-item { margin: 4px 0; font-size: 10px; }
        .detail-label { font-weight: 600; color: #2c3e50; display: inline-block; }
        
        .amount-section { border: 2px solid #d1d5db; border-radius: 6px; padding: 10px; margin: 10px 0; background: #f9fafb; }
        .amount-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
        .amount-item { text-align: center; font-size: 10px; }
        .amount-label { color: #6b7280; margin-bottom: 3px; }
        .amount-value { font-weight: 600; color: #2c3e50; }
        
        .total-amount { border-top: 2px solid #d1d5db; padding-top: 10px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; }
        .total-label { font-size: 12px; font-weight: 700; }
        .total-value { font-size: 16px; font-weight: 700; color: #059669; }
        
        .amount-words { font-style: italic; margin: 10px 0; padding: 8px; background: #f3f4f6; border-left: 3px solid #3b82f6; font-size: 9px; }
        
        .footer-section { border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 10px; font-size: 9px; display: flex; justify-content: space-between; align-items: start; }
        .signature-text { font-size: 10px; margin-top: 25px; }
        .disclaimer-text { font-size: 8px; color: #6b7280; margin-top: 8px; }
        .footer-info { text-align: center; margin-top: 8px; font-size: 8px; color: #6b7280; }
        
        @media print {
          body { margin: 0; background: white; padding: 0; }
          .no-print { display: none !important; }
          .receipt { border: 2px solid #000; box-shadow: none; padding: 15px; }
        }
        @media screen {
          body { background: #f5f5f5; padding: 20px; }
          .receipt { box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="receipt">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="School Logo" class="school-logo" onerror="this.style.display='none'" />` : ''}
            <div class="school-name">${schoolDetails.name}</div>
            <div class="school-info">
              ${schoolDetails.address}<br/>
              Phone: ${schoolDetails.phone} | Email: ${schoolDetails.email}
            </div>
          </div>
          
          <div class="receipt-title">Fee Payment Receipt</div>
          
          <div class="section">
            <div class="section-title">Receipt Information</div>
            <div class="details-grid">
              <div class="detail-item"><span class="detail-label">Receipt No:</span> ${receipt.receiptNumber}</div>
              <div class="detail-item"><span class="detail-label">Date:</span> ${new Date(paymentDetails.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              <div class="detail-item"><span class="detail-label">Time:</span> ${new Date(paymentDetails.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Student Information</div>
            <div class="details-grid">
              <div class="detail-item"><span class="detail-label">Student Name:</span> ${studentDetails.name}</div>
              <div class="detail-item"><span class="detail-label">Admission No:</span> ${studentDetails.admissionNumber}</div>
              <div class="detail-item"><span class="detail-label">Class:</span> ${studentDetails.className} ${studentDetails.section ? `• ${studentDetails.section}` : ''}</div>
              <div class="detail-item"><span class="detail-label">Roll No:</span> N/A</div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Payment Information</div>
            <div class="details-grid">
              <div class="detail-item"><span class="detail-label">Payment Method:</span> ${paymentDetails.method}</div>
              <div class="detail-item"><span class="detail-label">Description:</span> ${feesBreakdown.length > 0 ? `Payment for ${feesBreakdown.length} due payment(s)` : 'Fee Payment'}</div>
              <div class="detail-item" style="grid-column: span 2;"><span class="detail-label">Status:</span> COMPLETED</div>
            </div>
          </div>
          
          <div class="amount-section">
            <div class="amount-grid">
              <div class="amount-item">
                <div class="amount-label">Amount</div>
                <div class="amount-value">₹${amountDetails.totalAmount.toLocaleString('en-IN')}</div>
              </div>
              <div class="amount-item">
                <div class="amount-label">Discount</div>
                <div class="amount-value">₹${amountDetails.discount.toLocaleString('en-IN')}</div>
              </div>
              <div class="amount-item">
                <div class="amount-label">Late Fee</div>
                <div class="amount-value">₹${amountDetails.lateFee.toLocaleString('en-IN')}</div>
              </div>
              <div class="amount-item">
                <div class="amount-label">Net Amount</div>
                <div class="amount-value" style="color: #059669;">₹${amountDetails.netAmount.toLocaleString('en-IN')}</div>
              </div>
            </div>
            <div class="total-amount">
              <span class="total-label">Amount Paid:</span>
              <span class="total-value">₹${amountDetails.netAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
          
          <div class="footer-section">
            <div>
              <div class="detail-label">Collected By:</div>
              <div style="font-size: 10px; margin-top: 2px;">${paymentDetails.collectedBy || 'System'}</div>
            </div>
            <div style="text-align: right;">
              <div class="signature-text" style="font-weight: 600;">Authorized Signature</div>
              <div class="disclaimer-text">
                This is a computer generated receipt. No signature required.
              </div>
            </div>
          </div>
          
          <div class="footer-info">
            ${schoolDetails.name} | ${schoolDetails.address}
          </div>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <button onclick="window.print()" style="padding: 12px 30px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin: 10px; font-weight: 600;">
            🖨️ Print Receipt
          </button>
          <button onclick="window.close()" style="padding: 12px 30px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin: 10px; font-weight: 600;">
            ✖️ Close
          </button>
        </div>
      </div>
      
      <script>
        window.onload = function() {
          // Auto-print if needed
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('print') === 'true') {
            setTimeout(() => {
              window.print();
            }, 500);
          }
        };
      </script>
    </body>
    </html>
  `;
};

// Generate receipt number function
export const generateReceiptNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `REC-${year}${month}${day}-${random}`;
};