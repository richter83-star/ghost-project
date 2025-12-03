# Render Deployment Troubleshooting Guide

## Exit Code 128 Error

Exit code 128 typically means the service is crashing immediately after starting. Here's how to diagnose and fix:

### Step 1: Check Render Logs

In your Render dashboard:
1. Go to your service → **Logs** tab
2. Look for error messages right before the exit
3. Common errors you might see:
   - "Module not found"
   - "Cannot find module"
   - "Permission denied"
   - "EADDRINUSE" (port already in use)

### Step 2: Verify Render Service Configuration

**Important:** If `render.yaml` is in `GhostSystems/` subdirectory, Render might not auto-read it. You need to:

**Option A: Configure Manually in Render Dashboard**
1. Go to your service → **Settings** tab
2. Verify these settings:
   - **Root Directory:** `GhostSystems` (or leave blank if service is already configured)
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Node Version:** Should match `package.json` engines (>=22.x)

**Option B: Move render.yaml to Repo Root**
- Move `GhostSystems/render.yaml` → `render.yaml` (at repo root)
- Update `rootDir` to `./GhostSystems`

### Step 3: Common Issues and Fixes

#### Issue 1: Missing Dependencies
**Symptom:** "Cannot find module" errors
**Fix:** Ensure `tsx` is in `dependencies` (not `devDependencies`)

#### Issue 2: Missing Environment Variables
**Symptom:** Service starts but listeners fail
**Fix:** Add required env vars in Render dashboard

#### Issue 3: Port Conflict
**Symptom:** "EADDRINUSE" error
**Fix:** Let Render assign PORT automatically (use `process.env.PORT`)

#### Issue 4: File Path Issues
**Symptom:** Import errors, file not found
**Fix:** Ensure `rootDir` in render.yaml matches your service structure

### Step 4: Test Locally First

Before deploying, test the start command locally:
```bash
cd GhostSystems
npm install
npm start
```

If it works locally but fails on Render, it's likely an environment variable or path issue.

### Step 5: Render Dashboard Configuration

**Recommended Settings:**
- **Root Directory:** `GhostSystems`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Auto-Deploy:** Enabled
- **Health Check Path:** `/` (default)

## Quick Fixes

1. **Check Node Version:**
   - Render dashboard → Settings → Node Version
   - Should be 22.x or higher

2. **Verify Environment Variables:**
   - All Shopify variables present?
   - Firebase JSON properly formatted?
   - No syntax errors in env vars?

3. **Check Build Logs:**
   - Did `npm install` complete successfully?
   - Any Python dependency errors?
   - Any missing modules?

4. **Test Start Command:**
   - Try: `cd GhostSystems && npm start`
   - If it fails locally, fix before deploying

## Next Steps

After checking logs, share the specific error message and we can fix it!

