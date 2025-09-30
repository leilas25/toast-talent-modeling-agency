import session from "../lib/session.js";

export default async function handler(req, res) {
  await session(req, res);

  if (req.session?.isAdmin) {
    return res.status(200).json({ authenticated: true });
  }
  return res.status(401).json({ authenticated: false });
}
