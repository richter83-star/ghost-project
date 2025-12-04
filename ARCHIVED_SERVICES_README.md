# Archived Services

This directory contains old services that have been consolidated into the unified `GhostSystems/` service.

## Archived Services

### autonomous-commerce-pipeline/
**Status:** ✅ Consolidated into `GhostSystems/`

**Consolidated into:**
- `GhostSystems/src/lib/shopify.ts` - Unified Shopify client
- `GhostSystems/src/lib/gemini.ts` - AI content generation  
- `GhostSystems/src/integrations/shopify-pipeline.ts` - Product publishing pipeline

**Date Archived:** 2025-01-XX
**Reason:** Functionality merged into unified Node.js service for better maintainability

---

### digital-delivery-service/
**Status:** ✅ Consolidated into `GhostSystems/`

**Consolidated into:**
- `GhostSystems/src/cloud/routes/shopify.ts` - Webhook handlers

**Date Archived:** 2025-01-XX
**Reason:** Webhook functionality merged into main Express server

---

## Migration Notes

All functionality from these services has been:
- ✅ Migrated to TypeScript/Node.js
- ✅ Integrated into unified service
- ✅ Using standardized configuration (SHOPIFY_STORE_URL, SHOPIFY_ADMIN_API_TOKEN)
- ✅ Using consistent API version (2025-01)
- ✅ Deployed as single service on Render

**Do not use these archived services in production.** Use `GhostSystems/` instead.

