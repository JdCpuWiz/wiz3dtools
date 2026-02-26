import nodemailer from 'nodemailer';
import type { Customer } from '@wizqueue/shared';

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mail.me.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendInvoiceEmail(
  customer: Customer,
  invoiceNumber: string,
  pdfBuffer: Buffer,
): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const companyName = process.env.COMPANY_NAME || 'Wiz3D Prints';

  if (!from || !process.env.SMTP_USER) {
    throw new Error('SMTP credentials not configured. Set SMTP_USER, SMTP_PASS, and SMTP_FROM in .env');
  }

  if (!customer.email) {
    throw new Error(`Customer "${customer.contactName}" has no email address`);
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"${companyName}" <${from}>`,
    to: customer.email,
    subject: `Invoice ${invoiceNumber} from ${companyName}`,
    text: `Hi ${customer.contactName},\n\nPlease find your invoice ${invoiceNumber} attached.\n\nThank you for your business!\n\n${companyName}`,
    html: `<p>Hi ${customer.contactName},</p><p>Please find your invoice <strong>${invoiceNumber}</strong> attached.</p><p>Thank you for your business!</p><p>${companyName}</p>`,
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}
