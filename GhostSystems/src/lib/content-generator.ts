/**
 * Content Generator Module
 * 
 * Generates actual deliverable content for products:
 * - Prompt Packs: AI image generation prompts
 * - Automation Kits: Workflow templates and setup guides
 * - Bundles: Combined content packages
 */

import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ============================================================================
// TYPES
// ============================================================================

export interface PromptPackContent {
  title: string;
  theme: string;
  prompts: Array<{
    id: number;
    prompt: string;
    style: string;
    model: string;
    parameters: string;
  }>;
  usageGuide: string;
  tips: string[];
  totalPrompts: number;
}

export interface AutomationKitContent {
  title: string;
  description: string;
  platform: 'n8n' | 'make' | 'zapier';
  integrations: string[];
  workflow: {
    name: string;
    description: string;
    triggers: string[];
    actions: string[];
    nodes: Array<{
      id: string;
      type: string;
      name: string;
      description: string;
      config: Record<string, any>;
    }>;
  };
  setupGuide: string;
  prerequisites: string[];
  estimatedSetupTime: string;
}

export interface BundleContent {
  title: string;
  description: string;
  items: Array<{
    type: 'prompt_pack' | 'automation_kit';
    title: string;
    value: string;
  }>;
  totalValue: string;
  bundleDiscount: string;
  bonuses: string[];
}

export interface GeneratedContent {
  type: 'prompt_pack' | 'automation_kit' | 'bundle';
  content: PromptPackContent | AutomationKitContent | BundleContent;
  markdown: string;
  generatedAt: string;
}

// ============================================================================
// GEMINI API HELPER
// ============================================================================

async function generateWithGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const payload = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
  };

  const response = await axios.post(
    `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
    payload,
    { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
  );

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No response from Gemini');
  }

  return text.trim();
}

// ============================================================================
// PROMPT PACK GENERATOR
// ============================================================================

export async function generatePromptPack(
  title: string,
  theme: string,
  promptCount: number = 15
): Promise<PromptPackContent> {
  console.log(`[ContentGenerator] Generating prompt pack: ${title}`);

  const systemPrompt = `You are an expert AI prompt engineer who creates premium, professional prompts for AI image generation tools like Midjourney, DALL-E, and Stable Diffusion.

Your prompts should be:
- Highly detailed and specific
- Include style, lighting, composition, and mood descriptors
- Professional quality that would sell for $19-49
- Unique and creative, not generic
- Include recommended parameters for each model

Output ONLY valid JSON, no markdown formatting.`;

  const userPrompt = `Create a premium prompt pack titled "${title}" with the theme "${theme}".

Generate exactly ${promptCount} unique, high-quality AI image generation prompts.

Return ONLY this JSON structure (no markdown):
{
  "title": "${title}",
  "theme": "${theme}",
  "prompts": [
    {
      "id": 1,
      "prompt": "detailed prompt text here with style, lighting, composition",
      "style": "photography/illustration/3d/etc",
      "model": "Midjourney/DALL-E/SDXL",
      "parameters": "--ar 16:9 --v 6 --style raw"
    }
  ],
  "usageGuide": "detailed guide on how to use these prompts effectively",
  "tips": ["tip 1", "tip 2", "tip 3", "tip 4", "tip 5"],
  "totalPrompts": ${promptCount}
}`;

  const response = await generateWithGemini(systemPrompt, userPrompt);
  
  // Parse JSON response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse prompt pack JSON');
  }
  
  const content = JSON.parse(jsonMatch[0]) as PromptPackContent;
  console.log(`[ContentGenerator] Generated ${content.prompts.length} prompts`);
  
  return content;
}

// ============================================================================
// AUTOMATION KIT GENERATOR
// ============================================================================

export async function generateAutomationKit(
  title: string,
  platform: 'n8n' | 'make' | 'zapier',
  integrations: string[]
): Promise<AutomationKitContent> {
  console.log(`[ContentGenerator] Generating automation kit: ${title} for ${platform}`);

  const systemPrompt = `You are an expert automation consultant who creates premium workflow templates for ${platform}.

Your automation kits should be:
- Practical and immediately usable
- Well-documented with clear setup instructions
- Include error handling and best practices
- Professional quality that would sell for $29-79
- Solve real business problems

Output ONLY valid JSON, no markdown formatting.`;

  const userPrompt = `Create a premium automation kit titled "${title}" for ${platform}.

The automation should integrate: ${integrations.join(', ')}

Return ONLY this JSON structure (no markdown):
{
  "title": "${title}",
  "description": "comprehensive description of what this automation does",
  "platform": "${platform}",
  "integrations": ${JSON.stringify(integrations)},
  "workflow": {
    "name": "workflow name",
    "description": "what the workflow accomplishes",
    "triggers": ["trigger 1", "trigger 2"],
    "actions": ["action 1", "action 2", "action 3"],
    "nodes": [
      {
        "id": "node_1",
        "type": "trigger/action/condition",
        "name": "Node Name",
        "description": "what this node does",
        "config": { "key": "value" }
      }
    ]
  },
  "setupGuide": "detailed step-by-step setup instructions (at least 500 words)",
  "prerequisites": ["prereq 1", "prereq 2"],
  "estimatedSetupTime": "15-30 minutes"
}`;

  const response = await generateWithGemini(systemPrompt, userPrompt);
  
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse automation kit JSON');
  }
  
  const content = JSON.parse(jsonMatch[0]) as AutomationKitContent;
  console.log(`[ContentGenerator] Generated automation kit with ${content.workflow.nodes.length} nodes`);
  
  return content;
}

// ============================================================================
// BUNDLE GENERATOR
// ============================================================================

export async function generateBundleContent(
  title: string,
  items: Array<{ type: 'prompt_pack' | 'automation_kit'; title: string }>
): Promise<BundleContent> {
  console.log(`[ContentGenerator] Generating bundle: ${title}`);

  const systemPrompt = `You are a product bundling expert who creates compelling value propositions for digital product bundles.

Your bundles should:
- Clearly articulate the combined value
- Include bonus items that enhance the bundle
- Have compelling descriptions
- Show clear savings

Output ONLY valid JSON, no markdown formatting.`;

  const itemDescriptions = items.map(i => `${i.type}: ${i.title}`).join('\n');

  const userPrompt = `Create a premium bundle titled "${title}" containing these items:
${itemDescriptions}

Return ONLY this JSON structure (no markdown):
{
  "title": "${title}",
  "description": "compelling description of the bundle value proposition",
  "items": [
    {
      "type": "prompt_pack or automation_kit",
      "title": "item title",
      "value": "$XX value"
    }
  ],
  "totalValue": "$XXX total value",
  "bundleDiscount": "XX% off",
  "bonuses": ["bonus 1", "bonus 2", "bonus 3"]
}`;

  const response = await generateWithGemini(systemPrompt, userPrompt);
  
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse bundle JSON');
  }
  
  const content = JSON.parse(jsonMatch[0]) as BundleContent;
  console.log(`[ContentGenerator] Generated bundle with ${content.items.length} items`);
  
  return content;
}

// ============================================================================
// MARKDOWN EXPORTERS
// ============================================================================

export function promptPackToMarkdown(content: PromptPackContent): string {
  let md = `# ${content.title}\n\n`;
  md += `**Theme:** ${content.theme}\n\n`;
  md += `**Total Prompts:** ${content.totalPrompts}\n\n`;
  md += `---\n\n`;
  md += `## Usage Guide\n\n${content.usageGuide}\n\n`;
  md += `---\n\n`;
  md += `## Prompts\n\n`;

  for (const prompt of content.prompts) {
    md += `### Prompt ${prompt.id}\n\n`;
    md += `**Style:** ${prompt.style} | **Model:** ${prompt.model}\n\n`;
    md += `\`\`\`\n${prompt.prompt}\n\`\`\`\n\n`;
    md += `**Parameters:** \`${prompt.parameters}\`\n\n`;
    md += `---\n\n`;
  }

  md += `## Pro Tips\n\n`;
  for (const tip of content.tips) {
    md += `- ${tip}\n`;
  }

  return md;
}

export function automationKitToMarkdown(content: AutomationKitContent): string {
  let md = `# ${content.title}\n\n`;
  md += `**Platform:** ${content.platform}\n\n`;
  md += `**Integrations:** ${content.integrations.join(', ')}\n\n`;
  md += `**Estimated Setup Time:** ${content.estimatedSetupTime}\n\n`;
  md += `---\n\n`;
  md += `## Description\n\n${content.description}\n\n`;
  md += `---\n\n`;
  md += `## Prerequisites\n\n`;
  for (const prereq of content.prerequisites) {
    md += `- ${prereq}\n`;
  }
  md += `\n---\n\n`;
  md += `## Workflow Overview\n\n`;
  md += `**Name:** ${content.workflow.name}\n\n`;
  md += `${content.workflow.description}\n\n`;
  md += `### Triggers\n`;
  for (const trigger of content.workflow.triggers) {
    md += `- ${trigger}\n`;
  }
  md += `\n### Actions\n`;
  for (const action of content.workflow.actions) {
    md += `- ${action}\n`;
  }
  md += `\n---\n\n`;
  md += `## Workflow Nodes\n\n`;
  for (const node of content.workflow.nodes) {
    md += `### ${node.name}\n\n`;
    md += `**Type:** ${node.type}\n\n`;
    md += `${node.description}\n\n`;
    md += `**Configuration:**\n\`\`\`json\n${JSON.stringify(node.config, null, 2)}\n\`\`\`\n\n`;
  }
  md += `---\n\n`;
  md += `## Setup Guide\n\n${content.setupGuide}\n`;

  return md;
}

export function bundleToMarkdown(content: BundleContent): string {
  let md = `# ${content.title}\n\n`;
  md += `${content.description}\n\n`;
  md += `---\n\n`;
  md += `## What's Included\n\n`;
  md += `| Item | Type | Value |\n`;
  md += `|------|------|-------|\n`;
  for (const item of content.items) {
    md += `| ${item.title} | ${item.type} | ${item.value} |\n`;
  }
  md += `\n**Total Value:** ${content.totalValue}\n\n`;
  md += `**Your Price:** ${content.bundleDiscount}\n\n`;
  md += `---\n\n`;
  md += `## Bonuses\n\n`;
  for (const bonus of content.bonuses) {
    md += `- ${bonus}\n`;
  }

  return md;
}

// ============================================================================
// MAIN CONTENT GENERATOR
// ============================================================================

export async function generateProductContent(
  productType: string,
  title: string,
  options: {
    theme?: string;
    platform?: 'n8n' | 'make' | 'zapier';
    integrations?: string[];
    bundleItems?: Array<{ type: 'prompt_pack' | 'automation_kit'; title: string }>;
    promptCount?: number;
  } = {}
): Promise<GeneratedContent> {
  const normalizedType = productType.toLowerCase().replace(/[_\s-]+/g, '_');

  if (normalizedType.includes('prompt') || normalizedType.includes('pack')) {
    const theme = options.theme || extractThemeFromTitle(title);
    const content = await generatePromptPack(title, theme, options.promptCount || 15);
    return {
      type: 'prompt_pack',
      content,
      markdown: promptPackToMarkdown(content),
      generatedAt: new Date().toISOString(),
    };
  }

  if (normalizedType.includes('automation') || normalizedType.includes('kit') || normalizedType.includes('workflow')) {
    const platform = options.platform || 'n8n';
    const integrations = options.integrations || extractIntegrationsFromTitle(title);
    const content = await generateAutomationKit(title, platform, integrations);
    return {
      type: 'automation_kit',
      content,
      markdown: automationKitToMarkdown(content),
      generatedAt: new Date().toISOString(),
    };
  }

  if (normalizedType.includes('bundle')) {
    const items = options.bundleItems || [
      { type: 'prompt_pack' as const, title: `${title} Prompts` },
      { type: 'automation_kit' as const, title: `${title} Workflow` },
    ];
    const content = await generateBundleContent(title, items);
    return {
      type: 'bundle',
      content,
      markdown: bundleToMarkdown(content),
      generatedAt: new Date().toISOString(),
    };
  }

  // Default to prompt pack
  const theme = options.theme || extractThemeFromTitle(title);
  const content = await generatePromptPack(title, theme, options.promptCount || 15);
  return {
    type: 'prompt_pack',
    content,
    markdown: promptPackToMarkdown(content),
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractThemeFromTitle(title: string): string {
  // Remove common words and extract theme
  const cleanTitle = title
    .replace(/prompt(s)?|pack|kit|bundle|automation|workflow/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleanTitle || 'Creative Digital Design';
}

function extractIntegrationsFromTitle(title: string): string[] {
  const integrations: string[] = [];
  const knownIntegrations = [
    'Notion', 'Gmail', 'Slack', 'Calendly', 'Google Sheets', 'Airtable',
    'Shopify', 'Stripe', 'Discord', 'Twitter', 'LinkedIn', 'YouTube',
    'Typeform', 'DocuSign', 'HubSpot', 'Mailchimp', 'Klaviyo', 'Drive',
  ];

  const lowerTitle = title.toLowerCase();
  for (const integration of knownIntegrations) {
    if (lowerTitle.includes(integration.toLowerCase())) {
      integrations.push(integration);
    }
  }

  // Default integrations if none found
  if (integrations.length === 0) {
    integrations.push('Google Sheets', 'Gmail', 'Slack');
  }

  return integrations;
}

