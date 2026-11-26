# Signal — Simple User Analytics

A small MERN analytics application that records page views and clicks, groups activity into visitor sessions, and visualizes session journeys and click locations.

## Tech stack

- **MongoDB** stores one document per event.
- **Express and Node.js** validate and expose the analytics API.
- **React and Vite** power the dashboard.
- **Vanilla JavaScript** tracker can be embedded on a webpage.

## Run locally

1. Install Node.js 18 or newer and MongoDB Community Server, then start MongoDB.
2. Copy `.env.example` to `.env`. The default URI is `mongodb://127.0.0.1:27017` and the database is `signal_analytics`.
3. Install packages and start the app:

   ```sh
   npm install
   npm run dev
   ```

4. Open the dashboard at `http://localhost:5173` and the sample storefront at `http://localhost:5173/demo.html`.

The Vite development server proxies `/api` requests to Express on port 3000. MongoDB must be available when the server starts; if it is not, restart the server after starting MongoDB. In production, run `npm run build` and `npm start`; Express serves the built dashboard and the tracker from the project root.

## Add tracking to a webpage

For a page served by this app, add this tag before the closing `</body>` tag:

```html
<script src="/tracker.js" defer></script>
```

For a separate website, point the script and event endpoint to the deployed analytics server (and configure the server's CORS policy for that site):

```html
<script src="https://analytics.example.com/tracker.js" data-endpoint="https://analytics.example.com/api/events" defer></script>
```

The tracker stores a persistent session ID in `localStorage`, sends a `page_view` on load, and records click coordinates relative to the visitor's viewport. If browser storage is unavailable, it uses an in-memory ID for that page load. Tracking failures are intentionally ignored so they cannot interrupt the host page.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Server and MongoDB status |
| `POST` | `/api/events` | Validate and store a page view or click |
| `GET` | `/api/sessions` | Sessions with total events, page views, clicks, and activity times |
| `GET` | `/api/sessions/:sessionId/events` | Up to 1,000 ordered events for a session |
| `GET` | `/api/pages` | Page URLs present in the event collection |
| `GET` | `/api/heatmap?url=<encoded-page-url>` | Up to 5,000 click positions for a page |

Click records include `x`, `y`, `viewport_width`, and `viewport_height`. The viewport dimensions let the dashboard scale click positions to its heatmap canvas. Timestamps are stored as MongoDB dates and sessions are sorted by most recent activity.

## Assumptions and trade-offs

- A session is a browser profile's persistent `localStorage` ID. It does not expire automatically, and clearing browser storage starts a new session.
- Click coordinates are viewport-relative, not document-relative. Scroll position is not recorded; the heatmap therefore represents viewport locations.
- The dashboard displays the most recent 200 sessions and a bounded number of events/clicks to keep queries predictable.
- The heatmap uses a stylized page canvas because arbitrary customer pages may block iframe embedding. The selected page and measured viewport coordinates are shown alongside the dots.
- MongoDB uses compound/query indexes for session timelines, page heatmaps, and recent event sorting.
- This assignment implementation does not include authentication, consent management, event batching, retention jobs, or deployment configuration.
