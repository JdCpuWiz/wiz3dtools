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

export async function sendShippingEmail(
  customer: Customer,
  invoiceNumber: string,
  carrier: string | null,
  trackingNumber: string | null,
): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const companyName = process.env.COMPANY_NAME || 'Wiz3D Prints';
  const ordersEmail = 'orders@wiz3dprints.com';

  if (!from || !process.env.SMTP_USER) {
    throw new Error('SMTP credentials not configured. Set SMTP_USER, SMTP_PASS, and SMTP_FROM in .env');
  }

  // Customer Pickup — skip notification if no email, otherwise send pickup-ready email
  if (carrier === 'Customer Pickup') {
    if (!customer.email) return;
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${companyName}" <${from}>`,
      to: customer.email,
      cc: ordersEmail,
      subject: `Your order ${invoiceNumber} is ready for pickup!`,
      text: `Hi ${customer.contactName},\n\nGreat news — your order (${invoiceNumber}) is ready for pickup!\n\nPlease contact us to arrange a convenient time.\n\nThank you for your business!\n\n${companyName}`,
      html: `<p>Hi ${customer.contactName},</p><p>Great news — your order (<strong>${invoiceNumber}</strong>) is ready for pickup!</p><p>Please contact us to arrange a convenient time.</p><p>Thank you for your business!</p><p>${companyName}</p>`,
    });
    return;
  }

  if (!customer.email) {
    throw new Error(`Customer "${customer.contactName}" has no email address`);
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"${companyName}" <${from}>`,
    to: customer.email,
    cc: ordersEmail,
    subject: `Your order ${invoiceNumber} has shipped!`,
    text: `Hi ${customer.contactName},\n\nGreat news — your order (${invoiceNumber}) has shipped!\n\nTracking Number: ${trackingNumber}\n\nThank you for your business!\n\n${companyName}`,
    html: `<p>Hi ${customer.contactName},</p><p>Great news — your order (<strong>${invoiceNumber}</strong>) has shipped!</p><p><strong>Tracking Number:</strong> ${trackingNumber}</p><p>Thank you for your business!</p><p>${companyName}</p>`,
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
