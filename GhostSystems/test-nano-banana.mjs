#!/usr/bin/env node
/**
 * Test script for Nano Banana (Imagen 4) integration
 * Run: node test-nano-banana.mjs
 */

import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable is not set');
  console.log('   Set it in your .env file or export it:');
  console.log('   export GEMINI_API_KEY=your-api-key');
  process.exit(1);
}

console.log('🍌 Nano Banana / Imagen Integration Test\n');
console.log('═'.repeat(50));

// List all available models
async function listModels() {
  console.log('\n📋 Fetching available models...\n');
  
  const response = await fetch(
    `${GEMINI_BASE_URL}/models?key=${GEMINI_API_KEY}`
  );
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.models || [];
}

// Test image generation with a specific model
async function testImageGeneration(model, prompt) {
  console.log(`\n🎨 Testing image generation with: ${model}`);
  console.log(`   Prompt: "${prompt.substring(0, 50)}..."`);
  
  const isImagen = model.includes('imagen');
  
  let payload, url;
  
  if (isImagen) {
    // Imagen API format (requires billing)
    url = `${GEMINI_BASE_URL}/models/${model}:predict?key=${GEMINI_API_KEY}`;
    payload = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '1:1',
      }
    };
  } else {
    // Gemini API format with native image generation
    url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    payload = {
      contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
      generationConfig: {
        responseModalities: ['Text', 'Image'],
      }
    };
  }
  
  const startTime = Date.now();
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error.substring(0, 200)}`);
  }
  
  const data = await response.json();
  
  // Extract image data
  let imageData;
  if (isImagen) {
    imageData = data.predictions?.[0]?.bytesBase64Encoded;
  } else {
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        break;
      }
    }
  }
  
  if (imageData) {
    const sizeKB = Math.round(imageData.length / 1024);
    console.log(`   ✅ Success! Generated ${sizeKB}KB image in ${elapsed}s`);
    return { success: true, model, sizeKB, elapsed };
  } else {
    console.log(`   ⚠️  No image data in response`);
    return { success: false, model, error: 'No image data' };
  }
}

async function main() {
  try {
    // 1. List all models
    const models = await listModels();
    
    // Group models by type
    const imageModels = [];
    const geminiModels = [];
    const otherModels = [];
    
    for (const m of models) {
      const name = m.name.replace('models/', '');
      const methods = m.supportedGenerationMethods || [];
      
      if (name.includes('imagen')) {
        imageModels.push({ name, methods });
      } else if (name.includes('gemini')) {
        geminiModels.push({ name, methods });
      } else {
        otherModels.push({ name, methods });
      }
    }
    
    // Display image generation models
    console.log('🖼️  Image Generation Models:');
    if (imageModels.length > 0) {
      for (const m of imageModels) {
        console.log(`   ✓ ${m.name}`);
        console.log(`     Methods: ${m.methods.join(', ') || 'N/A'}`);
      }
    } else {
      console.log('   (none found - may require different API access)');
    }
    
    // Display Gemini models with image capability
    console.log('\n🤖 Gemini Models (may support images):');
    const geminiWithImages = geminiModels.filter(m => 
      m.name.includes('flash') || m.name.includes('pro')
    ).slice(0, 5);
    for (const m of geminiWithImages) {
      console.log(`   • ${m.name}`);
    }
    if (geminiModels.length > 5) {
      console.log(`   ... and ${geminiModels.length - 5} more`);
    }
    
    // 2. Test image generation
    console.log('\n' + '═'.repeat(50));
    console.log('🧪 Testing Image Generation...');
    
    const testPrompt = 'Professional digital product cover, modern design, vibrant colors, abstract geometric patterns, dark background with glowing accents';
    
    // Test models in order of preference
    const modelsToTest = [
      'gemini-2.0-flash-exp',              // Gemini Flash (free, native image gen)
      'gemini-2.0-flash',                  // Gemini Flash stable
      'imagen-4.0-generate-001',           // Nano Banana (requires billing)
    ];
    
    const results = [];
    
    for (const model of modelsToTest) {
      try {
        const result = await testImageGeneration(model, testPrompt);
        results.push(result);
        if (result.success) break; // Stop on first success
      } catch (error) {
        console.log(`   ❌ ${model}: ${error.message.substring(0, 100)}`);
        results.push({ success: false, model, error: error.message });
      }
    }
    
    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 Summary:\n');
    
    const successfulModel = results.find(r => r.success);
    if (successfulModel) {
      console.log(`✅ Image generation is WORKING`);
      console.log(`   Best model: ${successfulModel.model}`);
      console.log(`   Performance: ${successfulModel.elapsed}s for ${successfulModel.sizeKB}KB image`);
      console.log('\n💡 To use this model, set in your .env:');
      console.log(`   GEMINI_IMAGE_MODEL=${successfulModel.model}`);
    } else {
      console.log('⚠️  No working image generation model found');
      console.log('   This could be due to:');
      console.log('   - API key doesn\'t have image generation access');
      console.log('   - Regional restrictions');
      console.log('   - Models not yet available for your account');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

