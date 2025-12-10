import config from './config.js';

function validateJobData(data = {}) {
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    throw new Error('Product title is required');
  }

  if (data.price === undefined || data.price === null || Number.isNaN(Number(data.price))) {
    throw new Error('Product price must be provided as a number');
  }

  const numericPrice = Number(data.price);
  if (numericPrice <= 0) {
    throw new Error('Product price must be greater than zero');
  }

  if (!data.productType || typeof data.productType !== 'string' || !data.productType.trim()) {
    throw new Error('Product type is required');
  }

  const deliveryType = data.deliveryType && data.deliveryType.trim() ? data.deliveryType : 'digital';
  if (deliveryType !== 'digital') {
    throw new Error('Only digital delivery is supported at this time');
  }

  return {
    title: data.title.trim(),
    description: (data.description || '').trim(),
    productType: data.productType.trim(),
    price: numericPrice,
    deliveryType,
    digitalContent: data.digitalContent || null,
    tags: Array.isArray(data.tags) ? data.tags : undefined,
    imageUrl: data.imageUrl || null,
  };
}

function isDescriptionMissing(description) {
  if (!description) return true;
  return description.trim().length < config.validation.minDescriptionLength;
}

export { validateJobData, isDescriptionMissing };
export default { validateJobData, isDescriptionMissing };
