import session from "../lib/session.js";

export default async function handler(req, res) {
  await session(req, res);
  req.session.destroy();
  return res.status(200).json({ success: true });
}
