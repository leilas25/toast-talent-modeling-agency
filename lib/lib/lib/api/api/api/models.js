import dbConnect from "../lib/db.js";
import session from "../lib/session.js";
import Model from "../lib/model.js";

export default async function handler(req, res) {
  await dbConnect();
  await session(req, res);

  if (req.method === "GET") {
    const models = await Model.find().sort({ name: 1 });
    return res.json(models);
  }

  if (req.method === "POST") {
    if (!req.session?.isAdmin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const newModel = new Model(req.body);
    await newModel.save();
    return res.status(201).json(newModel);
  }

  if (req.method === "DELETE") {
    if (!req.session?.isAdmin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.query;
    await Model.findByIdAndDelete(id);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
