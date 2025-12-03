# Enable Adaptive AI in Render

## Quick Steps

The Adaptive AI is currently disabled. To enable it, you need to set the environment variable in Render:

### Option 1: Render Dashboard (Recommended)

1. Go to your Render dashboard: https://dashboard.render.com
2. Click on your **ghostsystems** service
3. Go to the **Environment** tab
4. Click **Add Environment Variable**
5. Add these variables:

```
Key: ENABLE_ADAPTIVE_AI
Value: true
```

```
Key: ADAPTIVE_AI_GENERATION_INTERVAL_HOURS
Value: 24
```

```
Key: ADAPTIVE_AI_MIN_PRODUCTS
Value: 3
```

```
Key: ADAPTIVE_AI_MAX_PRODUCTS
Value: 5
```

6. Click **Save Changes**
7. Render will automatically redeploy your service
8. Check logs - you should see:
   ```
   [INIT] 🧠 starting Adaptive AI Listener...
   [AdaptiveAI] 🔄 Starting adaptive generation cycle...
   ```

### Option 2: Update render.yaml and Redeploy

The variables are already in `render.yaml`, but Render might need them set explicitly. You can also verify they're there and trigger a manual redeploy.

## Verification

After enabling, check your Render logs. You should see:

```
[INIT] 🧠 starting Adaptive AI Listener...
[AdaptiveAI] 🧠 Starting Adaptive AI Listener...
[AdaptiveAI] ⏰ Generation interval: 24 hours
[AdaptiveAI] 🔄 Starting adaptive generation cycle...
```

Instead of:
```
[INIT] ℹ️ Adaptive AI disabled (set ENABLE_ADAPTIVE_AI=true to enable)
```

## What Happens Next

Once enabled, Adaptive AI will:
- ✅ Run market analysis immediately
- ✅ Generate products based on insights
- ✅ Repeat every 24 hours automatically
- ✅ Log all activity in Render logs

The generated products will flow through your pipeline:
`pending → draft → published`

