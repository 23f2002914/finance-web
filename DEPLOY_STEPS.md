# Deployment Guide - Step by Step

## Quick Start (2 Services, 15 minutes)

This app deploys on:
- **Backend**: Render (Flask + Supabase)
- **Frontend**: Vercel (React SPA)
- **Database**: Supabase (Postgres) - Already live!

---

## Step 1: Deploy Backend to Render

### 1a. Create Render Account
1. Go to https://render.com
2. Sign up with GitHub
3. Create a new Web Service

### 1b. Connect Repository
1. Click "New +" → "Web Service"
2. Connect your GitHub repo: `23f2002914/finance-web`
3. Choose branch: `main`

### 1c. Configure Backend
```
Name: finance-web-backend
Environment: Python
Region: Oregon (or closest)
Root Directory: (leave empty)
Build Command: pip install -r backend/requirements.txt
Start Command: python backend/app.py
```

### 1d. Add Environment Variables
Click "Advanced" and add:
```
SUPABASE_URL=https://biimibmtcofxsbtcauaq.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaW1pYm10Y29meHNidGNhdWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODIzNjksImV4cCI6MjA5ODQ1ODM2OX0.AAzICg0YoaEgyCQ3min_1T6HNN2bstJrPJuU0IqDLaY
SUPABASE_SERVICE_KEY=(your service key - keep secret!)
DEBUG=False
FLASK_ENV=production
PORT=10000
```

### 1e. Deploy
Click "Create Web Service" - Render will deploy automatically!

**Backend URL**: `https://finance-web-backend.onrender.com`

---

## Step 2: Deploy Frontend to Vercel

### 2a. Create Vercel Account
1. Go to https://vercel.com
2. Sign up with GitHub
3. Import project

### 2b. Import Project
1. Click "New Project"
2. Select GitHub repo: `23f2002914/finance-web`
3. Framework: "Vite"
4. Root Directory: `frontend`

### 2c. Configure Build Settings
```
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### 2d. Add Environment Variables
```
VITE_SUPABASE_URL=https://biimibmtcofxsbtcauaq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaW1pYm10Y29meHNidGNhdWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODIzNjksImV4cCI6MjA5ODQ1ODM2OX0.AAzICg0YoaEgyCQ3min_1T6HNN2bstJrPJuU0IqDLaY
VITE_API_URL=https://finance-web-backend.onrender.com/api
```

### 2e. Deploy
Click "Deploy" - Vercel will build and deploy!

**Frontend URL**: `https://finance-web.vercel.app`

---

## Step 3: Test Deployment

### 3a. Test Backend
```bash
curl https://finance-web-backend.onrender.com/api/accounts
# Should return JSON array of 6 accounts
```

### 3b. Test Frontend
1. Open https://finance-web.vercel.app
2. Dashboard should load with account balances
3. Try Debts → Click "Pay" → Record payment
4. Check "Mark Fully Paid" works

### 3c. Test Realtime
1. Open app in 2 browsers
2. Edit a debt in one
3. Other browser should update automatically (within 1-2 seconds)

---

## Step 4: Automatic Deployments (Optional)

### GitHub Actions CI/CD
Every time you push to `main`, the app auto-deploys:

1. **Set up Render API key**:
   - Go to Render Account Settings → API Keys
   - Copy API Key
   - Add to GitHub Secrets: `RENDER_API_KEY`

2. **Set up Vercel Token**:
   - Go to Vercel Account Settings → Tokens
   - Create token "deployment"
   - Add to GitHub Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

3. **Add GitHub Secrets**:
   - Go to Repo Settings → Secrets and Variables → Actions
   - Add: `RENDER_API_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

Now every push to main auto-deploys both services!

---

## Troubleshooting

### Backend won't start on Render
```
Check logs: Render dashboard → finance-web-backend → Logs
Common issues:
- Missing environment variables (SUPABASE_URL, etc.)
- Python version mismatch (should be 3.10+)
- Port conflict (use PORT=10000)
```

### Frontend build fails on Vercel
```
Check logs: Vercel dashboard → Deployments → Failed build
Common issues:
- Node version too old (should be 18+)
- Missing VITE_ environment variables
- Root directory wrong (should be "frontend")
```

### Realtime not syncing
```
Check:
1. Supabase project still active
2. Realtime enabled on tables (supabase.com dashboard)
3. RLS policies allow anon access
4. Frontend connects to correct API (check VITE_API_URL)
```

---

## Production Checklist

- [ ] Backend deployed to Render
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set correctly
- [ ] Supabase database live and accessible
- [ ] API endpoints returning data
- [ ] Frontend displaying dashboard
- [ ] Debt/subscription payment flows working
- [ ] Realtime sync working (cross-browser test)
- [ ] Monitoring set up (Render logs, Vercel analytics)
- [ ] Backups enabled (Supabase)

---

## URLs After Deployment

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | https://finance-web-backend.onrender.com | Flask API (13 endpoints) |
| Frontend | https://finance-web.vercel.app | React SPA (8 tabs) |
| Database | Supabase Dashboard | Postgres + Realtime |
| GitHub | https://github.com/23f2002914/finance-web | Source code |

---

## Costs

| Service | Free Tier | Cost |
|---------|-----------|------|
| Supabase | 500MB | $25/mo |
| Render | 750 hrs/mo | Free |
| Vercel | Unlimited | Free |
| **Total** | | **$25/month** |

---

## Next Steps

After deployment:

1. **Monitor**: Check Render logs daily for errors
2. **Backup**: Enable automated backups in Supabase (paid)
3. **Scale**: If traffic increases, upgrade Render plan
4. **Update**: Push new code to main branch for auto-deploy
5. **Share**: Give friends the Vercel URL to track their finances!

---

**Ready to deploy?** Follow Steps 1-2 above and you'll have the app live in ~15 minutes! 🚀
