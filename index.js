require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS: origin not allowed -> ' + origin));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Missing MONGODB_URI environment variable.');
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let jobsCollection;
let acceptedTasksCollection;

async function connectDB() {
  if (jobsCollection && acceptedTasksCollection) return;
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'freelanceMarketplace');
  jobsCollection = db.collection('jobs');
  acceptedTasksCollection = db.collection('acceptedTasks');
  await jobsCollection.createIndex({ userEmail: 1 });
  await jobsCollection.createIndex({ postedAt: -1 });
  await acceptedTasksCollection.createIndex({ workerEmail: 1 });
  console.log('Connected to MongoDB.');
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get('/', (_req, res) => {
  res.json({
    name: 'Freelance Marketplace API',
    status: 'running',
    endpoints: [
      'GET /jobs',
      'GET /jobs/latest',
      'GET /jobs/:id',
      'POST /jobs',
      'PATCH /jobs/:id',
      'DELETE /jobs/:id',
      'GET /jobs/mine/:email',
      'POST /accepted-tasks',
      'GET /accepted-tasks/:email',
      'DELETE /accepted-tasks/:id',
      'GET /categories/stats',
    ],
  });
});

app.get(
  '/jobs',
  asyncHandler(async (req, res) => {
    await connectDB();
    const { sort = 'newest', category } = req.query;
    const filter = {};
    if (category && category !== 'All') filter.category = category;
    const sortMap = {
      newest: { postedAt: -1 },
      oldest: { postedAt: 1 },
    };
    const jobs = await jobsCollection
      .find(filter)
      .sort(sortMap[sort] || sortMap.newest)
      .toArray();
    res.json(jobs);
  })
);

app.get(
  '/jobs/latest',
  asyncHandler(async (_req, res) => {
    await connectDB();
    const jobs = await jobsCollection
      .find({})
      .sort({ postedAt: -1 })
      .limit(6)
      .toArray();
    res.json(jobs);
  })
);

app.get(
  '/jobs/mine/:email',
  asyncHandler(async (req, res) => {
    await connectDB();
    const email = req.params.email.toLowerCase();
    const jobs = await jobsCollection
      .find({ userEmail: email })
      .sort({ postedAt: -1 })
      .toArray();
    res.json(jobs);
  })
);

app.get(
  '/jobs/:id',
  asyncHandler(async (req, res) => {
    await connectDB();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job id' });
    }
    const job = await jobsCollection.findOne({ _id: new ObjectId(id) });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  })
);

app.post(
  '/jobs',
  asyncHandler(async (req, res) => {
    await connectDB();
    const { title, postedBy, category, summary, coverImage, userEmail } = req.body || {};
    if (!title || !postedBy || !category || !summary || !coverImage || !userEmail) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const doc = {
      title: String(title).trim(),
      postedBy: String(postedBy).trim(),
      category: String(category).trim(),
      summary: String(summary).trim(),
      coverImage: String(coverImage).trim(),
      userEmail: String(userEmail).toLowerCase(),
      postedAt: new Date(),
    };
    const result = await jobsCollection.insertOne(doc);
    res.status(201).json({ insertedId: result.insertedId, ...doc });
  })
);

app.patch(
  '/jobs/:id',
  asyncHandler(async (req, res) => {
    await connectDB();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job id' });
    }
    const allowed = ['title', 'category', 'summary', 'coverImage'];
    const update = {};
    for (const key of allowed) {
      if (req.body && typeof req.body[key] === 'string' && req.body[key].trim()) {
        update[key] = req.body[key].trim();
      }
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }
    update.updatedAt = new Date();
    const result = await jobsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.json({ modifiedCount: result.modifiedCount, ...update });
  })
);

app.delete(
  '/jobs/:id',
  asyncHandler(async (req, res) => {
    await connectDB();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job id' });
    }
    const result = await jobsCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }
    await acceptedTasksCollection.deleteMany({ jobId: id });
    res.json({ deletedCount: result.deletedCount });
  })
);

app.post(
  '/accepted-tasks',
  asyncHandler(async (req, res) => {
    await connectDB();
    const { jobId, workerEmail, workerName } = req.body || {};
    if (!jobId || !workerEmail) {
      return res.status(400).json({ message: 'jobId and workerEmail required' });
    }
    if (!ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: 'Invalid jobId' });
    }
    const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });
    if (!job) return res.status(404).json({ message: 'Job not found' });

    if (job.userEmail === String(workerEmail).toLowerCase()) {
      return res
        .status(403)
        .json({ message: 'You cannot accept a job you posted yourself.' });
    }

    const existing = await acceptedTasksCollection.findOne({
      jobId,
      workerEmail: String(workerEmail).toLowerCase(),
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: 'You have already accepted this job.' });
    }

    const doc = {
      jobId,
      jobTitle: job.title,
      category: job.category,
      coverImage: job.coverImage,
      summary: job.summary,
      postedBy: job.postedBy,
      postedByEmail: job.userEmail,
      workerEmail: String(workerEmail).toLowerCase(),
      workerName: workerName || '',
      status: 'pending',
      acceptedAt: new Date(),
    };
    const result = await acceptedTasksCollection.insertOne(doc);
    res.status(201).json({ insertedId: result.insertedId, ...doc });
  })
);

app.get(
  '/accepted-tasks/:email',
  asyncHandler(async (req, res) => {
    await connectDB();
    const email = req.params.email.toLowerCase();
    const tasks = await acceptedTasksCollection
      .find({ workerEmail: email })
      .sort({ acceptedAt: -1 })
      .toArray();
    res.json(tasks);
  })
);

app.delete(
  '/accepted-tasks/:id',
  asyncHandler(async (req, res) => {
    await connectDB();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid task id' });
    }
    const result = await acceptedTasksCollection.deleteOne({
      _id: new ObjectId(id),
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ deletedCount: result.deletedCount });
  })
);

app.get(
  '/categories/stats',
  asyncHandler(async (_req, res) => {
    await connectDB();
    const stats = await jobsCollection
      .aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();
    res.json(stats.map((s) => ({ category: s._id, count: s.count })));
  })
);

app.use((err, _req, res, _next) => {
  console.error('API error:', err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  connectDB().catch((e) => console.error('DB connect failed:', e));
});

module.exports = app;
