/**
 * Marketing Agent - Social Media Poster
 * 
 * Posts content to social media platforms using their APIs.
 */

import axios from 'axios';
import { isPlatformAvailable, getMissingCredentialsMessage } from './credentials.js';

export interface SocialPostResult {
  success: boolean;
  postId?: string;
  platform: string;
  error?: string;
}

/**
 * Post to Facebook Page
 */
export async function postToFacebook(
  content: string,
  imageUrl?: string
): Promise<SocialPostResult> {
  const platform = 'facebook';

  // Check credentials
  if (!(await isPlatformAvailable('facebook'))) {
    return {
      success: false,
      platform,
      error: getMissingCredentialsMessage('facebook', [
        'FACEBOOK_APP_ID',
        'FACEBOOK_APP_SECRET',
        'FACEBOOK_PAGE_ID',
        'FACEBOOK_ACCESS_TOKEN',
      ]),
    };
  }

  try {
    const pageId = process.env.FACEBOOK_PAGE_ID;
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

    if (!pageId || !accessToken) {
      throw new Error('Facebook Page ID or Access Token missing');
    }

    // Build post payload
    const postData: any = {
      message: content,
      access_token: accessToken,
    };

    // Add image if provided
    if (imageUrl) {
      postData.url = imageUrl; // Facebook will fetch and attach the image
    }

    // Post to Facebook Page
    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${pageId}/feed`,
      postData
    );

    console.log(`[MarketingAgent] ✅ Posted to Facebook: ${response.data.id}`);
    return {
      success: true,
      postId: response.data.id,
      platform,
    };
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to post to Facebook:', error.message);
    
    // Provide helpful error messages
    let errorMessage = error.message;
    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      errorMessage = `${fbError.message} (Code: ${fbError.code})`;
      
      if (fbError.code === 190) {
        errorMessage += ' - Access token expired or invalid';
      } else if (fbError.code === 200) {
        errorMessage += ' - Missing or invalid permissions';
      }
    }

    return {
      success: false,
      platform,
      error: errorMessage,
    };
  }
}

/**
 * Post to Instagram
 */
export async function postToInstagram(
  imageUrl: string,
  caption: string
): Promise<SocialPostResult> {
  const platform = 'instagram';

  // Check credentials
  if (!(await isPlatformAvailable('instagram'))) {
    return {
      success: false,
      platform,
      error: getMissingCredentialsMessage('instagram', [
        'INSTAGRAM_BUSINESS_ACCOUNT_ID',
        'INSTAGRAM_ACCESS_TOKEN',
      ]),
    };
  }

  try {
    const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN;

    if (!accountId || !accessToken) {
      throw new Error('Instagram Business Account ID or Access Token missing');
    }

    // Step 1: Create media container
    const containerResponse = await axios.post(
      `https://graph.facebook.com/v21.0/${accountId}/media`,
      {
        image_url: imageUrl,
        caption: caption.substring(0, 2200), // Instagram caption limit
        access_token: accessToken,
      }
    );

    const creationId = containerResponse.data.id;
    if (!creationId) {
      throw new Error('Failed to create media container');
    }

    // Step 2: Publish the media
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing

    const publishResponse = await axios.post(
      `https://graph.facebook.com/v21.0/${accountId}/media_publish`,
      {
        creation_id: creationId,
        access_token: accessToken,
      }
    );

    console.log(`[MarketingAgent] ✅ Posted to Instagram: ${publishResponse.data.id}`);
    return {
      success: true,
      postId: publishResponse.data.id,
      platform,
    };
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to post to Instagram:', error.message);
    
    let errorMessage = error.message;
    if (error.response?.data?.error) {
      const igError = error.response.data.error;
      errorMessage = `${igError.message} (Code: ${igError.code})`;
      
      if (igError.code === 190) {
        errorMessage += ' - Access token expired or invalid';
      } else if (igError.code === 10) {
        errorMessage += ' - Permission denied or account not connected';
      }
    }

    return {
      success: false,
      platform,
      error: errorMessage,
    };
  }
}

/**
 * Post to Reddit
 */
export async function postToReddit(
  content: string,
  subreddit: string,
  title?: string,
  imageUrl?: string
): Promise<SocialPostResult> {
  const platform = 'reddit';

  // Check credentials
  if (!(await isPlatformAvailable('reddit'))) {
    return {
      success: false,
      platform,
      error: getMissingCredentialsMessage('reddit', [
        'REDDIT_CLIENT_ID',
        'REDDIT_CLIENT_SECRET',
        'REDDIT_USERNAME',
        'REDDIT_PASSWORD',
      ]),
    };
  }

  try {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    const username = process.env.REDDIT_USERNAME;
    const password = process.env.REDDIT_PASSWORD;

    if (!clientId || !clientSecret || !username || !password) {
      throw new Error('Reddit credentials incomplete');
    }

    // Step 1: Get OAuth access token
    const authResponse = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({
        grant_type: 'password',
        username: username,
        password: password,
      }),
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MarketingAgent/1.0 by DRACANUS',
        },
      }
    );

    const accessToken = authResponse.data.access_token;
    if (!accessToken) {
      throw new Error('Failed to get Reddit access token');
    }

    // Step 2: Post to subreddit
    const postTitle = title || content.substring(0, 300); // Reddit title limit
    const postText = imageUrl ? `${content}\n\n[Image: ${imageUrl}]` : content;

    // Reddit API: Use link post if image, text post otherwise
    const postData: any = {
      title: postTitle.substring(0, 300),
      sr: subreddit,
      kind: imageUrl ? 'link' : 'self',
    };

    if (imageUrl) {
      postData.url = imageUrl;
    } else {
      postData.text = postText.substring(0, 40000); // Reddit text limit
    }

    const postResponse = await axios.post(
      'https://oauth.reddit.com/api/submit',
      new URLSearchParams(postData),
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MarketingAgent/1.0 by DRACANUS',
        },
      }
    );

    const postId = postResponse.data?.json?.data?.id;
    if (!postId) {
      throw new Error('Failed to create Reddit post');
    }

    const postUrl = `https://reddit.com${postResponse.data.json.data.url}`;

    console.log(`[MarketingAgent] ✅ Posted to Reddit r/${subreddit}: ${postId}`);
    return {
      success: true,
      postId,
      platform,
    };
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to post to Reddit:', error.message);
    
    let errorMessage = error.message;
    if (error.response?.data) {
      const redditError = error.response.data;
      if (redditError.error) {
        errorMessage = `${redditError.error}: ${redditError.message || ''}`;
      }
      
      // Common Reddit errors
      if (error.response.status === 401) {
        errorMessage = 'Authentication failed. Check Reddit credentials';
      } else if (error.response.status === 403) {
        errorMessage = 'Permission denied. Check subreddit name and account permissions';
      } else if (error.response.status === 404) {
        errorMessage = 'Subreddit not found or doesn\'t exist';
      }
    }

    return {
      success: false,
      platform,
      error: errorMessage,
    };
  }
}

/**
 * Post to LinkedIn (if credentials available)
 */
export async function postToLinkedIn(
  content: string,
  imageUrl?: string
): Promise<SocialPostResult> {
  const platform = 'linkedin';

  // LinkedIn requires OAuth 2.0 setup - not implemented yet
  // This is a placeholder for future implementation
  return {
    success: false,
    platform,
    error: 'LinkedIn integration not yet implemented. Requires OAuth 2.0 setup.',
  };
}

/**
 * Post to multiple platforms at once
 */
export async function postToMultiplePlatforms(
  content: string,
  platforms: ('facebook' | 'instagram' | 'reddit')[],
  imageUrl?: string,
  redditSubreddit?: string
): Promise<SocialPostResult[]> {
  const results: SocialPostResult[] = [];

  for (const platform of platforms) {
    try {
      let result: SocialPostResult;

      if (platform === 'facebook') {
        result = await postToFacebook(content, imageUrl);
      } else if (platform === 'instagram') {
        if (!imageUrl) {
          result = {
            success: false,
            platform: 'instagram',
            error: 'Instagram requires an image URL',
          };
        } else {
          result = await postToInstagram(imageUrl, content);
        }
      } else if (platform === 'reddit') {
        const subreddit = redditSubreddit || process.env.REDDIT_DEFAULT_SUBREDDIT || 'marketing';
        result = await postToReddit(content, subreddit, undefined, imageUrl);
      } else {
        result = {
          success: false,
          platform,
          error: `Unknown platform: ${platform}`,
        };
      }

      results.push(result);

      // Small delay between posts to avoid rate limits
      if (platform !== platforms[platforms.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Reddit needs longer delays
      }
    } catch (error: any) {
      results.push({
        success: false,
        platform,
        error: error.message,
      });
    }
  }

  return results;
}

