const express = require("express");
const Sequelize = require("sequelize");
const { Brands, Products } = require("../models");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");
const PermissionService = require("../Services/PermissionService");

const router = express.Router();
const { Op } = Sequelize;

const normalizeBrandName = (value) => String(value || "").trim();

const normalizeAbbreviation = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeNextNumber = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
};

const buildUsageMap = async () => {
  const rows = await Products.findAll({
    attributes: [
      "brand",
      [Sequelize.fn("COUNT", Sequelize.col("brand")), "productCount"],
    ],
    group: ["brand"],
    raw: true,
  });

  return new Map(
    (rows || []).map((row) => [
      String(row.brand || "").trim().toLowerCase(),
      Number.parseInt(String(row.productCount || 0), 10) || 0,
    ])
  );
};

const canManageBrandCounters = async (user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  const [canEditBrands, canCreateProducts] = await Promise.all([
    PermissionService.hasResourceAction(user, "brands", "edit"),
    PermissionService.hasResourceAction(user, "addProduct", "create"),
  ]);
  return canEditBrands || canCreateProducts;
};

router.get("/", auth, async (req, res) => {
  try {
    const { brandName } = req.query || {};
    const where = {};
    const normalizedBrandName = normalizeBrandName(brandName);

    if (normalizedBrandName) {
      where.brand = {
        [Op.eq]: normalizedBrandName,
      };
    }

    const [brands, usageMap] = await Promise.all([
      Brands.findAll({
        where,
        order: [["brand", "ASC"]],
      }),
      buildUsageMap(),
    ]);

    const payload = brands.map((brand) => {
      const plain = brand.toJSON();
      return {
        ...plain,
        nextNumber: normalizeNextNumber(plain.nextNumber),
        productCount: usageMap.get(normalizeBrandName(plain.brand).toLowerCase()) || 0,
      };
    });

    res.json(payload);
  } catch (error) {
    console.error("Get brands error:", error);
    res.status(500).json({
      error: "Failed to load brands. Please try again.",
    });
  }
});

router.post("/", auth, checkPermission("brands", "create"), async (req, res) => {
  try {
    const brandName = normalizeBrandName(req.body?.brand);
    const abbreviation = normalizeAbbreviation(req.body?.abbreviation);
    const nextNumber = normalizeNextNumber(req.body?.nextNumber);

    if (!brandName) {
      return res.status(400).json({ error: "Brand name is required." });
    }

    if (!/^[A-Z0-9]{3}$/.test(abbreviation)) {
      return res.status(400).json({
        error: "Abbreviation must be exactly 3 uppercase letters or numbers.",
      });
    }

    const [existingBrand, existingAbbreviation] = await Promise.all([
      Brands.findOne({
        where: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("brand")),
          brandName.toLowerCase()
        ),
      }),
      Brands.findOne({
        where: Sequelize.where(
          Sequelize.fn("UPPER", Sequelize.col("abbreviation")),
          abbreviation
        ),
      }),
    ]);

    if (existingBrand) {
      return res.status(409).json({ error: "That brand already exists." });
    }

    if (existingAbbreviation) {
      return res.status(409).json({ error: "That abbreviation is already in use." });
    }

    const created = await Brands.create({
      brand: brandName,
      abbreviation,
      nextNumber,
    });

    res.status(201).json({
      ...created.toJSON(),
      nextNumber,
      productCount: 0,
    });
  } catch (error) {
    console.error("Create brand error:", error);
    res.status(500).json({
      error: "Failed to create brand. Please try again.",
    });
  }
});

router.put("/:id", auth, checkPermission("brands", "edit"), async (req, res) => {
  try {
    const brandId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return res.status(400).json({ error: "Invalid brand ID." });
    }

    const brand = await Brands.findByPk(brandId);
    if (!brand) {
      return res.status(404).json({ error: "Brand not found." });
    }

    const abbreviation = normalizeAbbreviation(req.body?.abbreviation);
    const nextNumber = normalizeNextNumber(req.body?.nextNumber);

    if (!/^[A-Z0-9]{3}$/.test(abbreviation)) {
      return res.status(400).json({
        error: "Abbreviation must be exactly 3 uppercase letters or numbers.",
      });
    }

    const existingAbbreviation = await Brands.findOne({
      where: {
        id: { [Op.ne]: brandId },
        [Op.and]: Sequelize.where(
          Sequelize.fn("UPPER", Sequelize.col("abbreviation")),
          abbreviation
        ),
      },
    });

    if (existingAbbreviation) {
      return res.status(409).json({ error: "That abbreviation is already in use." });
    }

    brand.abbreviation = abbreviation;
    brand.nextNumber = nextNumber;
    await brand.save();

    const productCount = await Products.count({
      where: {
        brand: brand.brand,
      },
    });

    res.json({
      ...brand.toJSON(),
      nextNumber,
      productCount,
    });
  } catch (error) {
    console.error("Update brand error:", error);
    res.status(500).json({
      error: "Failed to update brand. Please try again.",
    });
  }
});

router.put("/:id/next-number", auth, async (req, res) => {
  try {
    const brandId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return res.status(400).json({ error: "Invalid brand ID." });
    }

    const canUpdate = await canManageBrandCounters(req.user);
    if (!canUpdate) {
      return res.status(403).json({
        error: "Access denied. You do not have permission to update brand counters.",
      });
    }

    const brand = await Brands.findByPk(brandId);
    if (!brand) {
      return res.status(404).json({ error: "Brand not found." });
    }

    const nextNumber = normalizeNextNumber(req.body?.nextNumber);
    brand.nextNumber = nextNumber;
    await brand.save();

    res.json({
      ...brand.toJSON(),
      nextNumber,
    });
  } catch (error) {
    console.error("Update brand next number error:", error);
    res.status(500).json({
      error: "Failed to update brand counter. Please try again.",
    });
  }
});

module.exports = router;
