# B-Me Deployment Guide

This guide will walk you through deploying the B-Me wellness chatbot to production.

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Render/Railway account for Python service (or alternative)
- Google Gemini API key (get one at https://aistudio.google.com/app/apikey)

---

## Part 1: Deploy Frontend to Vercel

### Step 1: Push to GitHub

```bash
# Make sure you're on main branch
git checkout main

# Push to GitHub (create repo first if needed)
git remote add origin https://github.com/YOUR_USERNAME/b-me-wellness.git
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com and sign in
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: SvelteKit
   - **Root Directory**: `./` (keep default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.svelte-kit` (auto-detected)

5. Add Environment Variables:
   - Click "Environment Variables"
   - Add: `GEMINI_API_KEY` = `your_actual_api_key_here`
   - Add: `GEMINI_MODEL` = `gemini-2.5-flash`

6. Click "Deploy"

Your frontend will be live at: `https://your-project.vercel.app`

---

## Part 2: Deploy Python Metrics Service

### Option A: Deploy to Render (Recommended - Free Tier)

1. Go to https://render.com and sign in

2. Click "New" → "Web Service"

3. Connect your GitHub repo

4. Configure:
   - **Name**: `bme-metrics-service`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: `metrics-service`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`

5. Click "Create Web Service"

6. Once deployed, copy the service URL (e.g., `https://bme-metrics-service.onrender.com`)

### Option B: Deploy to Railway

1. Go to https://railway.app and sign in

2. Click "New Project" → "Deploy from GitHub repo"

3. Select your repository

4. Configure:
   - **Root Directory**: `metrics-service`
   - Railway will auto-detect Python and FastAPI

5. Once deployed, copy the service URL

### Option C: Deploy to Fly.io

```bash
# Install flyctl
brew install flyctl

# Login
flyctl auth login

# Navigate to metrics service
cd metrics-service

# Initialize fly app
flyctl launch
# Answer prompts:
# - App name: bme-metrics-service
# - Region: choose closest
# - Postgres: No
# - Redis: No

# Deploy
flyctl deploy
```

---

## Part 3: Connect Frontend to Python Service

### Update Vercel Environment Variable

1. Go to your Vercel project dashboard
2. Navigate to "Settings" → "Environment Variables"
3. Add new variable:
   - **Name**: `METRICS_SERVICE_URL`
   - **Value**: Your Python service URL (e.g., `https://bme-metrics-service.onrender.com`)
4. Click "Save"
5. Redeploy: Go to "Deployments" → Click "..." on latest deployment → "Redeploy"

---

## Part 4: Update Code to Use Environment Variable

The code should already handle this, but verify:

```javascript
// src/lib/services/metricsService.js
const METRICS_SERVICE_URL =
  process.env.METRICS_SERVICE_URL ||
  'http://localhost:8000';
```

---

## Testing Your Deployment

### Test Frontend
1. Visit your Vercel URL: `https://your-project.vercel.app`
2. Send a test message
3. Check browser console for errors

### Test Python Service
Visit: `https://your-metrics-service-url.com/docs`
You should see the FastAPI interactive documentation.

### Test Integration
1. Open browser DevTools → Network tab
2. Send a message in the chat
3. Look for requests to `/api/chat`
4. Check if metrics are being calculated (look at API response)

---

## Troubleshooting

### Frontend Issues

**Problem**: "GEMINI_API_KEY not set"
- Solution: Check Vercel environment variables, redeploy

**Problem**: Blank page
- Solution: Check Vercel deployment logs for build errors

**Problem**: "Failed to send message"
- Solution: Check browser console for specific error

### Python Service Issues

**Problem**: Service won't start
- Solution: Check deployment logs, verify requirements.txt is correct

**Problem**: 502 Bad Gateway
- Solution: Check that the start command is correct:
  ```
  uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

**Problem**: NLTK data not found
- Solution: Add to requirements.txt:
  ```
  nltk==3.8.1
  ```
  And ensure `main.py` downloads NLTK data on startup:
  ```python
  import nltk
  nltk.download('vader_lexicon', quiet=True)
  nltk.download('punkt', quiet=True)
  ```

### Integration Issues

**Problem**: Metrics not showing
- Solution: Verify METRICS_SERVICE_URL is set correctly in Vercel

**Problem**: CORS errors
- Solution: Python service should have CORS enabled:
  ```python
  # In metrics-service/main.py
  from fastapi.middleware.cors import CORSMiddleware

  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],  # In production, specify your Vercel domain
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

---

## Monitoring

### Vercel Analytics
- Go to your project → "Analytics" tab
- See page views, response times, errors

### Render Logs
- Go to your service → "Logs" tab
- Watch real-time logs

### Set Up Alerts (Optional)
- Vercel: Settings → Notifications
- Render: Dashboard → Notifications

---

## Cost Estimate

### Free Tier Usage:
- **Vercel**: Free for hobby projects
  - 100 GB bandwidth/month
  - Unlimited deployments
- **Render**: Free tier
  - 750 hours/month (always-on)
  - Spins down after 15min inactivity
  - Cold start ~30s
- **Google Gemini**: Free tier
  - 15 requests/minute
  - 1500 requests/day

### If You Outgrow Free Tier:
- **Vercel Pro**: $20/month
- **Render Starter**: $7/month (always-on, no cold starts)
- **Gemini Pay-as-you-go**: $0.00025/1K input tokens

---

## Security Checklist

- [x] API keys in environment variables (not in code)
- [x] .env file in .gitignore
- [ ] CORS restricted to your domain (not "*")
- [ ] Rate limiting enabled (TODO: Phase 4)
- [ ] HTTPS enforced (Vercel does this automatically)
- [ ] Content Security Policy headers (TODO: Phase 4)

---

## Local Development After Deployment

To run locally after deployment:

```bash
# 1. Create .env file (copy from .env.example)
cp .env.example .env

# 2. Add your API keys to .env
# GEMINI_API_KEY=your_key_here

# 3. Run the startup script
bash start.sh

# Frontend will be at: http://localhost:5173
# Python service at: http://localhost:8000
# Python docs at: http://localhost:8000/docs
```

---

## Updating After Deployment

### Update Frontend
```bash
# Make changes
git add .
git commit -m "Update frontend"
git push origin main

# Vercel auto-deploys on push to main
```

### Update Python Service
```bash
# Make changes to metrics-service/
git add .
git commit -m "Update metrics service"
git push origin main

# Render/Railway auto-deploys on push to main
```

---

## Custom Domain (Optional)

### Add Custom Domain to Vercel
1. Go to project Settings → Domains
2. Add your domain (e.g., `bme-wellness.com`)
3. Follow DNS configuration instructions
4. Wait for DNS propagation (~24 hours)

---

## Next Steps

Once deployed:
1. Share with beta testers
2. Monitor error rates and performance
3. Implement Phase 4 features (error handling, rate limiting)
4. Consider adding:
   - User authentication (Supabase)
   - Cloud database (Supabase PostgreSQL)
   - Analytics (PostHog, Mixpanel)

---

## Support

- Vercel Docs: https://vercel.com/docs
- Render Docs: https://render.com/docs
- SvelteKit Docs: https://kit.svelte.dev/docs
- FastAPI Docs: https://fastapi.tiangolo.com/

**Deployment successful? 🎉 Your mental wellness chatbot is now live!**
