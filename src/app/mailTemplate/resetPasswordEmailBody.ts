export const resetPasswordEmailBody = (name: string, resetCode: number) => `
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
      padding: 30px;
      text-align: center;
      border-bottom: 1px solid #3d3566;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #ffffff;
      letter-spacing: 3px;
    }
    .content {
      padding: 40px;
      color: #e0e0e0;
    }
    .content h2 {
      color: #ffffff;
      font-size: 22px;
      margin-top: 0;
    }
    .reset-code {
      font-size: 40px;
      color: #9d50ff;
      font-weight: 800;
      text-align: center;
      margin: 30px 0;
      background: rgba(157, 80, 255, 0.1);
      padding: 20px;
      border-radius: 12px;
      border: 1px dashed #9d50ff;
      letter-spacing: 5px;
    }
    .footer {
      padding: 25px;
      font-size: 13px;
      color: #8e89a8;
      text-align: center;
      background-color: #1e1a33;
    }
    .footer a {
      color: #9d50ff;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">FLŌNX</div>
    </div>
    <div class="content">
      <h2>Forgot your password?</h2>
      <p>No worries! It happens to the best of us. Use the security code below to reset your password and get back to the bar:</p>
      
      <div class="reset-code">
        ${resetCode || 'XXXXXX'}
      </div>

      <p>Enter this code on the reset page. This code is valid for <strong>5 minutes</strong>.</p>
      <p style="font-size: 14px; color: #8e89a8;">
        If you didn't request this, you can safely ignore this email; your account remains secure.
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Flonx. Austin, Texas.</p>
      <p><a href="#">Contact Support</a> | <a href="#">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>
`;
