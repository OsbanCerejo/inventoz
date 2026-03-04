const { Products, ProductVendorPrice } = require("../models");

class PricingService {
  /**
   * Get all active vendor prices for a SKU with computed average
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
   * Compute average price for a SKU based on active vendor prices
   * (does not persist it on the product)
   * @param {string} sku
   */
  static async getAveragePriceForSku(sku) {
    const records = await ProductVendorPrice.findAll({
      where: { sku, isActive: true },
      attributes: ["price"],
    });

    if (!records.length) {
      return null;
    }

    const total = records.reduce(
      (sum, record) => sum + parseFloat(record.price),
      0
    );
    const avg = total / records.length;

    return Number(avg.toFixed(2));
  }

  /**
   * Recompute and persist average price for a SKU on the Products table
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
      vendor,
      price,
      currency,
      inboundCompositeSku,
      notes,
      isActive,
    } = data;

    if (!sku || !vendor || price === undefined || price === null) {
      throw new Error("sku, vendor, and price are required");
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice)) {
      throw new Error("price must be a valid number");
    }

    const createdBy = user && user.id ? user.id : null;

    const record = await ProductVendorPrice.create({
      sku,
      vendor,
      price: numericPrice,
      currency: currency || "USD",
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
   * Update an existing vendor price entry and recalculate average
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
      "vendor",
      "price",
      "currency",
      "inboundCompositeSku",
      "isActive",
      "notes",
    ];

    updatableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updates[field] = field === "price" ? Number(data[field]) : data[field];
      }
    });

    if (
      Object.prototype.hasOwnProperty.call(updates, "price") &&
      Number.isNaN(updates.price)
    ) {
      throw new Error("price must be a valid number");
    }

    await record.update(updates);

    const averagePrice = await this.recomputeAndPersistAveragePrice(
      record.sku
    );

    return {
      price: record,
      averagePrice,
    };
  }

  /**
   * Soft-delete a price entry (set isActive=false) and recalc average
   * @param {number} id
   */
  static async deletePrice(id) {
    const record = await ProductVendorPrice.findByPk(id);
    if (!record) {
      throw new Error("Price entry not found");
    }

    await record.update({ isActive: false });

    const averagePrice = await this.recomputeAndPersistAveragePrice(
      record.sku
    );

    return {
      price: record,
      averagePrice,
    };
  }

  /**
   * Convenience helper: create a price entry during inbound flow if price provided
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

