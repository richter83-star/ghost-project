# Ghost Fleet Controller - Mobile Dashboard

A mobile-responsive React dashboard for monitoring and controlling all AI agents remotely.

## Features

- **Agent Status Overview** - View status of all AI agents (Adaptive AI, Store Design, Marketing)
- **Recommendations Management** - Approve/reject recommendations from all agents
- **Activity Feed** - View recent outputs (products, campaigns, design changes)
- **Manual Controls** - Trigger agent runs manually
- **Settings** - View and configure agent settings
- **Mobile-First Design** - Optimized for phones and tablets

## Setup

### 1. Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Build for Production

```bash
npm run build
```

Or from the root directory:

```bash
npm run dashboard:build
```

### 3. Development Mode

```bash
npm run dev
```

Or from the root directory:

```bash
npm run dashboard:dev
```

The dashboard will be available at `http://localhost:3001` (development) or `/dashboard` (production).

## Authentication

1. Set `DASHBOARD_API_KEY` in your environment variables (Render, `.env`, etc.)
2. Open the dashboard and go to Settings
3. Enter your API key
4. The key is saved in localStorage for future sessions

## API Endpoints

All dashboard API endpoints are under `/api/dashboard`:

- `GET /api/dashboard/status` - Overall system status
- `GET /api/dashboard/agents` - List all agents
- `GET /api/dashboard/recommendations` - Pending recommendations
- `GET /api/dashboard/outputs` - Recent activity
- `GET /api/dashboard/metrics` - Combined metrics
- `POST /api/dashboard/agents/:id/run` - Trigger agent run
- `POST /api/dashboard/recommendations/:id/approve` - Approve recommendation
- `POST /api/dashboard/recommendations/:id/reject` - Reject recommendation

## Deployment

### Option 1: Serve from Express (Recommended)

1. Build the dashboard: `npm run dashboard:build`
2. The server automatically serves static files from `dashboard/dist` at `/dashboard`
3. Access at: `https://your-app.onrender.com/dashboard`

### Option 2: Separate Deployment

1. Deploy dashboard separately (Vercel, Netlify, etc.)
2. Set `VITE_API_URL` to your backend URL
3. Configure CORS in `server.ts` to allow your dashboard domain

## Mobile Usage

The dashboard is optimized for mobile devices:

- Touch-friendly buttons and cards
- Bottom navigation for easy access
- Responsive layout that works on all screen sizes
- Auto-refresh every 30-60 seconds

## Troubleshooting

**Dashboard not loading:**
- Make sure you've built it: `npm run dashboard:build`
- Check that `dashboard/dist` directory exists
- Verify server is serving static files correctly

**API errors:**
- Check that `DASHBOARD_API_KEY` is set in environment variables
- Verify API key in Settings matches your environment variable
- Check server logs for authentication errors

**No data showing:**
- Ensure agents are enabled (`ENABLE_ADAPTIVE_AI`, `ENABLE_STORE_DESIGN_AGENT`, `ENABLE_MARKETING_AGENT`)
- Check that agents have run at least once
- Verify Firebase connection is working

