import { Request, Response } from 'express';
import { z } from 'zod';
import config from '../config';
import { errorLogger } from '../shared/logger';
import sendEmail from '../utilities/sendEmail';

const contactUsValidationSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(1)
      .max(100),
    email: z.string({ required_error: 'Email is required' }).email().max(200),
    phone: z.string({ required_error: 'Phone number is required' }).max(30),
    message: z
      .string({ required_error: 'Message is required' })
      .trim()
      .min(1)
      .max(5000),
  }),
});

// user input goes into an HTML email, so it must be escaped
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sendContactUsEmail = async (req: Request, res: Response) => {
  const parsed = contactUsValidationSchema.safeParse(req);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.errors[0]?.message || 'Invalid input' });
  }
  const { name, phone, email, message } = parsed.data.body;
  const recipient = config.smtp.contact_us_email || config.smtp.smtp_mail;
  if (!recipient) {
    return res.status(503).json({ error: 'Contact form is not configured' });
  }

  try {
    await sendEmail({
      email: recipient,
      subject: 'Contact Us Info',
      html: `
        <h2>New Contact Us Message</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap">${escapeHtml(message)}</p>
      `,
    });
    return res.status(200).json({ message: 'Contact email sent successfully' });
  } catch (error) {
    errorLogger.error('Contact us email failed', error);
    return res
      .status(500)
      .json({ error: 'Could not send your message, please try again later' });
  }
};

export default sendContactUsEmail;
