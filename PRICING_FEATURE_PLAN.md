## Pricing Feature – Development Plan

### Requirements
- **Per product (SKU)**: store multiple vendor prices + a computed average cost (for profit calculations).
- **Entry points**: add/update price during **Inbound** and on **Edit Product**.
- **Access**: **admin only** (no UI, data, routes, or menu exposure to any other role).

### Data model
- **New table**: `ProductVendorPrices`
  - `id, sku, vendor, price, currency, inboundCompositeSku` (optional), `isActive, createdAt, updatedAt, createdBy, notes`.
- **`Products` table**: add `averagePrice` (and optionally `lastPriceUpdate`).

### Backend work
- **Model**: `ProductVendorPrice`.
- **Service**: `PricingService` (CRUD + recompute average per SKU).
- **Routes**: `/product-vendor-prices` (GET by SKU, POST, PUT, DELETE, optional history/average).
- **Integrations**:
  - **Inbound create**: if price provided → create vendor price linked to inbound → recalc average.
  - **Product edit**: manage vendor prices → recalc average.
- **Permissions**: add `pricing` resource to role-permissions config for **admin only**.

### Frontend work (admin only)
- Add a **Pricing** section on:
  - `AddProduct` inbound area (vendor + price).
  - `InboundProduct` form (vendor + price).
  - `EditProduct` (manage vendor prices + show average).
- Wrap everything in existing guards (`PermissionGuard` / admin checks). No nav/menu items for non-admins.

### Workflow
- Admin enters vendor + unit cost during inbound or edits later → backend saves entry → recomputes `Products.averagePrice` → admin sees updated average and vendor list.