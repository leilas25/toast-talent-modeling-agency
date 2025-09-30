import { getIronSession } from "iron-session/edge";

export default function session(req, res) {
  return getIronSession(req, res, {
    cookieName: "admin_session",
    password: process.env.SESSION_SECRET,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production"
    }
  });
}
