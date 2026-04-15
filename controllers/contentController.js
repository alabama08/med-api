import HospitalContent from "../models/HospitalContent.js";

// @GET /api/content/public
export const getPublicContent = async (req, res) => {
  const { type } = req.query;
  const query = { isPublished: true };
  if (type) query.type = type;

  const content = await HospitalContent.find(query)
    .populate("author", "name avatar")
    .sort({ isPinned: -1, order: 1, createdAt: -1 });

  res.json({ success: true, content });
};

// @GET /api/content/public/grouped — All types in one call for homepage
export const getGroupedPublicContent = async (req, res) => {
  const content = await HospitalContent.find({ isPublished: true })
    .populate("author", "name avatar")
    .sort({ isPinned: -1, order: 1, createdAt: -1 });

  const grouped = {};
  content.forEach((item) => {
    if (!grouped[item.type]) grouped[item.type] = [];
    grouped[item.type].push(item);
  });

  res.json({ success: true, grouped });
};

// @GET /api/content — Admin: get all
export const getAllContent = async (req, res) => {
  const { type, published } = req.query;
  const query = {};
  if (type) query.type = type;
  if (published === "true")  query.isPublished = true;
  if (published === "false") query.isPublished = false;

  const content = await HospitalContent.find(query)
    .populate("author", "name avatar")
    .sort({ isPinned: -1, order: 1, createdAt: -1 });

  res.json({ success: true, content });
};

// @POST /api/content — Admin: create
export const createContent = async (req, res) => {
  const {
    type, title, subtitle, body, imageUrl, images, videoUrl,
    icon, ctaText, ctaLink, tags, isPublished, isPinned, order, meta,
  } = req.body;

  if (!type || !title) {
    res.status(400);
    throw new Error("Type and title are required");
  }

  const content = await HospitalContent.create({
    type, title, subtitle, body,
    imageUrl: imageUrl || "",
    images:   images   || [],
    videoUrl: videoUrl || "",
    icon, ctaText, ctaLink,
    tags:        tags        || [],
    isPublished: isPublished !== undefined ? isPublished : true,
    isPinned:    isPinned    || false,
    order:       order       || 0,
    meta:        meta        || {},
    author: req.user._id,
  });

  res.status(201).json({ success: true, message: "Content created", content });
};

// @PUT /api/content/:id — Admin: update
export const updateContent = async (req, res) => {
  const content = await HospitalContent.findById(req.params.id);
  if (!content) { res.status(404); throw new Error("Content not found"); }

  const fields = [
    "title","subtitle","body","imageUrl","images","videoUrl","icon",
    "ctaText","ctaLink","tags","isPublished","isPinned","order","meta","type",
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) content[f] = req.body[f];
  });

  await content.save();
  res.json({ success: true, message: "Content updated", content });
};

// @DELETE /api/content/:id
export const deleteContent = async (req, res) => {
  const content = await HospitalContent.findById(req.params.id);
  if (!content) { res.status(404); throw new Error("Content not found"); }
  await content.deleteOne();
  res.json({ success: true, message: "Content deleted" });
};

// @PUT /api/content/:id/toggle
export const togglePublish = async (req, res) => {
  const content = await HospitalContent.findById(req.params.id);
  if (!content) { res.status(404); throw new Error("Content not found"); }
  content.isPublished = !content.isPublished;
  await content.save();
  res.json({ success: true, message: `Content ${content.isPublished ? "published" : "unpublished"}`, content });
};

// @PUT /api/content/:id/pin
export const togglePin = async (req, res) => {
  const content = await HospitalContent.findById(req.params.id);
  if (!content) { res.status(404); throw new Error("Content not found"); }
  content.isPinned = !content.isPinned;
  await content.save();
  res.json({ success: true, message: `Content ${content.isPinned ? "pinned" : "unpinned"}`, content });
};

// @GET /api/content/stats
export const getContentStats = async (req, res) => {
  const total     = await HospitalContent.countDocuments();
  const published = await HospitalContent.countDocuments({ isPublished: true });
  const pinned    = await HospitalContent.countDocuments({ isPinned: true });
  const byType    = await HospitalContent.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  res.json({ success: true, stats: { total, published, pinned, byType } });
};