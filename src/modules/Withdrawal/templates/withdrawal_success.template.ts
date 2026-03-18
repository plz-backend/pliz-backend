import { getEmailLogoUrl } from '../../../utils/email_logo.util';

export interface IWithdrawalSuccessEmail {
  recipientName: string;
  amount: number;
  companyFee: number;
  vatFee: number;
  totalFees: number;
  amountToReceive: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  transferReference: string;
  begTitle: string;
  processedAt: Date;
}

export const withdrawalSuccessTemplate = (data: IWithdrawalSuccessEmail): string => {
  const formattedDate = new Date(data.processedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const logoUrl = getEmailLogoUrl('main'); // ✅ Get logo URL

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Withdrawal Successful - Pliz</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      display: block;
      margin: 0 auto 20px;
      max-width: 200px;
      height: auto;
    }
    .success-icon {
      font-size: 64px;
      margin: 20px 0;
    }
    h1 {
      color: #2c3e50;
      font-size: 24px;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #7f8c8d;
      font-size: 16px;
      margin-bottom: 30px;
    }
    .details-card {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      color: #6c757d;
      font-weight: 500;
    }
    .detail-value {
      color: #2c3e50;
      font-weight: 600;
      text-align: right;
    }
    .amount-highlight {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 8px;
      text-align: center;
      margin: 30px 0;
    }
    .amount-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    .amount-value {
      font-size: 36px;
      font-weight: bold;
    }
    .bank-details {
      background-color: #e8f5e9;
      border-left: 4px solid #4CAF50;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .reference {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .reference-code {
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: #856404;
      font-size: 16px;
    }
    .fee-breakdown {
      background-color: #fff;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .fee-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      color: #6c757d;
    }
    .total-fees {
      display: flex;
      justify-content: space-between;
      padding: 15px 0;
      border-top: 2px solid #dee2e6;
      font-weight: bold;
      color: #2c3e50;
      margin-top: 10px;
    }
    .info-box {
      background-color: #e7f3ff;
      border-left: 4px solid #2196F3;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e9ecef;
      color: #6c757d;
      font-size: 14px;
    }
    .footer-logo {
      width: 80px;
      height: auto;
      margin: 10px auto;
      opacity: 0.6;
    }
    .btn {
      display: inline-block;
      padding: 12px 30px;
      background-color: #4CAF50;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .btn:hover {
      background-color: #45a049;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        padding: 20px;
      }
      .amount-value {
        font-size: 28px;
      }
      .logo {
        max-width: 150px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <!-- ✅ Logo Image -->
      <img src="${logoUrl}" alt="Pliz" class="logo" />
      
      <div class="success-icon">✅</div>
      <h1>Withdrawal Successful!</h1>
      <p class="subtitle">Your funds are on the way</p>
    </div>

    <p>Hi ${data.recipientName},</p>
    
    <p>Great news! Your withdrawal request has been processed successfully. The funds will be transferred to your bank account shortly.</p>

    <div class="amount-highlight">
      <div class="amount-label">Amount You'll Receive</div>
      <div class="amount-value">₦${data.amountToReceive.toLocaleString()}</div>
    </div>

    <div class="bank-details">
      <h3 style="margin-top: 0; color: #2e7d32;">Transfer Destination</h3>
      <div style="margin: 10px 0;">
        <strong>Bank:</strong> ${data.bankName}
      </div>
      <div style="margin: 10px 0;">
        <strong>Account Number:</strong> ${data.accountNumber}
      </div>
      <div style="margin: 10px 0;">
        <strong>Account Name:</strong> ${data.accountName}
      </div>
    </div>

    <div class="reference">
      <strong>Transfer Reference:</strong><br>
      <span class="reference-code">${data.transferReference}</span>
      <p style="margin: 10px 0 0 0; font-size: 13px; color: #856404;">
        Keep this reference for your records. Contact support if you need assistance.
      </p>
    </div>

    <div class="details-card">
      <h3 style="margin-top: 0;">Withdrawal Details</h3>
      <div class="detail-row">
        <span class="detail-label">Request:</span>
        <span class="detail-value">${data.begTitle}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount Raised:</span>
        <span class="detail-value">₦${data.amount.toLocaleString()}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Processed At:</span>
        <span class="detail-value">${formattedDate}</span>
      </div>
    </div>

    <div class="fee-breakdown">
      <h3 style="margin-top: 0;">Fee Breakdown</h3>
      <div class="fee-item">
        <span>Company Fee (5%):</span>
        <span>- ₦${data.companyFee.toLocaleString()}</span>
      </div>
      <div class="fee-item">
        <span>VAT (7.5%):</span>
        <span>- ₦${data.vatFee.toLocaleString()}</span>
      </div>
      <div class="total-fees">
        <span>Total Fees (12.5%):</span>
        <span>- ₦${data.totalFees.toLocaleString()}</span>
      </div>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #4CAF50;">
        <div class="fee-item" style="font-size: 18px; font-weight: bold; color: #2c3e50;">
          <span>Final Amount:</span>
          <span style="color: #4CAF50;">₦${data.amountToReceive.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <div class="info-box">
      <strong>⏱️ When will I receive the money?</strong>
      <p style="margin: 10px 0 0 0;">
        The transfer typically takes 5-30 minutes to reflect in your account. 
        If you don't receive it within 1 hour, please check your bank account or contact support.
      </p>
    </div>

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL}/withdrawals" class="btn">View Withdrawal History</a>
    </div>

    <div class="footer">
      <!-- ✅ Small footer logo -->
      <img src="${logoUrl}" alt="Pliz" class="footer-logo" />
      
      <p>Thank you for using Pliz!</p>
      <p>
        Questions? Contact us at 
        <a href="mailto:support@pliz.app" style="color: #4CAF50;">support@pliz.app</a>
      </p>
      <p style="margin-top: 20px; font-size: 12px; color: #adb5bd;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
  `;
};