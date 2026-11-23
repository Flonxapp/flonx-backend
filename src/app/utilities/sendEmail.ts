/* eslint-disable @typescript-eslint/no-explicit-any */
import nodemailer from 'nodemailer';
import config from '../config';
import { errorLogger } from '../shared/logger';

const port = parseInt((config.smtp.smtp_port as string) || '587', 10);

// one pooled transporter for the whole app
const transporter = nodemailer.createTransport({
  host: (config.smtp.smtp_host as string) || 'smtp.gmail.com',
  port,
  secure: port === 465,
  auth: {
    user: config.smtp.smtp_mail,
    pass: config.smtp.smtp_pass,
  },
});

const sendEmail = async (options: {
  email: string;
  subject: string;
  html: any;
}) => {
  const { email, subject, html } = options;
  await transporter.sendMail({
    from: `${config.smtp.name} <${config.smtp.smtp_mail}>`,
    to: email,
    subject,
    html,
  });
};

// For emails that should not block or fail the request (welcome mails,
// notifications): errors are logged instead of becoming unhandled rejections.
export const sendEmailInBackground = (
  options: Parameters<typeof sendEmail>[0],
) => {
  sendEmail(options).catch((err) =>
    errorLogger.error(`Email to ${options.email} failed`, err),
  );
};

export default sendEmail;
