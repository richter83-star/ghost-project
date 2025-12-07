# Marketing Agent API Setup Guide

This guide walks you through setting up API credentials for all platforms supported by the Marketing Agent.

## Overview

The Marketing Agent can post to social media and publish blog content, but requires API credentials for each platform. Follow the steps below to set up each platform you want to use.

## Prerequisites

- Admin access to your accounts on each platform
- Ability to create developer apps/API keys
- Environment variable access in your deployment (Render, Vercel, etc.)

---

## 1. Twitter/X API Setup

**Note**: Twitter/X API integration has been removed due to the $100/month minimum cost for posting capabilities. If you need Twitter integration in the future, you can re-enable it by adding the Twitter posting functions back to `social-poster.ts`.

---

## 2. Facebook/Meta API Setup

### Step 1: Create Developer Account

1. Go to https://developers.facebook.com
2. Sign in with your Facebook account
3. Complete developer account verification

### Step 2: Create an App

1. Click "My Apps" → "Create App"
2. Select "Business" as the app type
3. Fill in:
   - **App name**: e.g., "DRACANUS Marketing"
   - **App contact email**: Your email
   - **Business account**: Select or create one

### Step 3: Add Products

1. In your app dashboard, go to "Add Products"
2. Add:
   - **Facebook Login** (for authentication)
   - **Pages API** (for posting to Pages)
   - **Marketing API** (optional, for ads)

### Step 4: Get App Credentials

1. Go to "Settings" → "Basic"
2. Note your:
   - **App ID** → `FACEBOOK_APP_ID`
   - **App Secret** → `FACEBOOK_APP_SECRET` (click "Show" to reveal)

### Step 5: Get Page Access Token

1. Go to "Tools" → "Graph API Explorer"
2. Select your app from the dropdown
3. Click "Generate Access Token"
4. Select permissions: `pages_manage_posts`, `pages_read_engagement`
5. Copy the token (this is short-lived)
6. To get a long-lived token:
   - Use the [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
   - Exchange short-lived token for long-lived (60 days)
   - Or use the Graph API to extend it

### Step 6: Get Page ID

1. Go to your Facebook Page
2. Click "About" → "Page Info"
3. Find "Page ID" → `FACEBOOK_PAGE_ID`

### Step 7: Environment Variables

Add these to your `.env` file:

```env
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
FACEBOOK_PAGE_ID=your_page_id_here
FACEBOOK_ACCESS_TOKEN=your_long_lived_access_token_here
```

### Important Notes

- **App Review**: Required for production use (can take weeks)
- **Test Mode**: Works with test users without review
- **Token Expiry**: Long-lived tokens expire after 60 days (can be extended)
- **Page Roles**: Your Facebook account must be an admin of the Page

### Troubleshooting

- **"Invalid OAuth access token"**: Token may have expired, regenerate
- **"Insufficient permissions"**: Add required permissions in App Review
- **"Page not found"**: Verify Page ID is correct

---

## 3. Instagram API Setup

### Step 1: Prerequisites

- Facebook Developer Account (from Step 2)
- Instagram Business or Creator Account
- Facebook Page connected to Instagram account

### Step 2: Connect Instagram to Facebook Page

1. Go to your Facebook Page
2. Go to "Settings" → "Instagram"
3. Connect your Instagram Business account
4. Verify the connection

### Step 3: Get Instagram Business Account ID

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app
3. Query: `GET /me/accounts`
4. Find your Page and note the `instagram_business_account.id` → `INSTAGRAM_BUSINESS_ACCOUNT_ID`

Or use:
```
GET /{page-id}?fields=instagram_business_account
```

### Step 4: Get Access Token

1. Use the same Facebook Page Access Token from Step 2.5
2. Or generate a new one with `instagram_basic`, `instagram_content_publish` permissions
3. This becomes → `INSTAGRAM_ACCESS_TOKEN`

### Step 5: Environment Variables

Add these to your `.env` file:

```env
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_instagram_account_id_here
INSTAGRAM_ACCESS_TOKEN=your_access_token_here
```

### Important Notes

- **Account Type**: Must be Business or Creator (not Personal)
- **Content Publishing**: Requires `instagram_content_publish` permission
- **Media Upload**: Images must be hosted publicly (not local files)
- **Rate Limits**: 25 posts per day per account

### Troubleshooting

- **"Invalid user"**: Verify Instagram account is Business/Creator type
- **"Missing permissions"**: Add `instagram_content_publish` in App Review
- **"Media URL error"**: Image must be publicly accessible HTTPS URL

---

## 4. Reddit API Setup

### Step 1: Create Reddit Account

1. Go to https://www.reddit.com
2. Create a Reddit account (if you don't have one)
3. Verify your email address
4. Build up some karma (some subreddits require minimum karma to post)

### Step 2: Create Reddit App

1. Go to https://www.reddit.com/prefs/apps
2. Scroll down to "Developed Applications"
3. Click "create another app..." or "create app"
4. Fill in:
   - **Name**: DRACANUS Marketing Agent
   - **Type**: Select "script" (for automated posting)
   - **Description**: Automated marketing content posting
   - **About URL**: Your website URL (optional)
   - **Redirect URI**: `http://localhost` (required but not used for script type)
5. Click "create app"
6. Note your credentials:
   - **Client ID** (under the app name, looks like: `abc123def456`) → `REDDIT_CLIENT_ID`
   - **Secret** (click "edit" to reveal, looks like: `xyz789_secret_key`) → `REDDIT_CLIENT_SECRET`

### Step 3: Get Reddit Username and Password

- **Username**: Your Reddit username → `REDDIT_USERNAME`
- **Password**: Your Reddit account password → `REDDIT_PASSWORD`

**Security Note**: Consider creating a dedicated Reddit account for automation to avoid exposing your main account password.

### Step 4: Set Default Subreddit (Optional)

You can set a default subreddit for posts, or specify it per campaign:

```env
REDDIT_DEFAULT_SUBREDDIT=marketing
```

### Step 5: Environment Variables

Add these to your `.env` file:

```env
REDDIT_CLIENT_ID=your_client_id_here
REDDIT_CLIENT_SECRET=your_secret_here
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
REDDIT_DEFAULT_SUBREDDIT=marketing  # Optional
```

### Important Notes

- **Account Age**: Some subreddits require accounts to be a certain age (e.g., 30 days)
- **Karma Requirements**: Many subreddits require minimum karma to post
- **Rate Limits**: Reddit has strict rate limits (1 post per 10 minutes per subreddit)
- **Subreddit Rules**: Always follow subreddit rules and guidelines
- **Self-Promotion**: Many subreddits have rules against self-promotion
- **Account Security**: Use a dedicated account for automation

### Troubleshooting

- **"Invalid credentials"**: Check username/password and client ID/secret
- **"Forbidden"**: Account may not have permission to post in that subreddit
- **"Rate limit exceeded"**: Wait 10 minutes between posts to same subreddit
- **"Subreddit not found"**: Verify subreddit name is correct (no r/ prefix needed)

---

## 5. Shopify Blog API Setup

### Step 1: Verify Existing Credentials

The Marketing Agent uses your existing Shopify Admin API credentials. Verify these are set:

```env
SHOPIFY_STORE_URL=dracanus-ai.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_xxxxx
```

### Step 2: Check API Permissions

1. Go to your Shopify Admin
2. Navigate to "Settings" → "Apps and sales channels" → "Developed apps"
3. Find your custom app (or create one)
4. Verify it has these permissions:
   - `read_content` (to read blogs)
   - `write_content` (to create blog posts)

### Step 3: Create Blog (if needed)

1. In Shopify Admin, go to "Online Store" → "Blog posts"
2. Create a blog (e.g., "Marketing Blog")
3. Note the blog handle/ID

### Step 4: Test API Access

The Marketing Agent will automatically use your Shopify credentials. No additional setup needed if:
- `SHOPIFY_STORE_URL` is set
- `SHOPIFY_ADMIN_API_TOKEN` is set
- API token has `write_content` permission

### Troubleshooting

- **"Unauthorized"**: Check API token permissions
- **"Blog not found"**: Create a blog in Shopify Admin first
- **"Invalid store URL"**: Format should be `store-name.myshopify.com` (no https://)

---

## 6. WordPress API Setup

**Important**: WordPress.com requires a paid plan ($4/month minimum) for REST API access. For free automated publishing, use **self-hosted WordPress** instead.

### Option A: Self-Hosted WordPress (Recommended - FREE)

This is the best option for automated publishing. You can host WordPress on:
- Your existing web hosting
- Free hosting services (some limitations)
- Local development server (for testing)

### Step 1: Install WordPress

If you don't have WordPress installed:

1. Download WordPress from https://wordpress.org/download/
2. Upload to your web hosting
3. Follow the 5-minute installation guide
4. Or use your hosting provider's one-click WordPress installer

### Step 2: Enable REST API

The WordPress REST API is enabled by default in WordPress 4.7+. No plugin needed.

### Step 3: Create Application Password

1. Log in to WordPress Admin (usually `yoursite.com/wp-admin`)
2. Go to "Users" → "Your Profile" (or "Users" → "All Users" → click your username)
3. Scroll down to "Application Passwords" section
4. Enter a name: e.g., "Marketing Agent"
5. Click "Add New Application Password"
6. **Copy the generated password immediately** (shown only once!) → `WORDPRESS_APP_PASSWORD`
   - Format: `xxxx xxxx xxxx xxxx` (4 groups of 4 characters)

### Step 4: Get Site URL and Username

- **Site URL**: Your WordPress site URL (e.g., `https://yoursite.com`) → `WORDPRESS_SITE_URL`
- **Username**: Your WordPress admin username → `WORDPRESS_USERNAME`

### Step 5: Environment Variables

Add these to your `.env` file:

```env
WORDPRESS_SITE_URL=https://yoursite.com
WORDPRESS_USERNAME=admin
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

### Option B: WordPress.com (Requires Paid Plan)

**Note**: WordPress.com free plan does NOT support REST API for publishing. You need at least the **Personal plan ($4/month)**.

### Step 1: Choose a Plan

1. Go to https://wordpress.com
2. Sign up or log in
3. Choose a plan (Personal plan minimum for API access)
4. Complete payment

### Step 2: Create OAuth App

1. Go to https://developer.wordpress.com/apps/
2. Click "Create a new application"
3. Fill in:
   - **Name**: DRACANUS Marketing Agent
   - **Description**: Automated blog publishing
   - **Website URL**: Your WordPress.com site URL
   - **Redirect URL**: `https://your-app.com/callback` (or `http://localhost` for testing)
4. Save and note:
   - **Client ID** → `WORDPRESS_CLIENT_ID`
   - **Client Secret** → `WORDPRESS_CLIENT_SECRET`

### Step 3: Environment Variables

```env
WORDPRESS_SITE_URL=https://yoursite.wordpress.com
WORDPRESS_CLIENT_ID=your_client_id_here
WORDPRESS_CLIENT_SECRET=your_client_secret_here
```

### Quick Setup Alternative: Skip WordPress

If you don't want to pay for WordPress.com and don't have hosting for self-hosted WordPress, you can:

1. **Use Shopify Blog only** - Already configured if you have Shopify
2. **Set up free hosting** - Many providers offer free WordPress hosting:
   - Some limitations but works for automated publishing
   - Examples: InfinityFree, 000webhost (check their terms)

### Important Notes

- **WordPress.com Free Plan**: Does NOT support REST API publishing. Requires paid plan.
- **Self-Hosted WordPress**: FREE and full REST API access
- **Application Passwords**: More secure than regular passwords (WordPress 5.6+)
- **Permissions**: Application passwords inherit your user's permissions
- **HTTPS Required**: WordPress REST API requires HTTPS in production
- **Rate Limits**: WordPress.com has rate limits (varies by plan)

### Troubleshooting

- **"Invalid credentials"**: Regenerate application password
- **"REST API disabled"**: Check if a plugin is blocking it
- **"Forbidden"**: Verify user has `publish_posts` capability
- **"Connection refused"**: Check site URL format (include https://)

---

## Security Best Practices

### 1. Environment Variables

- **Never commit** API keys to version control
- Use `.env` file (add to `.gitignore`)
- Use secure environment variable storage in production (Render, Vercel, etc.)

### 2. Token Rotation

- Rotate API keys periodically (every 90 days)
- Regenerate tokens if compromised
- Use long-lived tokens where possible (Facebook, Instagram)

### 3. Permissions

- Grant only minimum required permissions
- Review app permissions regularly
- Remove unused apps/credentials

### 4. Monitoring

- Monitor API usage for unusual activity
- Set up alerts for authentication failures
- Review posted content regularly

---

## Verification

After setting up credentials, verify they work:

1. Check the Marketing Agent status endpoint:
   ```bash
   curl https://your-app.com/api/marketing-agent/status
   ```

2. Look for `availablePlatforms` in the response:
   ```json
   {
     "availablePlatforms": {
       "social": ["facebook", "instagram", "reddit"],
       "blog": ["shopify"]
     }
   }
   ```

3. Test a manual campaign execution:
   ```bash
   curl -X POST https://your-app.com/api/marketing-agent/run
   ```

---

## Next Steps

Once credentials are set up:

1. The Marketing Agent will automatically detect available platforms
2. Recommendations will only be generated for configured platforms
3. Campaigns will execute using real API integrations
4. Check logs for any authentication errors

For issues, check:
- Environment variables are set correctly
- API tokens haven't expired
- Required permissions are granted
- Rate limits haven't been exceeded

---

## Support

If you encounter issues:

1. Check platform-specific error messages in logs
2. Verify credentials using platform developer tools
3. Test API access manually using platform APIs
4. Review platform-specific documentation:
   - [Facebook Graph API](https://developers.facebook.com/docs/graph-api)
   - [Instagram Graph API](https://developers.facebook.com/docs/instagram-api)
   - [Reddit API](https://www.reddit.com/dev/api)
   - [Shopify Admin API](https://shopify.dev/api/admin-rest)
   - [WordPress REST API](https://developer.wordpress.org/rest-api/)
