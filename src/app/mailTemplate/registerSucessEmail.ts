export const registrationSuccessEmailBody = (
  name: string,
  activationCode: number,
) => `
<html>
<head>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #120F1D;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #2A2448;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #3d3566;
    }
    .header {
      background-color: #2A2448;
      text-align: center;
      padding: 40px 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      letter-spacing: 2px;
      color: #ffffff;
      text-transform: uppercase;
    }
    .header span {
      color: #9d50ff; /* Purple accent from 'Join Now' button */
    }
    .content {
      padding: 0 40px 40px 40px;
      color: #e0e0e0;
      text-align: center;
    }
    .content p {
      font-size: 16px;
      line-height: 1.6;
    }
    .code-box {
      margin: 30px 0;
    }
    .code {
      display: inline-block;
      padding: 16px 32px;
      font-size: 36px;
      font-weight: bold;
      color: #ffffff;
      background: linear-gradient(135deg, #8A5CFF 0%, #6E3CBC 100%);
      border-radius: 12px;
      letter-spacing: 8px;
      box-shadow: 0 4px 15px rgba(138, 92, 255, 0.3);
    }
    .footer {
      background-color: #1e1a33;
      text-align: center;
      padding: 20px;
      font-size: 13px;
      color: #8e89a8;
    }
    .footer a {
      color: #8A5CFF;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>FL<span>Ō</span>NX</h1>
    </div>
    <div class="content">
      <p style="font-size: 20px; color: #ffffff;">Cheers${name ? `, ${name}` : ''}!</p>
      <p>Your table is almost ready. Use the verification code below to activate your Flonx account and start ordering your favorite drinks.</p>
      
      <div class="code-box">
        <div class="code">${activationCode || '000000'}</div>
      </div>

      <p style="font-size: 14px; color: #8e89a8;">
        This code expires in 5 minutes.<br>
        If you didn't sign up for Flonx, please ignore this email.
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Flonx App. Austin, Texas.</p>
      <p>
        <a href="#">Privacy Policy</a> | <a href="mailto:support@flonx.com">Support</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
