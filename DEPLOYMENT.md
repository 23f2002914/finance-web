# Finance Web - Deployment Guide

## Overview

This is a full-stack finance tracking application:
- **Backend**: Flask + Supabase (Postgres)
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: Supabase Postgres with real-time sync

## Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git
- Supabase account (free tier)

### Local Development

#### 1. Clone and Setup
```bash
cd finance-web
git clone <repo> .
```

#### 2. Backend Setup
```bash
# Create virtual environment (optional)
python3 -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r backend/requirements.txt

# Create .env.local with Supabase credentials
cat > .env.local << 'ENVEOF'
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
DEBUG=True
PORT=5000
ENVEOF

# Run the backend
python3 backend/app.py
# Server runs on http://localhost:5000
```

#### 3. Frontend Setup
```bash
cd frontend

# Copy .env if needed
cp .env.example .env

# Install dependencies
npm install

# Start dev server
npm run dev
# App runs on http://localhost:5173
# Proxy to backend at http://localhost:5000/api
```

#### 4. Access the App
Open http://localhost:5173 in your browser.

---

## Production Deployment

### Option A: Render + Vercel (Recommended)

#### Backend (Render)
1. Push code to GitHub
2. Create new Web Service on Render
3. Connect your GitHub repository
4. Set environment variables in Render dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `DEBUG=False`
   - `PORT=10000`
5. Set build command: `pip install -r backend/requirements.txt`
6. Set start command: `python3 backend/app.py`
7. Deploy

Backend URL: `https://your-app.onrender.com`

#### Frontend (Vercel)
1. Create new project on Vercel
2. Import from GitHub (frontend/ directory)
3. Set environment variables:
   - `VITE_SUPABASE_URL=https://your-project.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key`
   - `VITE_API_URL=https://your-app.onrender.com/api`
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy

Frontend URL: `https://your-app.vercel.app`

### Option B: Docker + Cloud Run (GCP/AWS)

#### Docker Setup
```bash
# Create Dockerfile for backend
cat > Dockerfile << 'DEOF'
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
ENV FLASK_APP=app.py
CMD ["python", "app.py"]
DEOF

# Build and push
docker build -t finance-web-backend .
docker tag finance-web-backend gcr.io/your-project/finance-web:latest
docker push gcr.io/your-project/finance-web:latest
```

#### Deploy to Cloud Run
```bash
gcloud run deploy finance-web \
  --image gcr.io/your-project/finance-web:latest \
  --platform managed \
  --region us-central1 \
  --set-env-vars SUPABASE_URL=...,SUPABASE_SERVICE_KEY=...
```

---

## Database Setup

### Initialize Supabase

1. Create project at supabase.com
2. Create tables via SQL Editor (from DEPLOYMENT.sql in repo):
   ```bash
   # Copy schema from supabase/migrations/*.sql
   # Paste into Supabase SQL Editor and run
   ```
3. Enable Realtime on core tables
4. Set up RLS policies

### Backup & Recovery

```bash
# Export data as JSON
curl -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  https://your-project.supabase.co/rest/v1/expenses \
  > expenses_backup.json

# Import via Supabase dashboard or CSV uploader
```

---

## Monitoring

### Backend Monitoring (Render)
- Render dashboard shows logs and metrics
- Set up email alerts for crashes
- Monitor CPU/memory usage

### Frontend Monitoring (Vercel)
- Vercel Analytics for performance
- Error tracking built-in
- Edge function logs

### Database Monitoring (Supabase)
- Database health dashboard
- Realtime connections monitor
- Query performance insights

---

## Troubleshooting

### Backend won't start
```bash
# Check if port 5000 is in use
lsof -ti:5000 | xargs kill -9

# Verify Supabase credentials
echo $SUPABASE_URL

# Check Flask logs
python3 backend/app.py 2>&1 | grep -i error
```

### Frontend won't build
```bash
cd frontend
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Supabase connection issues
```bash
# Test connection from Flask
python3 -c "from backend.db import get_client; print(get_client().table('bank_accounts').select('*').limit(1).execute())"

# Check credentials in .env.local
cat .env.local | grep SUPABASE
```

### Realtime not syncing
- Enable Realtime in Supabase project settings
- Check RLS policies allow anon access
- Verify tables are in realtime publication

---

## Security Checklist

- [ ] Set `DEBUG=False` in production
- [ ] Rotate Supabase keys periodically
- [ ] Enable RLS on all tables
- [ ] Use HTTPS everywhere (enforced by Vercel/Render)
- [ ] Monitor for unusual activity in Supabase logs
- [ ] Set up backups in Supabase (paid tier)
- [ ] Enable 2FA on Supabase account

---

## CI/CD

### GitHub Actions (optional)
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy backend
        run: |
          curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
      - name: Deploy frontend
        run: |
          curl -X POST ${{ secrets.VERCEL_DEPLOY_HOOK }}
```

---

## Cost Estimate (Monthly)

| Component | Free Tier | Cost |
|-----------|-----------|------|
| Supabase DB | 500 MB | $25 |
| Render Backend | 750 hrs/mo | Free |
| Vercel Frontend | - | Free |
| **Total** | - | **~$25** |

---

## Next Steps

1. [ ] Set up Supabase project
2. [ ] Create `.env.local` with credentials
3. [ ] Test locally (both backend and frontend)
4. [ ] Push to GitHub
5. [ ] Deploy backend to Render
6. [ ] Deploy frontend to Vercel
7. [ ] Test production app
8. [ ] Set up monitoring/alerts
