import sgMail from "@sendgrid/mail";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields required" });
  }

  if (!process.env.SENDGRID_API_KEY) {
    return res.status(503).json({ error: "Email service not configured" });
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: process.env.CONTACT_RECIPIENT || "leila@toasttalent.co.za",
    from: process.env.SENDGRID_FROM || "no-reply@toasttalent.co.za",
    replyTo: email,
    subject: `Contact form: ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
  };

  try {
    await sgMail.send(msg);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to send email" });
  }
}
