const nodemailer = require('nodemailer');

let transporter = null;

function getTransport() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendLeadAlert(lead) {
  const t = getTransport();
  const to = process.env.NOTIFY_EMAIL;
  if (!t || !to) return false;
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  const ph = String(lead.phone).replace(/[^\d+]/g, '');
  const rows = [
    ['Name', lead.name],
    ['Phone', lead.phone],
    ['Email', lead.email],
    ['Pickup', [lead.pickup_date, lead.pickup_time].filter(Boolean).join(', ')],
    ['How many', lead.quantity],
    ['Flavors', lead.flavors],
    ['What it’s for', lead.occasion],
    ['Notes', lead.details],
  ].filter((r) => r[1]);
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:560px">` +
    `<div style="background:#EE5F7E;color:#1F1108;padding:14px 18px;font-weight:bold;font-size:17px">New box request</div>` +
    `<table cellpadding="6" style="border-collapse:collapse;font-size:15px;margin-top:10px">` +
    rows.map((r) => `<tr><td style="color:#666;vertical-align:top"><b>${esc(r[0])}</b></td><td style="white-space:pre-wrap">${esc(r[1])}</td></tr>`).join('') +
    `</table>` +
    `<p style="margin:18px 0 6px"><a href="tel:${esc(ph)}" style="background:#1F1108;color:#fff;padding:10px 16px;text-decoration:none;font-weight:bold;border-radius:6px">Call ${esc(lead.name)}</a></p>` +
    (site ? `<p><a href="${esc(site)}/admin">Open the dashboard</a></p>` : '') +
    `</div>`;
  const text = rows.map((r) => `${r[0]}: ${r[1]}`).join('\n') + (site ? `\n\nDashboard: ${site}/admin` : '');
  await t.sendMail({
    from: `"Donut Things Café Website" <${process.env.SMTP_USER}>`,
    to,
    replyTo: lead.email || undefined,
    subject: `New box request: ${lead.name}${lead.pickup_date ? ' for ' + lead.pickup_date : ''}`,
    text,
    html,
  });
  return true;
}

async function sendAutoReply(lead) {
  const t = getTransport();
  if (!t || !lead.email) return false;
  await t.sendMail({
    from: `"Donut Things Café" <${process.env.SMTP_USER}>`,
    to: lead.email,
    replyTo: process.env.NOTIFY_EMAIL || undefined,
    subject: 'We got your box request',
    text:
      `Hi ${lead.name},\n\nWe got your request and will call or text you to confirm your flavors and total. Your box isn't reserved until you hear from us.\n\n` +
      `Questions? Call (207) 591-7112.\n\nDonut Things Café\n113 Saco Street, Westbrook, ME`,
  });
  return true;
}

module.exports = { sendLeadAlert, sendAutoReply };
