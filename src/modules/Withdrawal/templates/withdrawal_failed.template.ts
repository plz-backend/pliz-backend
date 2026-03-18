import { getEmailLogoUrl } from '../../../utils/email_logo.util';

export interface IWithdrawalFailedEmail {
  recipientName: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  failureReason: string;
  begTitle: string;
  supportEmail: string;
}

export const withdrawalFailedTemplate = (data: IWithdrawalFailedEmail): string => {
  const logoUrl = getEmailLogoUrl('main'); // ✅ Get logo URL

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Withdrawal Failed - Pliz</title>
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
    .error-icon {
      font-size: 64px;
      margin: 20px 0;
    }
    h1 {
      color: #d32f2f;
      font-size: 24px;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #7f8c8d;
      font-size: 16px;
      margin-bottom: 30px;
    }
    .error-box {
      background-color: #ffebee;
      border-left: 4px solid #d32f2f;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
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
    .action-steps {
      background-color: #e3f2fd;
      border-left: 4px solid #2196F3;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .action-steps ol {
      margin: 10px 0;
      padding-left: 20px;
    }
    .action-steps li {
      margin: 8px 0;
    }
    .btn {
      display: inline-block;
      padding: 12px 30px;
      background-color: #2196F3;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
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
    @media only screen and (max-width: 600px) {
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
      
      <div class="error-icon">❌</div>
      <h1>Withdrawal Failed</h1>
      <p class="subtitle">There was an issue processing your withdrawal</p>
    </div>

    <p>Hi ${data.recipientName},</p>
    
    <p>We're sorry, but your withdrawal request could not be processed at this time.</p>

    <div class="error-box">
      <strong style="color: #d32f2f;">Failure Reason:</strong>
      <p style="margin: 10px 0 0 0; color: #c62828;">
        ${data.failureReason}
      </p>
    </div>

    <div class="details-card">
      <h3 style="margin-top: 0;">Withdrawal Details</h3>
      <div class="detail-row">
        <span>Request:</span>
        <span><strong>${data.begTitle}</strong></span>
      </div>
      <div class="detail-row">
        <span>Amount:</span>
        <span><strong>₦${data.amount.toLocaleString()}</strong></span>
      </div>
      <div class="detail-row">
        <span>Bank:</span>
        <span><strong>${data.bankName}</strong></span>
      </div>
      <div class="detail-row">
        <span>Account:</span>
        <span><strong>${data.accountNumber}</strong></span>
      </div>
    </div>

    <div class="action-steps">
      <strong style="color: #1976d2;">📋 What to do next:</strong>
      <ol>
        <li>Verify your bank account details are correct</li>
        <li>Ensure your account can receive transfers</li>
        <li>Try submitting a new withdrawal request</li>
        <li>Contact our support team if the issue persists</li>
      </ol>
    </div>

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL}/withdrawals/request" class="btn">Try Again</a>
    </div>

    <p style="text-align: center; margin-top: 30px;">
      <strong>Need Help?</strong><br>
      Contact our support team at 
      <a href="mailto:${data.supportEmail}" style="color: #2196F3;">${data.supportEmail}</a>
    </p>

    <div class="footer">
      <!-- ✅ Small footer logo -->
      <img src="${logoUrl}" alt="Pliz" class="footer-logo" />
      
      <p>Thank you for your patience.</p>
      <p style="margin-top: 20px; font-size: 12px; color: #adb5bd;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
  `;
};