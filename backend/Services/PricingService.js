const { Products, ProductVendorPrice } = require("../models");

class PricingService {
  static getExpectedPriceConfig() {
    const marginPercent = Number(process.env.PRICE_SCANNER_MARGIN_PERCENT || 30);
    const fixedFee = Number(process.env.PRICE_SCANNER_FIXED_FEE || 0);

    return {
      marginPercent: Number.isFinite(marginPercent) ? marginPercent : 30,
      fixedFee: Number.isFinite(fixedFee) ? fixedFee : 0,
    };
  }

  /**
   * Calculate an expected selling price from average cost.
   * Default formula targets a profit margin: price = cost / (1 - margin).
   * A fixed fee can be added, then the result is rounded up to the nearest dollar.
   * @param {number|string|null} averageCost
   */
  static calculateExpectedSellingPrice(averageCost) {
    const cost = Number(averageCost);
    if (!Number.isFinite(cost) || cost <= 0) {
      return {
        expectedPrice: null,
        averageCost: null,
        formula: this.getExpectedPriceConfig(),
      };
    }

    const formula = this.getExpectedPriceConfig();
    const marginRate = Math.min(Math.max(formula.marginPercent / 100, 0), 0.95);
    const basePrice = cost / (1 - marginRate) + formula.fixedFee;
    const expectedPrice = Math.ceil(basePrice);

    return {
      expectedPrice: Number(Math.max(expectedPrice, cost).toFixed(2)),
      averageCost: Number(cost.toFixed(2)),
      formula,
    };
  }

  /**
   * Get all active vendor prices for a SKU with computed weighted average
   * @param {string} sku
   */
  static async getPricesBySku(sku) {
    const prices = await ProductVendorPrice.findAll({
      where: { sku, isActive: true },
      order: [["createdAt", "DESC"]],
    });

    const averagePrice = await this.getAveragePriceForSku(sku);

    return {
      sku,
      averagePrice,
      vendorPrices: prices,
    };
  }

  /**
   * Compute weighted average price for a SKU based on active vendor prices.
   * Formula: sum(price * quantity) / sum(quantities)
   * @param {string} sku
   */
  static async getAveragePriceForSku(sku) {
    const records = await ProductVendorPrice.findAll({
      where: { sku, isActive: true },
      attributes: ["price", "quantity"],
    });

    if (!records.length) {
      return null;
    }

    let totalCost = 0;
    let totalQuantity = 0;

    for (const record of records) {
      const price = parseFloat(record.price);
      const qty = parseInt(record.quantity, 10) || 1;
      totalCost += price * qty;
      totalQuantity += qty;
    }

    if (totalQuantity === 0) {
      return null;
    }

    const avg = totalCost / totalQuantity;
    return Number(avg.toFixed(2));
  }

  /**
   * Recompute and persist weighted average price for a SKU on the Products table
   * @param {string} sku
   */
  static async recomputeAndPersistAveragePrice(sku) {
    const averagePrice = await this.getAveragePriceForSku(sku);

    const updatePayload =
      averagePrice === null
        ? { averagePrice: null, lastPriceUpdate: null }
        : { averagePrice, lastPriceUpdate: new Date() };

    await Products.update(updatePayload, { where: { sku } });

    return averagePrice;
  }

  /**
   * Create a new vendor price entry and update product average price
   * @param {Object} data
   * @param {Object} user - authenticated user (for createdBy)
   */
  static async createPrice(data, user) {
    const {
      sku,
      vendorInvoiceNumber,
      vendor, // backwards compatibility with old payloads
      vendorName,
      price,
      quantity,
      inboundCompositeSku,
      notes,
      isActive,
    } = data;

    const resolvedVendorInvoiceNumber = vendorInvoiceNumber || vendor;

    if (!sku || !resolvedVendorInvoiceNumber || price === undefined || price === null) {
      throw new Error("sku, vendorInvoiceNumber, and price are required");
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice)) {
      throw new Error("price must be a valid number");
    }

    const numericQuantity = quantity !== undefined && quantity !== null ? parseInt(quantity, 10) : 1;
    if (Number.isNaN(numericQuantity) || numericQuantity < 1) {
      throw new Error("quantity must be a positive integer");
    }

    const createdBy = user && user.id ? user.id : null;

    const record = await ProductVendorPrice.create({
      sku,
      vendorInvoiceNumber: resolvedVendorInvoiceNumber,
      vendorName: vendorName || vendor || null,
      price: numericPrice,
      quantity: numericQuantity,
      inboundCompositeSku: inboundCompositeSku || null,
      isActive: isActive !== undefined ? isActive : true,
      createdBy,
      notes: notes || null,
    });

    const averagePrice = await this.recomputeAndPersistAveragePrice(sku);

    return {
      price: record,
      averagePrice,
    };
  }

  /**
   * Update an existing vendor price entry and recalculate weighted average
   * @param {number} id
   * @param {Object} data
   */
  static async updatePrice(id, data) {
    const record = await ProductVendorPrice.findByPk(id);
    if (!record) {
      throw new Error("Price entry not found");
    }

    const updates = {};
    const updatableFields = [
      "vendorInvoiceNumber",
      "vendor", // backwards compatibility
      "vendorName",
      "price",
      "quantity",
      "inboundCompositeSku",
      "isActive",
      "notes",
    ];

    updatableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        if (field === "price") {
          updates[field] = Number(data[field]);
        } else if (field === "quantity") {
          updates[field] = parseInt(data[field], 10);
        } else if (field === "vendor") {
          // map legacy 'vendor' to 'vendorInvoiceNumber'
          updates.vendorInvoiceNumber = data[field];
        } else {
          updates[field] = data[field];
        }
      }
    });

    if (
      Object.prototype.hasOwnProperty.call(updates, "price") &&
      Number.isNaN(updates.price)
    ) {
      throw new Error("price must be a valid number");
    }

    if (
      Object.prototype.hasOwnProperty.call(updates, "quantity") &&
      (Number.isNaN(updates.quantity) || updates.quantity < 1)
    ) {
      throw new Error("quantity must be a positive integer");
    }

    await record.update(updates);

    const averagePrice = await this.recomputeAndPersistAveragePrice(record.sku);

    return {
      price: record,
      averagePrice,
    };
  }

  /**
   * Soft-delete a price entry (set isActive=false) and recalc weighted average
   * @param {number} id
   */
  static async deletePrice(id) {
    const record = await ProductVendorPrice.findByPk(id);
    if (!record) {
      throw new Error("Price entry not found");
    }

    await record.update({ isActive: false });

    const averagePrice = await this.recomputeAndPersistAveragePrice(record.sku);

    return {
      price: record,
      averagePrice,
    };
  }

  /**
   * Convenience helper: create a price entry during inbound flow if price provided.
   * Only call this when a brand-new inbound record was created.
   * @param {Object} data
   * @param {Object} user
   */
  static async createPriceFromInbound(data, user) {
    const { price } = data;

    if (price === undefined || price === null || price === "") {
      return null;
    }

    return this.createPrice(data, user);
  }
}

module.exports = PricingService;
