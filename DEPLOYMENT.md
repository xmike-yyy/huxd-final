# B-Me Deployment Guide

This guide will walk you through deploying the B-Me wellness chatbot to production.

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Google Gemini API key (get one at https://aistudio.google.com/app/apikey)

**Note:** As of the latest version, all metrics are calculated in JavaScript. No Python service needed!

---

## Deploy to Vercel (Complete Guide)

### Step 1: Push to GitHub

```bash
# Make sure you're on main branch
git checkout main

# Push to GitHub
git push origin main
```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: SvelteKit (auto-detected)
   - **Root Directory**: `./` (keep default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.svelte-kit` (auto-detected)

5. Add Environment Variables:
   - Click "Environment Variables"
   - Add: `GEMINI_API_KEY` = `your_actual_api_key_here`
   - Add: `GEMINI_MODEL` = `gemini-2.5-flash`

6. Click "Deploy"

**That's it!** Your app will be live at: `https://your-project.vercel.app`

---


---

## Testing Your Deployment

### Test Your App
1. Visit your Vercel URL: `https://your-project.vercel.app`
2. Start a conversation - send a test message
3. Check that:
   - Messages send and receive properly
   - Three-column layout displays correctly
   - You can create new chat sessions
   - Reflection log works
4. Open browser DevTools → Console to check for errors
5. Open Network tab → Send a message → Check `/api/chat` response includes metrics

---

## Troubleshooting

**Problem**: "GEMINI_API_KEY not set"
- **Solution**: Check Vercel environment variables, redeploy

**Problem**: Blank page
- **Solution**: Check Vercel deployment logs for build errors

**Problem**: "Failed to send message"
- **Solution**: Check browser console for specific error, verify API key is valid

**Problem**: Metrics showing 0 or incorrect values
- **Solution**: Metrics are calculated locally in JavaScript - check console for errors

**Problem**: Rate limit errors from Gemini
- **Solution**: You're hitting Gemini's free tier limits (15 req/min). Wait or upgrade API plan

**Problem**: Build fails with "Module not found: sentiment"
- **Solution**: Ensure `sentiment` package is in package.json and run `npm install`

---

## Monitoring

### Vercel Analytics
- Go to your project → "Analytics" tab
- See page views, response times, errors

### Vercel Logs
- Go to "Deployments" → Click deployment → "Runtime Logs"
- Watch real-time function execution

### Set Up Alerts (Optional)
- Vercel: Settings → Notifications
- Get alerts for deployment failures

---

## Cost Estimate

### Free Tier (Perfect for personal use):
- **Vercel**: Free for hobby projects
  - 100 GB bandwidth/month
  - Unlimited deployments
  - Fast serverless functions
- **Google Gemini**: Free tier
  - 15 requests/minute
  - 1500 requests/day
  - Perfect for testing/personal use

### If You Outgrow Free Tier:
- **Vercel Pro**: $20/month (higher limits, team features)
- **Gemini Pay-as-you-go**: ~$0.10-0.50/day for moderate use

**Expected cost for personal use: $0/month** (free tier is very generous)

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

# 3. Install dependencies
npm install

# 4. Run the dev server
npm run dev

# App will be at: http://localhost:5173
```

---

## Updating After Deployment

```bash
# Make changes
git add .
git commit -m "Your update message"
git push origin main

# Vercel auto-deploys on push to main
# No separate services to update!
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
