import session from "../lib/session.js";

export default async function handler(req, res) {
  await session(req, res);

  if (req.method === "POST") {
    const { password } = req.body;

    if (password === process.env.ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      await req.session.save();
      return res.status(200).json({ success: true });
    }

    return res.status(401).json({ error: "Incorrect password" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
