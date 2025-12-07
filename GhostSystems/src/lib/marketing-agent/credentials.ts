/**
 * Marketing Agent - Credential Validation
 * 
 * Validates which platforms have API credentials configured
 * and returns available platforms for the agent to use.
 */

export interface AvailablePlatforms {
  social: string[];
  blog: string[];
}

export interface CredentialStatus {
  facebook: boolean;
  instagram: boolean;
  reddit: boolean;
  shopify: boolean;
  wordpress: boolean;
}

/**
 * Validate social media API credentials
 */
export async function validateSocialMediaCredentials(): Promise<CredentialStatus> {
  const status: CredentialStatus = {
    facebook: false,
    instagram: false,
    reddit: false,
    shopify: false,
    wordpress: false,
  };

  // Check Facebook credentials
  if (
    process.env.FACEBOOK_APP_ID &&
    process.env.FACEBOOK_APP_SECRET &&
    process.env.FACEBOOK_PAGE_ID &&
    process.env.FACEBOOK_ACCESS_TOKEN
  ) {
    status.facebook = true;
  }

  // Check Instagram credentials
  if (
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID &&
    process.env.INSTAGRAM_ACCESS_TOKEN
  ) {
    status.instagram = true;
  } else if (status.facebook && process.env.FACEBOOK_ACCESS_TOKEN) {
    // Instagram can use Facebook token if connected
    // We'll verify this when actually posting
    status.instagram = true;
  }

  // Check Reddit credentials
  if (
    process.env.REDDIT_CLIENT_ID &&
    process.env.REDDIT_CLIENT_SECRET &&
    process.env.REDDIT_USERNAME &&
    process.env.REDDIT_PASSWORD
  ) {
    status.reddit = true;
  }

  // Check Shopify credentials (for blog)
  if (
    process.env.SHOPIFY_STORE_URL &&
    process.env.SHOPIFY_ADMIN_API_TOKEN
  ) {
    status.shopify = true;
  }

  // Check WordPress credentials
  if (
    process.env.WORDPRESS_SITE_URL &&
    process.env.WORDPRESS_USERNAME &&
    process.env.WORDPRESS_APP_PASSWORD
  ) {
    status.wordpress = true;
  } else if (
    process.env.WORDPRESS_SITE_URL &&
    process.env.WORDPRESS_CLIENT_ID &&
    process.env.WORDPRESS_CLIENT_SECRET
  ) {
    // WordPress.com OAuth
    status.wordpress = true;
  }

  return status;
}

/**
 * Validate blog publishing credentials
 */
export async function validateBlogCredentials(): Promise<{
  shopify: boolean;
  wordpress: boolean;
}> {
  const status = await validateSocialMediaCredentials();
  return {
    shopify: status.shopify,
    wordpress: status.wordpress,
  };
}

/**
 * Get list of available platforms
 */
export async function getAvailablePlatforms(): Promise<AvailablePlatforms> {
  const status = await validateSocialMediaCredentials();

  const social: string[] = [];
  if (status.facebook) social.push('facebook');
  if (status.instagram) social.push('instagram');
  if (status.reddit) social.push('reddit');

  const blog: string[] = [];
  if (status.shopify) blog.push('shopify');
  if (status.wordpress) blog.push('wordpress');

  return { social, blog };
}

/**
 * Get detailed credential status with missing credential info
 */
export async function getCredentialStatus(): Promise<{
  available: AvailablePlatforms;
  missing: {
    social: Array<{ platform: string; required: string[] }>;
    blog: Array<{ platform: string; required: string[] }>;
  };
}> {
  const status = await validateSocialMediaCredentials();
  const available = await getAvailablePlatforms();

  const missing = {
    social: [] as Array<{ platform: string; required: string[] }>,
    blog: [] as Array<{ platform: string; required: string[] }>,
  };

  // Check missing social platforms
  if (!status.facebook) {
    missing.social.push({
      platform: 'facebook',
      required: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'FACEBOOK_PAGE_ID', 'FACEBOOK_ACCESS_TOKEN'],
    });
  }

  if (!status.instagram) {
    missing.social.push({
      platform: 'instagram',
      required: ['INSTAGRAM_BUSINESS_ACCOUNT_ID', 'INSTAGRAM_ACCESS_TOKEN'],
    });
  }

  if (!status.reddit) {
    missing.social.push({
      platform: 'reddit',
      required: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USERNAME', 'REDDIT_PASSWORD'],
    });
  }

  // Check missing blog platforms
  if (!status.shopify) {
    missing.blog.push({
      platform: 'shopify',
      required: ['SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_API_TOKEN'],
    });
  }

  if (!status.wordpress) {
    missing.blog.push({
      platform: 'wordpress',
      required: ['WORDPRESS_SITE_URL', 'WORDPRESS_USERNAME', 'WORDPRESS_APP_PASSWORD'],
    });
  }

  return { available, missing };
}

/**
 * Check if a specific platform is available
 */
export async function isPlatformAvailable(platform: 'facebook' | 'instagram' | 'reddit' | 'shopify' | 'wordpress'): Promise<boolean> {
  const status = await validateSocialMediaCredentials();
  return status[platform];
}

/**
 * Get error message for missing credentials
 */
export function getMissingCredentialsMessage(platform: string, required: string[]): string {
  return `Missing credentials for ${platform}. Required environment variables: ${required.join(', ')}. See MARKETING_AGENT_SETUP.md for setup instructions.`;
}

