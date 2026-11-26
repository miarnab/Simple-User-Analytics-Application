import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'signal_analytics';
const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
let events;

app.use(cors());
app.use(express.json({ limit: '32kb' }));

function requireDatabase(_req, res, next) {
  if (!events) return res.status(503).json({ error: 'Database is not connected. Start MongoDB and restart the server.' });
  next();
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: events ? 'connected' : 'disconnected' }));

app.post('/api/events', requireDatabase, async (req, res, next) => {
  try {
    const { session_id, event_type, page_url, timestamp, x, y, viewport_width, viewport_height } = req.body || {};
    if (typeof session_id !== 'string' || session_id.length < 8 || session_id.length > 100) {
      return res.status(400).json({ error: 'session_id must be a string between 8 and 100 characters.' });
    }
    if (!['page_view', 'click'].includes(event_type)) return res.status(400).json({ error: 'event_type must be page_view or click.' });
    if (typeof page_url !== 'string' || page_url.length > 2048) return res.status(400).json({ error: 'A valid page_url is required.' });
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return res.status(400).json({ error: 'timestamp must be a valid date.' });
    const event = {
      session_id,
      event_type,
      page_url,
      timestamp: date,
      ...(event_type === 'click' ? {
        x: Number.isFinite(Number(x)) ? Number(x) : 0,
        y: Number.isFinite(Number(y)) ? Number(y) : 0,
        viewport_width: Number.isFinite(Number(viewport_width)) ? Number(viewport_width) : null,
        viewport_height: Number.isFinite(Number(viewport_height)) ? Number(viewport_height) : null,
      } : {}),
    };
    const { insertedId } = await events.insertOne(event);
    res.status(201).json({ id: insertedId.toString(), accepted: true });
  } catch (error) { next(error); }
});

app.get('/api/sessions', requireDatabase, async (_req, res, next) => {
  try {
    const sessions = await events.aggregate([
      { $sort: { timestamp: 1 } },
      { $group: {
        _id: '$session_id',
        total_events: { $sum: 1 },
        first_seen: { $first: '$timestamp' },
        last_seen: { $last: '$timestamp' },
        page_views: { $sum: { $cond: [{ $eq: ['$event_type', 'page_view'] }, 1, 0] } },
        clicks: { $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] } },
        last_page: { $last: '$page_url' },
      } },
      { $sort: { last_seen: -1 } },
      { $limit: 200 },
    ]).toArray();
    res.json(sessions.map(({ _id, ...session }) => ({ session_id: _id, ...session })));
  } catch (error) { next(error); }
});

app.get('/api/sessions/:sessionId/events', requireDatabase, async (req, res, next) => {
  try {
    const result = await events.find({ session_id: req.params.sessionId }).sort({ timestamp: 1 }).limit(1000).toArray();
    res.json(result.map(({ _id, ...event }) => ({ id: _id.toString(), ...event })));
  } catch (error) { next(error); }
});

app.get('/api/pages', requireDatabase, async (_req, res, next) => {
  try {
    const pages = await events.distinct('page_url');
    res.json(pages.sort());
  } catch (error) { next(error); }
});

app.get('/api/heatmap', requireDatabase, async (req, res, next) => {
  try {
    if (typeof req.query.url !== 'string' || !req.query.url) return res.status(400).json({ error: 'A page url query parameter is required.' });
    const clicks = await events.find({ page_url: req.query.url, event_type: 'click' }, {
      projection: { _id: 0, x: 1, y: 1, viewport_width: 1, viewport_height: 1, timestamp: 1 },
    }).sort({ timestamp: -1 }).limit(5000).toArray();
    res.json(clicks);
  } catch (error) { next(error); }
});

app.use('/tracker.js', express.static(path.join(root, 'public', 'tracker.js')));
app.use(express.static(path.join(root, 'dist')));
app.use(express.static(path.join(root, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong while processing the request.' });
});

async function start() {
  try {
    await mongo.connect();
    const db = mongo.db(dbName);
    events = db.collection('events');
    await Promise.all([
      events.createIndex({ session_id: 1, timestamp: 1 }),
      events.createIndex({ page_url: 1, event_type: 1 }),
      events.createIndex({ timestamp: -1 }),
    ]);
    console.log(`Connected to MongoDB database "${dbName}"`);
  } catch (error) {
    console.error(`MongoDB unavailable: ${error.message}`);
    console.error('The server will start, but analytics APIs will return 503 until it is restarted with MongoDB available.');
  }
  app.listen(port, () => console.log(`Analytics API listening at http://localhost:${port}`));
}

start();
