const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { Op } = require('sequelize');
const crypto = require('crypto');
const {
  sequelize,
  WhatnotShow,
  WhatnotShipmentImport,
  WhatnotShipmentItem,
  WhatnotFailedOrder,
  WhatnotShipmentScan,
  Products,
  ProductDetails,
  User,
} = require('../models');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

const router = express.Router();
const FLASH_SALE_STICKER = 'WHATNOT-FLASH-SALE';
const RAID_GIVEAWAY_STICKER = 'RAID-GIVEAWAY';
const BUYERS_GIVEAWAY_STICKER = 'BUYERS-GIVEAWAY';
const COFFEE_STICKER = 'COFFEE';
const SPONSORED_GIVEAWAY_STICKER = 'SPONSORED-GIVEAWAY';
const OTHERS_STICKER = 'OTHERS';
const ITEM_CATEGORY_AUCTION = 'auction';
const ITEM_CATEGORY_WHATNOT_FLASH_SALE = 'whatnot_flash_sale';
const ITEM_CATEGORY_RAID_GIVEAWAY = 'raid_giveaway';
const ITEM_CATEGORY_BUYERS_GIVEAWAY = 'buyers_giveaway';
const ITEM_CATEGORY_RANDOM_GIVEAWAY = 'random_giveaway';
const ITEM_CATEGORY_COFFEE = 'coffee';
const ITEM_CATEGORY_SPONSORED_GIVEAWAY = 'sponsored_giveaway';
const ITEM_CATEGORY_OTHERS = 'others';
const EXCLUDED_PENDING_SHIPMENT_CATEGORIES = new Set([
  ITEM_CATEGORY_RANDOM_GIVEAWAY,
]);
const FLASH_SALE_TOKEN = FLASH_SALE_STICKER.replace(/[^A-Z0-9-]/g, '');
const RAID_GIVEAWAY_TOKEN = RAID_GIVEAWAY_STICKER.replace(/[^A-Z0-9-]/g, '');
const BUYERS_GIVEAWAY_TOKEN = BUYERS_GIVEAWAY_STICKER.replace(/[^A-Z0-9-]/g, '');
const COFFEE_TOKEN = COFFEE_STICKER.replace(/[^A-Z0-9-]/g, '');
const SPONSORED_GIVEAWAY_TOKEN = SPONSORED_GIVEAWAY_STICKER.replace(/[^A-Z0-9-]/g, '');
const OTHERS_TOKEN = OTHERS_STICKER.replace(/[^A-Z0-9-]/g, '');
const NON_AUCTION_ROW_STICKER = 'NON-AUCTION-ITEMS';
const SPECIAL_NON_AUCTION_STICKERS = [
  FLASH_SALE_STICKER,
  RAID_GIVEAWAY_STICKER,
  BUYERS_GIVEAWAY_STICKER,
  COFFEE_STICKER,
  SPONSORED_GIVEAWAY_STICKER,
  OTHERS_STICKER,
];
const NON_AUCTION_INSTANCE_PREFIX = 'NON-AUCTION-CONTEXT:';
const EDIT_PIN_SECRET = String(process.env.WHATNOT_FULFILLMENT_EDIT_PIN || '').trim();
const EDIT_PIN_SECRET_HASH = String(process.env.WHATNOT_FULFILLMENT_EDIT_PIN_HASH || '').trim().toLowerCase();
const LOCK_TTL_MS = 30 * 60 * 1000;
const PIN_MAX_ATTEMPTS = 5;
const PIN_BLOCK_WINDOW_MS = 5 * 60 * 1000;
const shipmentLocks = new Map();
const pinAttemptMap = new Map();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const normalizeText = (value) => String(value || '').trim();
const normalizeTracking = (value) => {
  const raw = normalizeText(value);
  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) return '';
  if (digitsOnly.length >= 22) {
    return digitsOnly.slice(-22);
  }
  return digitsOnly;
};
const normalizeSticker = (value) =>
  normalizeText(value)
    .replace(/^#+/, '')
    .trim();
const normalizeScanToken = (value) =>
  normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
const looksLikeAuctionSticker = (value) => {
  const token = normalizeSticker(value);
  return token.length > 0 && token.length <= 4;
};
const getSpecialNonAuctionContext = (value) => {
  const token = normalizeScanToken(value);
  if (!token) return null;
  if (token.includes(FLASH_SALE_TOKEN)) return FLASH_SALE_STICKER;
  if (token.includes(RAID_GIVEAWAY_TOKEN)) return RAID_GIVEAWAY_STICKER;
  if (token.includes(BUYERS_GIVEAWAY_TOKEN)) return BUYERS_GIVEAWAY_STICKER;
  if (token.includes(COFFEE_TOKEN)) return COFFEE_STICKER;
  if (token.includes(SPONSORED_GIVEAWAY_TOKEN)) return SPONSORED_GIVEAWAY_STICKER;
  if (token.includes(OTHERS_TOKEN)) return OTHERS_STICKER;
  return null;
};
const buildNonAuctionInstanceKey = (scanId) => `${NON_AUCTION_INSTANCE_PREFIX}${Number(scanId)}`;
const parseNonAuctionInstanceId = (value) => {
  const raw = normalizeText(value);
  if (!raw.startsWith(NON_AUCTION_INSTANCE_PREFIX)) return null;
  const idPart = raw.slice(NON_AUCTION_INSTANCE_PREFIX.length);
  const parsed = Number(idPart);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};
const isNonAuctionInstanceKey = (value) => Boolean(parseNonAuctionInstanceId(value));
const hashPin = (pin) => crypto.createHash('sha256').update(String(pin)).digest('hex');
const safeStringEqual = (left, right) => {
  const l = Buffer.from(String(left || ''));
  const r = Buffer.from(String(right || ''));
  if (l.length !== r.length) return false;
  return crypto.timingSafeEqual(l, r);
};
const hasConfiguredEditPin = () => Boolean(EDIT_PIN_SECRET || EDIT_PIN_SECRET_HASH);
const isValidEditPin = (pin) => {
  const normalized = normalizeText(pin);
  if (!normalized || !hasConfiguredEditPin()) return false;
  if (EDIT_PIN_SECRET_HASH) {
    return safeStringEqual(hashPin(normalized), EDIT_PIN_SECRET_HASH);
  }
  return safeStringEqual(normalized, EDIT_PIN_SECRET);
};
const getRequesterIdentity = (req) => {
  const userId = req.user ? String(req.user.id) : 'anonymous';
  const ip = normalizeText(req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown');
  return `${userId}:${ip}`;
};
const getPinRateState = (identityKey) => {
  const now = Date.now();
  const state = pinAttemptMap.get(identityKey);
  if (!state) {
    return { attempts: 0, blockedUntil: 0 };
  }
  if (state.blockedUntil && state.blockedUntil <= now) {
    pinAttemptMap.delete(identityKey);
    return { attempts: 0, blockedUntil: 0 };
  }
  return state;
};
const recordFailedPinAttempt = (identityKey) => {
  const now = Date.now();
  const state = getPinRateState(identityKey);
  const attempts = Number(state.attempts || 0) + 1;
  const nextState = {
    attempts,
    blockedUntil: attempts >= PIN_MAX_ATTEMPTS ? now + PIN_BLOCK_WINDOW_MS : 0,
  };
  pinAttemptMap.set(identityKey, nextState);
  return nextState;
};
const clearPinRateState = (identityKey) => {
  pinAttemptMap.delete(identityKey);
};
const lockKeyForShipment = (showId, importId, shipmentId) =>
  `${Number(showId)}:${Number(importId)}:${normalizeText(shipmentId)}`;
const getShipmentLockState = (showId, importId, shipmentId) => {
  const key = lockKeyForShipment(showId, importId, shipmentId);
  const entry = shipmentLocks.get(key);
  if (!entry) return null;
  if (Date.now() - Number(entry.touchedAt || 0) > LOCK_TTL_MS) {
    shipmentLocks.delete(key);
    return null;
  }
  return { key, entry };
};
const acquireOrRefreshShipmentLock = ({ showId, importId, shipmentId, userId }) => {
  const state = getShipmentLockState(showId, importId, shipmentId);
  const now = Date.now();
  const normalizedUser = normalizeText(userId);
  if (!state) {
    const key = lockKeyForShipment(showId, importId, shipmentId);
    shipmentLocks.set(key, {
      userId: normalizedUser,
      touchedAt: now,
    });
    return { ok: true };
  }
  if (state.entry.userId !== normalizedUser) {
    return {
      ok: false,
      lockedBy: state.entry.userId || 'another user',
    };
  }
  shipmentLocks.set(state.key, {
    ...state.entry,
    touchedAt: now,
  });
  return { ok: true };
};
const releaseShipmentLock = ({ showId, importId, shipmentId, userId = null, force = false }) => {
  const state = getShipmentLockState(showId, importId, shipmentId);
  if (!state) return;
  if (force || normalizeText(state.entry.userId) === normalizeText(userId)) {
    shipmentLocks.delete(state.key);
  }
};

const parseQuantity = (rawValue) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.round(parsed));
};

const parseMoney = (rawValue) => {
  const normalized = normalizeText(rawValue).replace(/[^0-9.-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const parseShowElapsedSeconds = (rawValue) => {
  const normalized = normalizeText(rawValue);
  if (!normalized) return null;
  const match = normalized.match(/^(?:(\d+):)?(\d{1,2})(?::(\d{1,2}))?(?:\.(\d+))?$/);
  if (!match) return null;
  const first = match[1] ? Number(match[1]) : null;
  const second = Number(match[2] || 0);
  const third = match[3] ? Number(match[3]) : null;
  const fractional = match[4] ? Number(`0.${match[4]}`) : 0;
  if (first !== null && third !== null) {
    return first * 3600 + second * 60 + third + fractional;
  }
  if (first === null && third === null) {
    return second * 60 + fractional;
  }
  return null;
};

const parseDateTime = (rawValue) => {
  const normalized = normalizeText(rawValue);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const normalizeCsvHeader = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getCsvValue = (row, ...candidateHeaders) => {
  if (!row || typeof row !== 'object') return '';

  for (const header of candidateHeaders) {
    if (
      Object.prototype.hasOwnProperty.call(row, header) &&
      row[header] !== undefined &&
      row[header] !== null &&
      normalizeText(row[header]) !== ''
    ) {
      return row[header];
    }
  }

  const normalizedCandidates = candidateHeaders.map(normalizeCsvHeader);
  for (const [key, value] of Object.entries(row)) {
    if (
      normalizedCandidates.includes(normalizeCsvHeader(key)) &&
      value !== undefined &&
      value !== null &&
      normalizeText(value) !== ''
    ) {
      return value;
    }
  }

  return '';
};

const isRonnieAuctionItem = (productName) => {
  const name = normalizeText(productName).toLowerCase();
  return name.includes('$1 starts w/ronnie');
};
const extractCategoryTag = (descriptionText) => {
  const raw = normalizeText(descriptionText).toUpperCase();
  if (!raw) return null;
  const match = raw.match(/\[(AUC|WFS|CFE|RGY|BGY|GVY|SGY|OTH)\]/);
  return match ? match[1] : null;
};
const extractAnyBracketedTag = (descriptionText) => {
  const raw = normalizeText(descriptionText).toUpperCase();
  if (!raw) return null;
  const match = raw.match(/\[([A-Z-]+)\]/);
  return match ? match[1] : null;
};
const parseItemCategory = ({ productName, descriptionText }) => {
  const tag = extractCategoryTag(descriptionText);
  if (tag === 'AUC') return { itemCategory: ITEM_CATEGORY_AUCTION, reviewReason: null };
  if (tag === 'WFS') {
    return { itemCategory: ITEM_CATEGORY_WHATNOT_FLASH_SALE, reviewReason: null };
  }
  if (tag === 'GVY') return { itemCategory: ITEM_CATEGORY_RANDOM_GIVEAWAY, reviewReason: null };
  if (tag === 'BGY') return { itemCategory: ITEM_CATEGORY_BUYERS_GIVEAWAY, reviewReason: null };
  if (tag === 'CFE') return { itemCategory: ITEM_CATEGORY_COFFEE, reviewReason: null };
  if (tag === 'RGY') return { itemCategory: ITEM_CATEGORY_RAID_GIVEAWAY, reviewReason: null };
  if (tag === 'SGY') {
    return { itemCategory: ITEM_CATEGORY_SPONSORED_GIVEAWAY, reviewReason: null };
  }
  if (tag === 'OTH') return { itemCategory: ITEM_CATEGORY_OTHERS, reviewReason: null };

  const explicitTag = extractAnyBracketedTag(descriptionText);
  if (explicitTag) {
    return {
      itemCategory: ITEM_CATEGORY_OTHERS,
      reviewReason: `Unsupported item category tag [${explicitTag}] found in one or more rows.`,
    };
  }

  if (isRonnieAuctionItem(productName) || extractStickerNumber(productName)) {
    return { itemCategory: ITEM_CATEGORY_AUCTION, reviewReason: null };
  }

  return {
    itemCategory: ITEM_CATEGORY_OTHERS,
    reviewReason:
      'Missing item category tag in one or more rows. Use [AUC], [WFS], [CFE], [RGY], [BGY], [GVY], [SGY], or [OTH].',
  };
};
const getRowItemCategory = (row) => {
  const explicitCategory = normalizeText(row?.itemCategory);
  if (explicitCategory) return explicitCategory;
  return row?.isAuctionItem ? ITEM_CATEGORY_AUCTION : ITEM_CATEGORY_OTHERS;
};
const buildFailedAuctionKey = ({ buyer, stickerNumber }) =>
  `${normalizeText(buyer).toLowerCase()}::${normalizeSticker(stickerNumber).toLowerCase()}`;
const getNonAuctionContextForRow = (row) => {
  const category = getRowItemCategory(row);
  if (category === ITEM_CATEGORY_WHATNOT_FLASH_SALE) {
    return FLASH_SALE_STICKER;
  }
  if (category === ITEM_CATEGORY_RAID_GIVEAWAY) {
    return RAID_GIVEAWAY_STICKER;
  }
  if (category === ITEM_CATEGORY_BUYERS_GIVEAWAY) {
    return BUYERS_GIVEAWAY_STICKER;
  }
  if (category === ITEM_CATEGORY_COFFEE) {
    return COFFEE_STICKER;
  }
  if (category === ITEM_CATEGORY_SPONSORED_GIVEAWAY) {
    return SPONSORED_GIVEAWAY_STICKER;
  }
  if (category === ITEM_CATEGORY_OTHERS) {
    return OTHERS_STICKER;
  }
  return null;
};
const isRequiredNonAuctionCategory = (category) =>
  [
    ITEM_CATEGORY_WHATNOT_FLASH_SALE,
    ITEM_CATEGORY_COFFEE,
    ITEM_CATEGORY_RAID_GIVEAWAY,
    ITEM_CATEGORY_BUYERS_GIVEAWAY,
    ITEM_CATEGORY_SPONSORED_GIVEAWAY,
  ].includes(category);
const isAutoApprovedNonAuctionCategory = (category) => category === ITEM_CATEGORY_RANDOM_GIVEAWAY;
const isOptionalNonAuctionCategory = (category) => category === ITEM_CATEGORY_OTHERS;
const isCloseRelevantNonAuctionRow = (row) => {
  const category = getRowItemCategory(row);
  return isRequiredNonAuctionCategory(category) || isAutoApprovedNonAuctionCategory(category);
};
const getNonAuctionDisplayTitle = (rowOrCategory) => {
  const category =
    typeof rowOrCategory === 'string' ? rowOrCategory : getRowItemCategory(rowOrCategory);
  const productName =
    typeof rowOrCategory === 'string' ? '' : normalizeText(rowOrCategory?.productName);
  if (category === ITEM_CATEGORY_WHATNOT_FLASH_SALE) return 'Whatnot Flash Sale';
  if (productName) return productName;
  if (category === ITEM_CATEGORY_RAID_GIVEAWAY) return 'Raid Giveaway';
  if (category === ITEM_CATEGORY_BUYERS_GIVEAWAY) return 'Buyers Giveaway';
  if (category === ITEM_CATEGORY_RANDOM_GIVEAWAY) return 'Random Giveaway';
  if (category === ITEM_CATEGORY_COFFEE) return 'Coffee';
  if (category === ITEM_CATEGORY_SPONSORED_GIVEAWAY) return 'Sponsored Giveaway';
  if (category === ITEM_CATEGORY_OTHERS) return 'Others';
  return 'Non Auction Item';
};
const toUserDisplayName = (user) => {
  if (!user) return null;
  const name = normalizeText(user.name);
  if (name) return name;
  const username = normalizeText(user.username);
  if (username) return username;
  return null;
};

const extractStickerNumber = (productName) => {
  const raw = normalizeText(productName);
  if (!raw) return null;
  const match = raw.match(/#\s*([A-Za-z0-9-]+)/);
  if (!match || !match[1]) return null;
  const normalized = normalizeSticker(match[1]);
  return normalized || null;
};

const getAuctionRows = (rows) => rows.filter((row) => Boolean(row.isAuctionItem));
const getNonAuctionRows = (rows) => rows.filter((row) => !row.isAuctionItem);
const isAutoApprovedNonAuctionRow = (row) =>
  !row?.isAuctionItem && isAutoApprovedNonAuctionCategory(getRowItemCategory(row));
const getActionableNonAuctionRows = (rows) =>
  getNonAuctionRows(rows).filter((row) => getNonAuctionContextForRow(row));

const deriveShipmentRowStatus = (row, scannedQty) => {
  if (normalizeText(row?.status) === 'pending_review') return 'pending_review';
  const expectedQty = Math.max(0, Number(row?.expectedQty || 0));
  if (scannedQty <= 0) return 'ready';
  if (expectedQty > 0 && scannedQty >= expectedQty) return 'completed';
  return 'in_progress';
};

const syncNonAuctionRowsToContexts = async ({
  shipmentRows,
  nonAuctionContexts = [],
  transaction = null,
}) => {
  const nonAuctionRows = getActionableNonAuctionRows(shipmentRows);
  if (!nonAuctionRows.length) return;

  const contextCountsByType = (nonAuctionContexts || []).reduce((acc, contextRow) => {
    const contextType = normalizeText(contextRow?.contextType);
    if (!contextType) return acc;
    acc[contextType] = Number(acc[contextType] || 0) + 1;
    return acc;
  }, {});

  for (const contextType of SPECIAL_NON_AUCTION_STICKERS) {
    const rowsForType = nonAuctionRows.filter(
      (row) => getNonAuctionContextForRow(row) === contextType
    );
    if (!rowsForType.length) continue;

    let remainingContexts = Number(contextCountsByType[contextType] || 0);
    for (const row of rowsForType) {
      const expectedQty = Math.max(0, Number(row.expectedQty || 0));
      const targetScannedQty = Math.max(0, Math.min(expectedQty, remainingContexts));
      remainingContexts = Math.max(0, remainingContexts - targetScannedQty);
      const targetStatus = deriveShipmentRowStatus(row, targetScannedQty);

      if (
        Number(row.scannedQty || 0) !== targetScannedQty ||
        normalizeText(row.status) !== targetStatus
      ) {
        await row.update(
          {
            scannedQty: targetScannedQty,
            status: targetStatus,
          },
          { transaction }
        );
        row.scannedQty = targetScannedQty;
        row.status = targetStatus;
      }
    }
  }
};

const sortAuctionRowsForOrder = (rows) => {
  return [...rows].sort((a, b) => {
    const aNum = Number(a.stickerNumber);
    const bNum = Number(b.stickerNumber);
    const aNumeric = Number.isFinite(aNum);
    const bNumeric = Number.isFinite(bNum);
    if (aNumeric && bNumeric) return aNum - bNum;
    return normalizeText(a.stickerNumber).localeCompare(normalizeText(b.stickerNumber), undefined, {
      numeric: true,
    });
  });
};

const buildAuctionChecklist = (rows) => {
  const grouped = new Map();
  for (const row of getAuctionRows(rows)) {
    const key = row.stickerNumber || '__MISSING__';
    if (!grouped.has(key)) {
      grouped.set(key, {
        stickerNumber: row.stickerNumber || null,
        expectedQty: 0,
        scannedQty: 0,
      });
    }
    const item = grouped.get(key);
    item.expectedQty += Number(row.expectedQty || 0);
    item.scannedQty += Number(row.scannedQty || 0);
  }

  return Array.from(grouped.values())
    .filter((item) => !!item.stickerNumber)
    .sort((a, b) => a.stickerNumber.localeCompare(b.stickerNumber, undefined, { numeric: true }));
};

const summarizeShipment = (
  rows,
  productLinksBySticker = {},
  linkedProductsBySticker = {},
  options = {}
) => {
  const auctionChecklist = buildAuctionChecklist(rows);
  const nonAuctionRows = getNonAuctionRows(rows);
  const closeRelevantNonAuctionRows = nonAuctionRows.filter((row) => isCloseRelevantNonAuctionRow(row));
  const nonAuctionExpectedItems = closeRelevantNonAuctionRows.reduce(
    (sum, row) => sum + Number(row.expectedQty || 0),
    0
  );
  const nonAuctionScannedItems = closeRelevantNonAuctionRows.reduce(
    (sum, row) => sum + Number(row.scannedQty || 0),
    0
  );
  const nonAuctionRemainingItems = Math.max(0, nonAuctionExpectedItems - nonAuctionScannedItems);
  const lastNonAuctionContext = normalizeText(options.lastNonAuctionContext);
  const nonAuctionTitleQueues = getActionableNonAuctionRows(rows).reduce((acc, row) => {
    const contextType = getNonAuctionContextForRow(row);
    if (!contextType) return acc;
    if (!acc[contextType]) acc[contextType] = [];
    const title = getNonAuctionDisplayTitle(row);
    const repetitions = Math.max(1, Number(row.expectedQty || 0));
    for (let index = 0; index < repetitions; index += 1) {
      acc[contextType].push({
        displayTitle: title,
        category: getRowItemCategory(row),
      });
    }
    return acc;
  }, {});

  const checklistWithLinks = auctionChecklist.map((item) => {
    const stickerKey = normalizeSticker(item.stickerNumber);
    const linkedProductScans = Number(productLinksBySticker[stickerKey] || 0);
    const pendingProductLinks = Number(item.scannedQty || 0) > 0 && linkedProductScans === 0 ? 1 : 0;
    return {
      ...item,
      linkedProductScans,
      pendingProductLinks,
      linkedProducts: linkedProductsBySticker[stickerKey] || [],
    };
  });
  if (nonAuctionExpectedItems > 0) {
    const nonAuctionContexts = Array.isArray(options.nonAuctionContexts)
      ? options.nonAuctionContexts
      : [];
    const sortedContexts = [...nonAuctionContexts].sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

    sortedContexts.forEach((contextRow, index) => {
      const instanceKey = normalizeText(contextRow.instanceKey);
      if (!instanceKey) return;
      const linkedCount = Number(productLinksBySticker[instanceKey] || 0);
      const contextType = contextRow.contextType || null;
      const contextTitleQueue = contextType ? nonAuctionTitleQueues[contextType] || [] : [];
      const titleEntry = contextTitleQueue.length > 0 ? contextTitleQueue.shift() : null;
      const category = titleEntry?.category || null;
      const displayTitle = titleEntry?.displayTitle || getNonAuctionDisplayTitle(contextType);
      const requiresLinkedProduct = Boolean(
        category ? isRequiredNonAuctionCategory(category) : ![OTHERS_STICKER].includes(contextType)
      );
      checklistWithLinks.push({
        stickerNumber: instanceKey,
        expectedQty: 1,
        scannedQty: 1,
        linkedProductScans: linkedCount,
        pendingProductLinks: requiresLinkedProduct && linkedCount < 1 ? 1 : 0,
        linkedProducts: (linkedProductsBySticker[instanceKey] || []).map((entry) => ({
          ...entry,
          contextSticker: instanceKey,
        })),
        nonAuctionContext: contextType,
        nonAuctionContextIndex: index + 1,
        displayTitle,
      });
    });
  }

  Object.entries(nonAuctionTitleQueues).forEach(([contextType, entries]) => {
    entries.forEach((entry, index) => {
      checklistWithLinks.push({
        stickerNumber: `${NON_AUCTION_ROW_STICKER}:${contextType}:${index + 1}`,
        expectedQty: 1,
        scannedQty: 0,
        linkedProductScans: 0,
        pendingProductLinks: 0,
        linkedProducts: [],
        nonAuctionContext: contextType,
        nonAuctionContextIndex: index + 1,
        displayTitle: entry.displayTitle,
      });
    });
  });

  nonAuctionRows
    .filter((row) => !getNonAuctionContextForRow(row) && isAutoApprovedNonAuctionRow(row))
    .forEach((row, rowIndex) => {
      const repetitions = Math.max(1, Number(row.expectedQty || 0));
      for (let unitIndex = 0; unitIndex < repetitions; unitIndex += 1) {
        checklistWithLinks.push({
          stickerNumber: `AUTO-NON-AUCTION:${rowIndex + 1}:${unitIndex + 1}`,
          expectedQty: 1,
          scannedQty: 1,
          linkedProductScans: 0,
          pendingProductLinks: 0,
          linkedProducts: [],
          displayTitle: getNonAuctionDisplayTitle(row),
        });
      }
    });

  const auctionExpectedItems = auctionChecklist.reduce((sum, item) => sum + item.expectedQty, 0);
  const auctionScannedItems = auctionChecklist.reduce((sum, item) => sum + item.scannedQty, 0);
  const auctionRemainingItems = Math.max(0, auctionExpectedItems - auctionScannedItems);
  const checklistPendingProductLinks = checklistWithLinks.reduce(
    (sum, item) => sum + Number(item.pendingProductLinks || 0),
    0
  );

  const totalExpectedItems = rows.reduce((sum, row) => {
    if (!row.isAuctionItem && isOptionalNonAuctionCategory(getRowItemCategory(row))) return sum;
    return sum + Number(row.expectedQty || 0);
  }, 0);
  const totalScannedItems = rows.reduce((sum, row) => {
    if (!row.isAuctionItem && isOptionalNonAuctionCategory(getRowItemCategory(row))) return sum;
    return sum + Number(row.scannedQty || 0);
  }, 0);
  const totalRemainingItems = Math.max(0, totalExpectedItems - totalScannedItems);
  const categoryCounts = rows.reduce((acc, row) => {
    const category = getRowItemCategory(row);
    if (!acc[category]) {
      acc[category] = {
        rows: 0,
        expectedQty: 0,
        scannedQty: 0,
      };
    }
    acc[category].rows += 1;
    acc[category].expectedQty += Number(row.expectedQty || 0);
    acc[category].scannedQty += Number(row.scannedQty || 0);
    return acc;
  }, {});

  return {
    checklist: checklistWithLinks,
    expectedItems: totalExpectedItems,
    scannedItems: totalScannedItems,
    remainingItems: totalRemainingItems,
    completed: totalExpectedItems > 0 && totalRemainingItems === 0 && checklistPendingProductLinks === 0,
    auctionExpectedItems,
    auctionScannedItems,
    auctionRemainingItems,
    auctionPendingProductLinks: checklistPendingProductLinks,
    nonAuctionExpectedItems,
    nonAuctionScannedItems,
    nonAuctionRemainingItems,
    categoryCounts,
  };
};

const getLinkedProductSummaryBySticker = async ({
  showId,
  importId,
  shipmentId,
  transaction = null,
}) => {
  const shipmentScanRows = await WhatnotShipmentScan.findAll({
    attributes: ['id', 'auctionStickerNumber', 'productSku', 'createdAt', 'scanType'],
    where: {
      whatnotShowId: showId,
      importId,
      shipmentId,
      result: 'matched',
      auctionStickerNumber: {
        [Op.not]: null,
        [Op.ne]: '',
      },
    },
    order: [
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
    ],
    raw: true,
    transaction,
  });

  const linkRows = [];
  const nonAuctionContextRows = [];
  for (const row of shipmentScanRows) {
    const productSku = normalizeText(row.productSku);
    const sticker = normalizeText(row.auctionStickerNumber);
    if (!sticker) continue;
    if (productSku) {
      linkRows.push(row);
      continue;
    }
    if (
      row.scanType === 'item' &&
      SPECIAL_NON_AUCTION_STICKERS.includes(sticker)
    ) {
      nonAuctionContextRows.push(row);
    }
  }

  const skus = [...new Set(linkRows.map((row) => normalizeText(row.productSku)).filter(Boolean))];
  let productsBySku = {};
  if (skus.length > 0) {
    const products = await Products.findAll({
      attributes: ['sku', 'brand', 'itemName', 'strength', 'sizeOz', 'sizeMl', 'condition', 'image'],
      where: { sku: { [Op.in]: skus } },
      include: [
        {
          model: ProductDetails,
          required: false,
          attributes: ['tester'],
        },
      ],
      raw: true,
      nest: true,
      transaction,
    });
    productsBySku = products.reduce((acc, product) => {
      acc[product.sku] = product;
      return acc;
    }, {});
  }

  const bySticker = {};
  const countsBySticker = {};
  const perStickerSkuCounts = {};
  const perStickerSkuLatestScan = {};
  for (const row of linkRows) {
    const sticker = normalizeSticker(row.auctionStickerNumber);
    const sku = normalizeText(row.productSku);
    if (!sticker || !sku) continue;
    countsBySticker[sticker] = Number(countsBySticker[sticker] || 0) + 1;
    if (!perStickerSkuCounts[sticker]) perStickerSkuCounts[sticker] = {};
    perStickerSkuCounts[sticker][sku] = Number(perStickerSkuCounts[sticker][sku] || 0) + 1;
    if (!perStickerSkuLatestScan[sticker]) perStickerSkuLatestScan[sticker] = {};
    const existing = perStickerSkuLatestScan[sticker][sku];
    if (!existing || new Date(row.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
      perStickerSkuLatestScan[sticker][sku] = {
        id: row.id,
        createdAt: row.createdAt,
      };
    }
  }

  for (const [sticker, skuCounts] of Object.entries(perStickerSkuCounts)) {
    bySticker[sticker] = Object.entries(skuCounts).map(([sku, count]) => {
      const product = productsBySku[sku];
      return {
        sku,
        count: Number(count || 0),
        latestScanId: Number(perStickerSkuLatestScan[sticker]?.[sku]?.id || 0) || null,
        brand: product?.brand || '',
        itemName: product?.itemName || '',
        strength: product?.strength || '',
        sizeOz: product?.sizeOz || '',
        sizeMl: product?.sizeMl || '',
        condition: product?.condition || '',
        image: product?.image || null,
        tester: Boolean(product?.ProductDetail?.tester),
      };
    });
  }

  const nonAuctionContexts = nonAuctionContextRows.map((row) => ({
    instanceKey: buildNonAuctionInstanceKey(row.id),
    contextType: normalizeText(row.auctionStickerNumber) || null,
    createdAt: row.createdAt,
  }));
  const lastSpecialContextScan = nonAuctionContextRows.length
    ? nonAuctionContextRows[nonAuctionContextRows.length - 1]
    : null;

  return {
    countsBySticker,
    productsBySticker: bySticker,
    nonAuctionContexts,
    lastNonAuctionContext: normalizeText(lastSpecialContextScan?.auctionStickerNumber) || null,
  };
};

const getActiveImport = async (showId) => {
  return WhatnotShipmentImport.findOne({
    where: {
      whatnotShowId: showId,
      isActive: true,
    },
    order: [['createdAt', 'DESC']],
  });
};

const resolveShipmentByTracking = async (showId, tracking, importId, transaction = null) => {
  const trackingRows = await WhatnotShipmentItem.findAll({
    where: {
      whatnotShowId: showId,
      importId,
      tracking,
    },
    attributes: ['shipmentId'],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
    raw: true,
  });

  if (!trackingRows.length) {
    return { type: 'shipment_not_found' };
  }

  const shipmentIds = [...new Set(trackingRows.map((row) => normalizeText(row.shipmentId)).filter(Boolean))];
  if (shipmentIds.length !== 1) {
    return {
      type: 'tracking_conflict',
      shipmentIds,
    };
  }

  const shipmentId = shipmentIds[0];
  const shipmentRows = await WhatnotShipmentItem.findAll({
    where: {
      whatnotShowId: showId,
      importId,
      shipmentId,
    },
    order: [['id', 'ASC']],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  const pendingRow = shipmentRows.find((row) => row.status === 'pending_review');
  if (pendingRow) {
    return {
      type: 'pending_review_blocked',
      shipmentId,
      reason: pendingRow.mismatchReason || 'Shipment is pending review.',
      shipmentRows,
    };
  }

  const isClosed = shipmentRows.some((row) => Boolean(row.closedAt));
  if (isClosed) {
    return {
      type: 'already_processed',
      shipmentId,
      reason: 'This shipment has already been scanned and closed.',
      shipmentRows,
    };
  }

  return {
    type: 'ready',
    shipmentId,
    shipmentRows,
  };
};

router.get('/summary', auth, checkPermission('whatnotFulfillment', 'view'), async (req, res) => {
  try {
    const showId = Number(req.query.showId);
    if (!showId) {
      return res.status(400).json({ error: 'showId is required' });
    }

    const activeImport = await getActiveImport(showId);
    if (!activeImport) {
      return res.json({
        showId,
        readyToBegin: false,
        activeImport: null,
        pendingReview: [],
        underReviewShipments: [],
        pendingShipments: [],
        completedShipments: [],
        categoryCounts: {},
        failedOrders: [],
      });
    }

    const failedOrders = await WhatnotFailedOrder.findAll({
      where: {
        whatnotShowId: showId,
        importId: activeImport.id,
      },
      attributes: [
        'id',
        'buyer',
        'stickerNumber',
        'soldPrice',
        'failureStatus',
        'attemptCount',
      ],
      order: [
        ['stickerNumber', 'ASC'],
        ['buyer', 'ASC'],
      ],
      raw: true,
    });

    const shipmentStatusRows = await WhatnotShipmentItem.findAll({
      where: {
        whatnotShowId: showId,
        importId: activeImport.id,
      },
      attributes: [
        'shipmentId',
        'tracking',
        'expectedQty',
        'scannedQty',
        'closedAt',
        'closedBy',
        'status',
        'mismatchReason',
        'itemCategory',
        'isAuctionItem',
      ],
      raw: true,
    });
    const shipmentCloseMap = new Map();
    const shipmentSummaryMap = new Map();
    const categoryCounts = {};
    for (const row of shipmentStatusRows) {
      const shipmentId = normalizeText(row.shipmentId);
      if (!shipmentId) continue;
      const existing = shipmentCloseMap.get(shipmentId) || false;
      shipmentCloseMap.set(shipmentId, existing || Boolean(row.closedAt));

      if (!shipmentSummaryMap.has(shipmentId)) {
        shipmentSummaryMap.set(shipmentId, {
          shipmentId,
          tracking: normalizeText(row.tracking) || 'N/A',
          expectedItems: 0,
          scannedItems: 0,
          closedAt: row.closedAt || null,
          closedBy: row.closedBy || null,
          isClosed: false,
          hasPendingReview: false,
          mismatchReason: null,
          currentStatus: 'ready',
          countsTowardOpenShipments: false,
          visibleInShipmentLists: false,
        });
      }
      const summaryEntry = shipmentSummaryMap.get(shipmentId);
      summaryEntry.expectedItems += Number(row.expectedQty || 0);
      summaryEntry.scannedItems += Number(row.scannedQty || 0);
      const rowCategory = getRowItemCategory(row);
      if (!EXCLUDED_PENDING_SHIPMENT_CATEGORIES.has(rowCategory)) {
        summaryEntry.countsTowardOpenShipments = true;
      }
      if (rowCategory !== ITEM_CATEGORY_RANDOM_GIVEAWAY) {
        summaryEntry.visibleInShipmentLists = true;
      }
      if (normalizeText(row.status) === 'pending_review') {
        summaryEntry.hasPendingReview = true;
        if (!summaryEntry.mismatchReason && normalizeText(row.mismatchReason)) {
          summaryEntry.mismatchReason = normalizeText(row.mismatchReason);
        }
      }
      if (row.closedAt) {
        summaryEntry.isClosed = true;
        summaryEntry.currentStatus = 'completed';
        if (!summaryEntry.closedAt || new Date(row.closedAt).getTime() > new Date(summaryEntry.closedAt).getTime()) {
          summaryEntry.closedAt = row.closedAt;
        }
      } else if (normalizeText(row.status)) {
        if (
          normalizeText(row.status) === 'in_progress' ||
          Number(row.scannedQty || 0) > 0
        ) {
          summaryEntry.currentStatus = 'in_progress';
        }
      }
      if (!summaryEntry.closedBy && row.closedBy) {
        summaryEntry.closedBy = row.closedBy;
      }

      const category = rowCategory;
      if (!categoryCounts[category]) {
        categoryCounts[category] = {
          rows: 0,
          expectedQty: 0,
          scannedQty: 0,
        };
      }
      categoryCounts[category].rows += 1;
      categoryCounts[category].expectedQty += Number(row.expectedQty || 0);
      categoryCounts[category].scannedQty += Number(row.scannedQty || 0);
    }
    const pendingReview = Array.from(shipmentSummaryMap.values())
      .filter((entry) => entry.hasPendingReview && entry.visibleInShipmentLists)
      .sort((a, b) => a.shipmentId.localeCompare(b.shipmentId, undefined, { numeric: true }))
      .map((entry) => ({
        shipmentId: entry.shipmentId,
        tracking: entry.tracking,
        mismatchReason: entry.mismatchReason || 'Mismatch detected',
        expectedItems: entry.expectedItems,
        scannedItems: entry.scannedItems,
      }))
      .slice(0, 100);
    const closedShipments = Array.from(shipmentCloseMap.values()).filter(Boolean).length;
    const allShipments = Array.from(shipmentSummaryMap.values());
    const remainingShipments = allShipments.filter(
      (entry) => !entry.isClosed && entry.countsTowardOpenShipments
    ).length;

    const completedShipments = allShipments
      .filter((entry) => entry.isClosed && entry.visibleInShipmentLists)
      .sort((a, b) => new Date(b.closedAt || 0).getTime() - new Date(a.closedAt || 0).getTime())
      .map((entry) => ({
        shipmentId: entry.shipmentId,
        tracking: entry.tracking,
        expectedItems: entry.expectedItems,
        scannedItems: entry.scannedItems,
        closedAt: entry.closedAt,
        closedBy: entry.closedBy,
      }))
      .slice(0, 500);

    const underReviewShipments = allShipments
      .filter((entry) => !entry.isClosed && entry.hasPendingReview && entry.visibleInShipmentLists)
      .sort((a, b) => a.shipmentId.localeCompare(b.shipmentId, undefined, { numeric: true }))
      .map((entry) => ({
        shipmentId: entry.shipmentId,
        tracking: entry.tracking,
        expectedItems: entry.expectedItems,
        scannedItems: entry.scannedItems,
        mismatchReason: entry.mismatchReason || 'Requires review',
      }))
      .slice(0, 1000);

    const pendingShipments = allShipments
      .filter(
        (entry) =>
          !entry.isClosed &&
          !entry.hasPendingReview &&
          entry.countsTowardOpenShipments &&
          entry.visibleInShipmentLists
      )
      .sort((a, b) => a.shipmentId.localeCompare(b.shipmentId, undefined, { numeric: true }))
      .map((entry) => ({
        shipmentId: entry.shipmentId,
        tracking: entry.tracking,
        expectedItems: entry.expectedItems,
        scannedItems: entry.scannedItems,
        status: entry.currentStatus || 'ready',
      }))
      .slice(0, 2000);

    const closedByIds = [
      ...new Set(
        completedShipments.map((entry) => normalizeText(entry.closedBy)).filter((value) => /^\d+$/.test(value))
      ),
    ];
    let closedByNameById = {};
    if (closedByIds.length > 0) {
      const users = await User.findAll({
        where: {
          id: {
            [Op.in]: closedByIds.map((value) => Number(value)),
          },
        },
        attributes: ['id', 'name', 'username'],
        raw: true,
      });
      closedByNameById = users.reduce((acc, user) => {
        acc[String(user.id)] = toUserDisplayName(user) || `User ${user.id}`;
        return acc;
      }, {});
    }
    const completedShipmentsWithNames = completedShipments.map((entry) => {
      const closedByKey = normalizeText(entry.closedBy);
      return {
        ...entry,
        closedByName: closedByKey ? closedByNameById[closedByKey] || closedByKey : null,
      };
    });

    return res.json({
      showId,
      readyToBegin: activeImport.readyShipments > 0,
      activeImport: {
        id: activeImport.id,
        fileName: activeImport.fileName,
        totalRows: activeImport.totalRows,
        totalShipments: activeImport.totalShipments,
        readyShipments: activeImport.readyShipments,
        pendingReviewShipments: activeImport.pendingReviewShipments,
        remainingShipments,
        closedShipments,
        uploadedBy: activeImport.uploadedBy,
        uploadedAt: activeImport.createdAt,
      },
      pendingReview,
      underReviewShipments,
      pendingShipments,
      completedShipments: completedShipmentsWithNames,
      categoryCounts,
      failedOrders: failedOrders.map((entry) => ({
        id: entry.id,
        buyer: normalizeText(entry.buyer) || 'N/A',
        stickerNumber: normalizeSticker(entry.stickerNumber),
        soldPrice: entry.soldPrice,
        failureStatus: normalizeText(entry.failureStatus) || 'failed',
        attemptCount: Number(entry.attemptCount || 0),
      })),
    });
  } catch (error) {
    console.error('Error fetching Whatnot fulfillment summary:', error);
    return res.status(500).json({ error: 'Failed to fetch fulfillment summary' });
  }
});

router.get('/shipment-details', auth, checkPermission('whatnotFulfillment', 'view'), async (req, res) => {
  try {
    const showId = Number(req.query.showId);
    const shipmentId = normalizeText(req.query.shipmentId);
    if (!showId || !shipmentId) {
      return res.status(400).json({ error: 'showId and shipmentId are required' });
    }

    const activeImport = await getActiveImport(showId);
    if (!activeImport) {
      return res.status(400).json({ error: 'No active CSV import found for this show' });
    }

    const rows = await WhatnotShipmentItem.findAll({
      where: {
        whatnotShowId: showId,
        importId: activeImport.id,
        shipmentId,
      },
      order: [['id', 'ASC']],
    });
    if (!rows.length) {
      return res.status(404).json({ error: 'Shipment not found in active import' });
    }

    const linkedSummary = await getLinkedProductSummaryBySticker({
      showId,
      importId: activeImport.id,
      shipmentId,
    });
    const summary = summarizeShipment(
      rows,
      linkedSummary.countsBySticker,
      linkedSummary.productsBySticker,
      {
        nonAuctionContexts: linkedSummary.nonAuctionContexts,
        lastNonAuctionContext: linkedSummary.lastNonAuctionContext,
      }
    );

    const tracking = normalizeText(rows[0].tracking) || 'N/A';
    const closedAtValues = rows.map((row) => row.closedAt).filter(Boolean);
    const closedAt = closedAtValues.length
      ? closedAtValues.reduce((latest, value) =>
          new Date(value).getTime() > new Date(latest).getTime() ? value : latest
        )
      : null;
    const closedBy = rows.find((row) => row.closedBy)?.closedBy || null;
    let closedByName = null;
    const closedById = normalizeText(closedBy);
    if (/^\d+$/.test(closedById)) {
      const closedByUser = await User.findByPk(Number(closedById), {
        attributes: ['id', 'name', 'username'],
      });
      closedByName = toUserDisplayName(closedByUser) || `User ${closedById}`;
    } else if (closedById) {
      closedByName = closedById;
    }

    return res.json({
      shipmentId,
      tracking,
      closedAt,
      closedBy,
      closedByName,
      ...summary,
    });
  } catch (error) {
    console.error('Error fetching shipment details:', error);
    return res.status(500).json({ error: 'Failed to fetch shipment details' });
  }
});

router.post(
  '/import',
  auth,
  checkPermission('whatnotFulfillment', 'create'),
  upload.single('file'),
  async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const showId = Number(req.body.showId);
      if (!showId) {
        await transaction.rollback();
        return res.status(400).json({ error: 'showId is required' });
      }

      const show = await WhatnotShow.findOne({
        where: { id: showId, isActive: true },
        transaction,
      });
      if (!show) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Selected show is invalid or inactive' });
      }

      if (!req.file || !req.file.buffer?.length) {
        await transaction.rollback();
        return res.status(400).json({ error: 'CSV file is required' });
      }

      const records = parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });

      if (!Array.isArray(records) || records.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ error: 'CSV has no rows' });
      }

      const grouped = new Map();
      const trackingToShipments = new Map();
      const failedAuctionAttemptMap = new Map();
      const recoveredAuctionKeySet = new Set();
      let parsedRows = 0;

      for (const row of records) {
        const productName = normalizeText(getCsvValue(row, 'product name', 'product_name'));
        const descriptionText = normalizeText(
          getCsvValue(row, 'description', 'product description', 'product_description')
        );
        const parsedCategory = parseItemCategory({ productName, descriptionText });
        const itemCategory = parsedCategory.itemCategory;
        const isAuctionItem = itemCategory === ITEM_CATEGORY_AUCTION;
        const stickerNumber = isAuctionItem ? extractStickerNumber(productName) : null;
        const buyer = normalizeText(getCsvValue(row, 'buyer', 'buyer username', 'buyer_username'));
        const orderId = normalizeText(getCsvValue(row, 'order id', 'order_id'));
        const orderNumericId = normalizeText(getCsvValue(row, 'order numeric id', 'order_numeric_id'));
        const placedAtRaw = normalizeText(getCsvValue(row, 'placed at', 'placed_at'));
        const failureStatus = normalizeText(getCsvValue(row, 'cancelled or failed', 'cancelled_or_failed')).toLowerCase();
        const soldPrice = parseMoney(
          getCsvValue(row, 'sold price', 'sold_price', 'original item price', 'original_item_price')
        );

        if (isAuctionItem && stickerNumber) {
          const failedAuctionKey = buildFailedAuctionKey({ buyer, stickerNumber });
          if (failureStatus === 'failed' || failureStatus === 'cancelled') {
            const existingFailedOrder = failedAuctionAttemptMap.get(failedAuctionKey) || {
              buyer: buyer || null,
              stickerNumber,
              soldPrice,
              failureStatus,
              attemptCount: 0,
              latestPlacedAtRaw: placedAtRaw || null,
              latestPlacedAtSeconds: parseShowElapsedSeconds(placedAtRaw),
              latestOrderId: orderId || null,
              latestOrderNumericId: orderNumericId || null,
            };
            existingFailedOrder.attemptCount += 1;
            if (existingFailedOrder.soldPrice === null && soldPrice !== null) {
              existingFailedOrder.soldPrice = soldPrice;
            }
            const currentPlacedAtSeconds = parseShowElapsedSeconds(placedAtRaw);
            const existingPlacedAtSeconds =
              existingFailedOrder.latestPlacedAtSeconds === undefined
                ? null
                : existingFailedOrder.latestPlacedAtSeconds;
            const shouldReplaceLatest =
              currentPlacedAtSeconds !== null &&
              (existingPlacedAtSeconds === null || currentPlacedAtSeconds >= existingPlacedAtSeconds);
            if (shouldReplaceLatest || !existingFailedOrder.latestPlacedAtRaw) {
              existingFailedOrder.latestPlacedAtRaw = placedAtRaw || existingFailedOrder.latestPlacedAtRaw;
              existingFailedOrder.latestPlacedAtSeconds = currentPlacedAtSeconds;
              existingFailedOrder.latestOrderId = orderId || existingFailedOrder.latestOrderId;
              existingFailedOrder.latestOrderNumericId =
                orderNumericId || existingFailedOrder.latestOrderNumericId;
              existingFailedOrder.failureStatus = failureStatus;
              if (soldPrice !== null) {
                existingFailedOrder.soldPrice = soldPrice;
              }
            }
            failedAuctionAttemptMap.set(failedAuctionKey, existingFailedOrder);
            continue;
          }

          recoveredAuctionKeySet.add(failedAuctionKey);
        }

        const shipmentId = normalizeText(getCsvValue(row, 'shipment id', 'shipment_id'));
        if (!shipmentId) continue;

        const tracking = normalizeTracking(getCsvValue(row, 'tracking', 'tracking code', 'tracking_code'));
        const expectedQty = parseQuantity(getCsvValue(row, 'product quantity', 'product_quantity'));
        const costPerItem = parseMoney(getCsvValue(row, 'cost per item', 'cost_per_item'));
        const totalCost = parseMoney(getCsvValue(row, 'total cost', 'total_cost'));
        const placedAt = parseDateTime(getCsvValue(row, 'placed at', 'placed_at'));

        if (!grouped.has(shipmentId)) {
          grouped.set(shipmentId, {
            shipmentId,
            trackings: new Set(),
            rows: new Map(),
            reasons: new Set(),
            buyer,
            orderId,
            orderNumericId,
          });
        }

        const bucket = grouped.get(shipmentId);
        const trackingKey = tracking || '__MISSING_TRACKING__';
        bucket.trackings.add(trackingKey);

        if (!tracking) {
          bucket.reasons.add('Missing tracking number in one or more rows.');
        }
        if (parsedCategory.reviewReason) {
          bucket.reasons.add(parsedCategory.reviewReason);
        }
        if (isAuctionItem && !stickerNumber) {
          bucket.reasons.add('Auction item is missing sticker number (#...).');
        }

        if (tracking) {
          if (!trackingToShipments.has(tracking)) {
            trackingToShipments.set(tracking, new Set());
          }
          trackingToShipments.get(tracking).add(shipmentId);
        }

        const rowKey = `${trackingKey}::${
          isAuctionItem
            ? stickerNumber || '__MISSING_AUCTION_STICKER__'
            : `NON_AUCTION::${itemCategory}::${productName || '__UNKNOWN_PRODUCT__'}`
        }`;
        if (!bucket.rows.has(rowKey)) {
          bucket.rows.set(rowKey, {
            tracking: tracking || null,
            productName: productName || null,
            itemCategory,
            isAuctionItem,
            stickerNumber: isAuctionItem ? stickerNumber || null : null,
            expectedQty: 0,
            soldPrice: soldPrice,
            costPerItem: costPerItem,
            totalCost: totalCost,
            placedAt: placedAt,
          });
        }
        bucket.rows.get(rowKey).expectedQty += expectedQty;
        if (bucket.rows.get(rowKey).soldPrice === null && soldPrice !== null) {
          bucket.rows.get(rowKey).soldPrice = soldPrice;
        }
        if (bucket.rows.get(rowKey).costPerItem === null && costPerItem !== null) {
          bucket.rows.get(rowKey).costPerItem = costPerItem;
        }
        if (bucket.rows.get(rowKey).totalCost === null && totalCost !== null) {
          bucket.rows.get(rowKey).totalCost = totalCost;
        }
        if (bucket.rows.get(rowKey).placedAt === null && placedAt !== null) {
          bucket.rows.get(rowKey).placedAt = placedAt;
        }
        parsedRows += 1;
      }

      if (!grouped.size) {
        await transaction.rollback();
        return res.status(400).json({ error: 'No valid shipment rows were found in CSV' });
      }

      for (const [tracking, shipmentIds] of trackingToShipments.entries()) {
        if (shipmentIds.size > 1) {
          for (const shipmentId of shipmentIds) {
            const bucket = grouped.get(shipmentId);
            if (bucket) {
              bucket.reasons.add(
                `Tracking number ${tracking} is linked to multiple shipment IDs and requires review.`
              );
            }
          }
        }
      }

      await WhatnotShipmentImport.update(
        { isActive: false },
        {
          where: {
            whatnotShowId: showId,
            isActive: true,
          },
          transaction,
        }
      );

      const importRecord = await WhatnotShipmentImport.create(
        {
          whatnotShowId: showId,
          fileName: req.file.originalname || 'show.csv',
          uploadedBy: req.user ? String(req.user.id) : null,
          isActive: true,
          totalRows: parsedRows,
          totalShipments: grouped.size,
          readyShipments: 0,
          pendingReviewShipments: 0,
        },
        { transaction }
      );

      const itemRows = [];
      let readyShipments = 0;
      let pendingReviewShipments = 0;

      for (const bucket of grouped.values()) {
        if (bucket.trackings.size !== 1) {
          bucket.reasons.add('Shipment has inconsistent tracking numbers across rows.');
        }

        const reasonText = Array.from(bucket.reasons).join(' ');
        const status = reasonText ? 'pending_review' : 'ready';
        if (status === 'pending_review') pendingReviewShipments += 1;
        else readyShipments += 1;

        for (const aggregated of bucket.rows.values()) {
          const autoApprovedGiveaway = aggregated.itemCategory === ITEM_CATEGORY_RANDOM_GIVEAWAY;
          itemRows.push({
            whatnotShowId: showId,
            importId: importRecord.id,
            shipmentId: bucket.shipmentId,
            tracking: aggregated.tracking,
            productName: aggregated.productName,
            itemCategory: aggregated.itemCategory,
            isAuctionItem: aggregated.isAuctionItem,
            stickerNumber: aggregated.stickerNumber,
            expectedQty: aggregated.expectedQty,
            soldPrice: aggregated.soldPrice,
            costPerItem: aggregated.costPerItem,
            totalCost: aggregated.totalCost,
            placedAt: aggregated.placedAt,
            scannedQty: autoApprovedGiveaway ? aggregated.expectedQty : 0,
            status: autoApprovedGiveaway && status !== 'pending_review' ? 'completed' : status,
            mismatchReason: reasonText || null,
            buyer: bucket.buyer || null,
            orderId: bucket.orderId || null,
            orderNumericId: bucket.orderNumericId || null,
          });
        }
      }

      if (itemRows.length > 0) {
        await WhatnotShipmentItem.bulkCreate(itemRows, { transaction });
      }

      const failedOrderRows = Array.from(failedAuctionAttemptMap.entries())
        .filter(([key]) => !recoveredAuctionKeySet.has(key))
        .map(([, failedOrder]) => ({
          whatnotShowId: showId,
          importId: importRecord.id,
          buyer: failedOrder.buyer || null,
          stickerNumber: failedOrder.stickerNumber,
          soldPrice: failedOrder.soldPrice,
          failureStatus: failedOrder.failureStatus || 'failed',
          attemptCount: Number(failedOrder.attemptCount || 1),
          latestPlacedAtRaw: failedOrder.latestPlacedAtRaw || null,
          latestOrderId: failedOrder.latestOrderId || null,
          latestOrderNumericId: failedOrder.latestOrderNumericId || null,
        }));

      if (failedOrderRows.length > 0) {
        await WhatnotFailedOrder.bulkCreate(failedOrderRows, { transaction });
      }

      await importRecord.update(
        {
          readyShipments,
          pendingReviewShipments,
        },
        { transaction }
      );

      await transaction.commit();
      return res.status(201).json({
        success: true,
        importId: importRecord.id,
        summary: {
          totalRows: parsedRows,
          totalShipments: grouped.size,
          readyShipments,
          pendingReviewShipments,
        },
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error importing Whatnot fulfillment CSV:', error);
      return res.status(500).json({ error: 'Failed to import CSV for fulfillment' });
    }
  }
);

router.post('/shipment', auth, checkPermission('whatnotFulfillment', 'view'), async (req, res) => {
  try {
    const showId = Number(req.body.showId);
    const tracking = normalizeTracking(req.body.tracking);

    if (!showId || !tracking) {
      return res.status(400).json({ error: 'showId and tracking are required' });
    }

    const activeImport = await getActiveImport(showId);
    if (!activeImport) {
      return res.status(400).json({ error: 'No active CSV import found for this show' });
    }

    const resolved = await resolveShipmentByTracking(showId, tracking, activeImport.id);
    if (resolved.type === 'shipment_not_found') {
      await WhatnotShipmentScan.create({
        whatnotShowId: showId,
        importId: activeImport.id,
        tracking,
        scannedValue: tracking,
        scanType: 'tracking',
        result: 'shipment_not_found',
        message: 'Tracking number not found in active show import.',
        userId: req.user ? String(req.user.id) : null,
      });
      return res.status(404).json({ error: 'Tracking number not found in active show import' });
    }

    if (resolved.type === 'tracking_conflict') {
      await WhatnotShipmentScan.create({
        whatnotShowId: showId,
        importId: activeImport.id,
        tracking,
        scannedValue: tracking,
        scanType: 'tracking',
        result: 'tracking_conflict',
        message: `Tracking maps to multiple shipments: ${resolved.shipmentIds.join(', ')}`,
        userId: req.user ? String(req.user.id) : null,
      });
      return res.status(409).json({
        error: 'Tracking number maps to multiple shipment IDs and requires review',
        shipmentIds: resolved.shipmentIds,
      });
    }

    if (resolved.type === 'pending_review_blocked') {
      await WhatnotShipmentScan.create({
        whatnotShowId: showId,
        importId: activeImport.id,
        shipmentId: resolved.shipmentId,
        tracking,
        scannedValue: tracking,
        scanType: 'tracking',
        result: 'pending_review_blocked',
        message: resolved.reason,
        userId: req.user ? String(req.user.id) : null,
      });
      return res.status(409).json({
        error: 'Shipment is pending review',
        shipmentId: resolved.shipmentId,
        reason: resolved.reason,
      });
    }
    if (resolved.type === 'already_processed') {
      return res.status(409).json({
        error: 'This shipment has already been scanned and processed.',
        shipmentId: resolved.shipmentId,
      });
    }

    const linkedSummary = await getLinkedProductSummaryBySticker({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
    });
    const lockResult = acquireOrRefreshShipmentLock({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      userId: req.user ? String(req.user.id) : null,
    });
    if (!lockResult.ok) {
      return res.status(423).json({
        error: `Shipment is currently being processed by user ${lockResult.lockedBy}.`,
      });
    }
    const summary = summarizeShipment(
      resolved.shipmentRows,
      linkedSummary.countsBySticker,
      linkedSummary.productsBySticker,
      {
        nonAuctionContexts: linkedSummary.nonAuctionContexts,
        lastNonAuctionContext: linkedSummary.lastNonAuctionContext,
      }
    );
    await WhatnotShipmentScan.create({
      whatnotShowId: showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      tracking,
      scannedValue: tracking,
      scanType: 'tracking',
      result: 'shipment_loaded',
      message: 'Shipment loaded for scanning',
      userId: req.user ? String(req.user.id) : null,
    });

    return res.json({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      tracking,
      ...summary,
    });
  } catch (error) {
    console.error('Error loading shipment by tracking:', error);
    return res.status(500).json({ error: 'Failed to load shipment' });
  }
});

router.post('/scan-item', auth, checkPermission('whatnotFulfillment', 'view'), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const showId = Number(req.body.showId);
    const tracking = normalizeTracking(req.body.tracking);
    const rawStickerInput = normalizeText(req.body.stickerNumber);
    const scannedValue = normalizeSticker(rawStickerInput);
    const specialNonAuctionContext = getSpecialNonAuctionContext(rawStickerInput);

    if (!showId || !tracking || !scannedValue) {
      await transaction.rollback();
      return res.status(400).json({ error: 'showId, tracking, and stickerNumber are required' });
    }

    const activeImport = await getActiveImport(showId);
    if (!activeImport) {
      await transaction.rollback();
      return res.status(400).json({ error: 'No active CSV import found for this show' });
    }

    const resolved = await resolveShipmentByTracking(showId, tracking, activeImport.id, transaction);
    if (resolved.type === 'shipment_not_found') {
      await WhatnotShipmentScan.create(
        {
          whatnotShowId: showId,
          importId: activeImport.id,
          tracking,
          scannedValue,
          scanType: 'item',
          result: 'shipment_not_found',
          message: 'Tracking number not found in active show import.',
          userId: req.user ? String(req.user.id) : null,
        },
        { transaction }
      );
      await transaction.commit();
      return res.status(404).json({ error: 'Tracking number not found in active show import' });
    }

    if (resolved.type === 'tracking_conflict') {
      await WhatnotShipmentScan.create(
        {
          whatnotShowId: showId,
          importId: activeImport.id,
          tracking,
          scannedValue,
          scanType: 'item',
          result: 'tracking_conflict',
          message: `Tracking maps to multiple shipments: ${resolved.shipmentIds.join(', ')}`,
          userId: req.user ? String(req.user.id) : null,
        },
        { transaction }
      );
      await transaction.commit();
      return res.status(409).json({
        error: 'Tracking number maps to multiple shipment IDs and requires review',
        shipmentIds: resolved.shipmentIds,
      });
    }

    if (resolved.type === 'pending_review_blocked') {
      await WhatnotShipmentScan.create(
        {
          whatnotShowId: showId,
          importId: activeImport.id,
          shipmentId: resolved.shipmentId,
          tracking,
          scannedValue,
          scanType: 'item',
          result: 'pending_review_blocked',
          message: resolved.reason,
          userId: req.user ? String(req.user.id) : null,
        },
        { transaction }
      );
      await transaction.commit();
      return res.status(409).json({
        error: 'Shipment is pending review',
        shipmentId: resolved.shipmentId,
        reason: resolved.reason,
      });
    }
    if (resolved.type === 'already_processed') {
      await transaction.commit();
      return res.status(409).json({
        error: 'This shipment has already been scanned and processed.',
        shipmentId: resolved.shipmentId,
      });
    }

    const shipmentRows = resolved.shipmentRows;
    const lockResult = acquireOrRefreshShipmentLock({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      userId: req.user ? String(req.user.id) : null,
    });
    if (!lockResult.ok) {
      await transaction.rollback();
      return res.status(423).json({
        error: `Shipment is currently being processed by user ${lockResult.lockedBy}.`,
      });
    }
    const auctionRows = sortAuctionRowsForOrder(getAuctionRows(shipmentRows));
    const matchingAuctionRows = auctionRows.filter(
      (row) => normalizeSticker(row.stickerNumber) === scannedValue
    );

    let result = 'unexpected';
    let message = 'Scanned value is not expected for this shipment.';
    let rowToIncrement = null;
    let matchedAuctionSticker = null;
    let matchedContextType = null;

    if (matchingAuctionRows.length > 0) {
      const fillableAuctionRow =
        matchingAuctionRows.find((row) => Number(row.scannedQty) < Number(row.expectedQty)) || null;

      if (!fillableAuctionRow) {
        result = 'duplicate';
        message = `Auction sticker #${scannedValue} is already fully scanned.`;
      } else {
        rowToIncrement = fillableAuctionRow;
        result = 'matched';
        message = `Auction sticker #${scannedValue} verified.`;
        matchedAuctionSticker = scannedValue;
      }
    } else if (specialNonAuctionContext) {
      const nonAuctionRows = getActionableNonAuctionRows(shipmentRows).filter(
        (row) => getNonAuctionContextForRow(row) === specialNonAuctionContext
      );
      if (!nonAuctionRows.length) {
        result = 'unexpected';
        message = `This shipment has no non-auction items to scan with ${specialNonAuctionContext}.`;
      } else {
        const fillableNonAuctionRow =
          nonAuctionRows.find((row) => Number(row.scannedQty) < Number(row.expectedQty)) || null;
        if (!fillableNonAuctionRow) {
          result = 'duplicate';
          message = 'All non-auction items are already fully scanned for this shipment.';
        } else {
          rowToIncrement = fillableNonAuctionRow;
          result = 'matched';
          message = `${specialNonAuctionContext} verified. Now scan UPC/SKU item(s) for this context.`;
          matchedAuctionSticker = specialNonAuctionContext;
          matchedContextType = specialNonAuctionContext;
        }
      }
    } else {
      result = 'unexpected';
      message = `Auction sticker #${scannedValue} is not part of this shipment.`;
    }

    if (rowToIncrement) {
      const newScannedQty = Number(rowToIncrement.scannedQty) + 1;
      const newStatus = newScannedQty >= Number(rowToIncrement.expectedQty) ? 'completed' : 'in_progress';
      await rowToIncrement.update(
        {
          scannedQty: newScannedQty,
          status: newStatus,
        },
        { transaction }
      );
    }

    const createdScan = await WhatnotShipmentScan.create(
      {
        whatnotShowId: showId,
        importId: activeImport.id,
        shipmentId: resolved.shipmentId,
        tracking,
        scannedValue,
        auctionStickerNumber: matchedAuctionSticker,
        soldPrice: rowToIncrement?.soldPrice || null,
        scanType: 'item',
        result,
        message,
        userId: req.user ? String(req.user.id) : null,
      },
      { transaction }
    );

    const contextInstanceKey =
      result === 'matched' && matchedContextType
        ? buildNonAuctionInstanceKey(createdScan.id)
        : matchedAuctionSticker;
    const refreshedRows = await WhatnotShipmentItem.findAll({
      where: {
        whatnotShowId: showId,
        importId: activeImport.id,
        shipmentId: resolved.shipmentId,
      },
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const linkedSummary = await getLinkedProductSummaryBySticker({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      transaction,
    });
    const summary = summarizeShipment(
      refreshedRows,
      linkedSummary.countsBySticker,
      linkedSummary.productsBySticker,
      {
        nonAuctionContexts: linkedSummary.nonAuctionContexts,
        lastNonAuctionContext: linkedSummary.lastNonAuctionContext,
      }
    );
    const shipmentStatus = summary.completed ? 'completed' : summary.scannedItems > 0 ? 'in_progress' : 'ready';

    if (shipmentStatus === 'completed' || shipmentStatus === 'in_progress') {
      const targetStatus = shipmentStatus === 'completed' ? 'completed' : 'in_progress';
      await WhatnotShipmentItem.update(
        { status: targetStatus },
        {
          where: {
            whatnotShowId: showId,
            importId: activeImport.id,
            shipmentId: resolved.shipmentId,
            status: { [Op.ne]: 'pending_review' },
          },
          transaction,
        }
      );
    }

    await transaction.commit();
    return res.json({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      tracking,
      shipmentStatus,
      scanResult: result,
      matchedAuctionSticker: contextInstanceKey,
      matchedContextType,
      message,
      ...summary,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error scanning shipment item:', error);
    return res.status(500).json({ error: 'Failed to scan shipment item' });
  }
});

router.post('/scan-product', auth, checkPermission('whatnotFulfillment', 'view'), async (req, res) => {
  try {
    const showId = Number(req.body.showId);
    const tracking = normalizeTracking(req.body.tracking);
    const auctionStickerNumber = normalizeSticker(req.body.auctionStickerNumber);
    const barcode = normalizeText(req.body.barcode);
    const selectedSku = normalizeText(req.body.selectedSku);

    if (!showId || !tracking || !auctionStickerNumber || !barcode) {
      return res.status(400).json({
        error: 'showId, tracking, auctionStickerNumber, and barcode are required',
      });
    }

    if (looksLikeAuctionSticker(barcode)) {
      return res.status(400).json({
        error:
          'Scanned value looks like an auction number sticker. Use "Scan Auction Number" first, then scan product UPC/SKU here.',
      });
    }

    const activeImport = await getActiveImport(showId);
    if (!activeImport) {
      return res.status(400).json({ error: 'No active CSV import found for this show' });
    }

    const resolved = await resolveShipmentByTracking(showId, tracking, activeImport.id);
    if (resolved.type === 'shipment_not_found') {
      return res.status(404).json({ error: 'Tracking number not found in active show import' });
    }
    if (resolved.type === 'tracking_conflict') {
      return res.status(409).json({
        error: 'Tracking number maps to multiple shipment IDs and requires review',
        shipmentIds: resolved.shipmentIds,
      });
    }
    if (resolved.type === 'pending_review_blocked') {
      return res.status(409).json({
        error: 'Shipment is pending review',
        shipmentId: resolved.shipmentId,
        reason: resolved.reason,
      });
    }
    if (resolved.type === 'already_processed') {
      return res.status(409).json({
        error: 'This shipment has already been scanned and processed.',
        shipmentId: resolved.shipmentId,
      });
    }

    const shipmentRows = resolved.shipmentRows;
    const lockResult = acquireOrRefreshShipmentLock({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      userId: req.user ? String(req.user.id) : null,
    });
    if (!lockResult.ok) {
      return res.status(423).json({
        error: `Shipment is currently being processed by user ${lockResult.lockedBy}.`,
      });
    }
    const nonAuctionContextScanId = parseNonAuctionInstanceId(auctionStickerNumber);
    const contextScanRow = nonAuctionContextScanId
      ? await WhatnotShipmentScan.findOne({
          where: {
            id: nonAuctionContextScanId,
            whatnotShowId: showId,
            importId: activeImport.id,
            shipmentId: resolved.shipmentId,
            scanType: 'item',
            result: 'matched',
            productSku: { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] },
            auctionStickerNumber: { [Op.in]: SPECIAL_NON_AUCTION_STICKERS },
          },
        })
      : null;
    const specialNonAuctionContext =
      (contextScanRow && normalizeText(contextScanRow.auctionStickerNumber)) ||
      getSpecialNonAuctionContext(auctionStickerNumber);
    const isSpecialNonAuctionContext = Boolean(specialNonAuctionContext);
    const contextForLink = isNonAuctionInstanceKey(auctionStickerNumber)
      ? auctionStickerNumber
      : isSpecialNonAuctionContext
      ? null
      : auctionStickerNumber;
    const auctionRow = isSpecialNonAuctionContext
      ? null
      : shipmentRows.find(
          (row) =>
            Boolean(row.isAuctionItem) &&
            normalizeSticker(row.stickerNumber) === auctionStickerNumber
        );
    const nonAuctionRows = isSpecialNonAuctionContext
      ? getActionableNonAuctionRows(shipmentRows).filter(
          (row) => getNonAuctionContextForRow(row) === specialNonAuctionContext
        )
      : [];
    const hasScannedNonAuctionRow = isSpecialNonAuctionContext
      ? nonAuctionRows.some((row) => Number(row.scannedQty || 0) > 0)
      : false;
    const nonAuctionReferenceRow = isSpecialNonAuctionContext
      ? contextScanRow || nonAuctionRows.find((row) => Number(row.scannedQty || 0) > 0) || nonAuctionRows[0] || null
      : null;

    if (!isSpecialNonAuctionContext && !auctionRow) {
      return res.status(400).json({
        error: `Auction sticker #${auctionStickerNumber} is not part of this shipment.`,
      });
    }

    if (!isSpecialNonAuctionContext && Number(auctionRow.scannedQty) <= 0) {
      return res.status(400).json({
        error: `Scan auction sticker #${auctionStickerNumber} first before linking products.`,
      });
    }

    if (isSpecialNonAuctionContext && !nonAuctionRows.length) {
      return res.status(400).json({
        error: `This shipment has no non-auction items for ${specialNonAuctionContext}.`,
      });
    }
    if (isSpecialNonAuctionContext && !contextScanRow) {
      return res.status(400).json({
        error: `Scan ${specialNonAuctionContext} in Auction Number box first before linking products.`,
      });
    }
    if (isSpecialNonAuctionContext && !hasScannedNonAuctionRow) {
      return res.status(400).json({
        error: `Scan ${specialNonAuctionContext} in Auction Number box first before linking products.`,
      });
    }

    const matches = await Products.findAll({
      attributes: ['sku', 'upc', 'brand', 'itemName', 'strength', 'sizeOz', 'sizeMl', 'condition', 'quantity', 'image'],
      where: {
        [Op.or]: [{ upc: barcode }, { sku: barcode }],
      },
      include: [
        {
          model: ProductDetails,
          required: false,
          attributes: ['tester'],
        },
      ],
    });

    if (!matches.length) {
      await WhatnotShipmentScan.create({
        whatnotShowId: showId,
        importId: activeImport.id,
        shipmentId: resolved.shipmentId,
        tracking,
        scannedValue: barcode,
        auctionStickerNumber: contextForLink || auctionStickerNumber,
        scanType: 'item',
        result: 'unexpected',
        message: 'No product found for scanned UPC/SKU.',
        soldPrice: isSpecialNonAuctionContext
          ? nonAuctionReferenceRow?.soldPrice || null
          : auctionRow.soldPrice || null,
        userId: req.user ? String(req.user.id) : null,
      });
      return res.status(404).json({ error: 'No product found for scanned UPC/SKU' });
    }

    let product = null;
    if (selectedSku) {
      product = matches.find((entry) => normalizeText(entry.sku) === selectedSku) || null;
      if (!product) {
        return res.status(400).json({ error: 'Selected SKU is not valid for this barcode lookup' });
      }
    } else if (matches.length === 1) {
      product = matches[0];
    } else {
      await WhatnotShipmentScan.create({
        whatnotShowId: showId,
        importId: activeImport.id,
        shipmentId: resolved.shipmentId,
        tracking,
        scannedValue: barcode,
        auctionStickerNumber: contextForLink || auctionStickerNumber,
        scanType: 'item',
        result: 'unexpected',
        message: 'Multiple products matched UPC/SKU. User selection required.',
        soldPrice: isSpecialNonAuctionContext
          ? nonAuctionReferenceRow?.soldPrice || null
          : auctionRow.soldPrice || null,
        userId: req.user ? String(req.user.id) : null,
      });
      return res.status(409).json({
        error: 'Multiple products found. Select one SKU.',
        multiple: true,
        products: matches.map((entry) => entry.toJSON()),
      });
    }

    const createdLinkScan = await WhatnotShipmentScan.create({
      whatnotShowId: showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      tracking,
      scannedValue: barcode,
      auctionStickerNumber: contextForLink || auctionStickerNumber,
      productSku: product.sku,
      soldPrice: isSpecialNonAuctionContext
        ? nonAuctionReferenceRow?.soldPrice || null
        : auctionRow.soldPrice || null,
      scanType: 'item',
      result: 'matched',
      message: isSpecialNonAuctionContext
        ? `Linked product ${product.sku} to ${specialNonAuctionContext}.`
        : `Linked product ${product.sku} to auction #${auctionStickerNumber}.`,
      userId: req.user ? String(req.user.id) : null,
    });

    const refreshedRows = await WhatnotShipmentItem.findAll({
      where: {
        whatnotShowId: showId,
        importId: activeImport.id,
        shipmentId: resolved.shipmentId,
      },
      order: [['id', 'ASC']],
    });

    const linkedSummary = await getLinkedProductSummaryBySticker({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
    });
    const summary = summarizeShipment(
      refreshedRows,
      linkedSummary.countsBySticker,
      linkedSummary.productsBySticker,
      {
        nonAuctionContexts: linkedSummary.nonAuctionContexts,
        lastNonAuctionContext: linkedSummary.lastNonAuctionContext,
      }
    );
    const shipmentStatus = summary.completed ? 'completed' : summary.scannedItems > 0 ? 'in_progress' : 'ready';

    return res.json({
      success: true,
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      tracking,
      shipmentStatus,
      auctionStickerNumber: contextForLink || auctionStickerNumber,
      product: {
        sku: product.sku,
        upc: product.upc,
        brand: product.brand,
        itemName: product.itemName,
        strength: product.strength,
        sizeOz: product.sizeOz,
        sizeMl: product.sizeMl,
        quantity: Number(product.quantity || 0),
        image: product.image || null,
        tester: Boolean(product?.ProductDetail?.tester),
      },
      soldPrice: isSpecialNonAuctionContext
        ? nonAuctionReferenceRow?.soldPrice || null
        : auctionRow.soldPrice || null,
      message: isSpecialNonAuctionContext
        ? `Product linked to ${specialNonAuctionContext}. Inventory will update when shipment is closed.`
        : `Product linked to auction #${auctionStickerNumber}. Inventory will update when shipment is closed.`,
      ...summary,
    });
  } catch (error) {
    console.error('Error scanning fulfillment product:', error);
    return res.status(500).json({ error: 'Failed to scan product for auction item' });
  }
});

router.post('/close-shipment', auth, checkPermission('whatnotFulfillment', 'view'), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const showId = Number(req.body.showId);
    const tracking = normalizeTracking(req.body.tracking);

    if (!showId || !tracking) {
      await transaction.rollback();
      return res.status(400).json({ error: 'showId and tracking are required' });
    }

    const activeImport = await getActiveImport(showId);
    if (!activeImport) {
      await transaction.rollback();
      return res.status(400).json({ error: 'No active CSV import found for this show' });
    }

    const resolved = await resolveShipmentByTracking(showId, tracking, activeImport.id, transaction);
    if (resolved.type === 'shipment_not_found') {
      await transaction.rollback();
      return res.status(404).json({ error: 'Tracking number not found in active show import' });
    }
    if (resolved.type === 'tracking_conflict') {
      await transaction.rollback();
      return res.status(409).json({
        error: 'Tracking number maps to multiple shipment IDs and requires review',
        shipmentIds: resolved.shipmentIds,
      });
    }
    if (resolved.type === 'pending_review_blocked') {
      await transaction.rollback();
      return res.status(409).json({
        error: 'Shipment is pending review',
        shipmentId: resolved.shipmentId,
        reason: resolved.reason,
      });
    }
    if (resolved.type === 'already_processed') {
      await transaction.rollback();
      return res.status(409).json({
        error: 'This shipment has already been scanned and processed.',
        shipmentId: resolved.shipmentId,
      });
    }

    const linkedSummary = await getLinkedProductSummaryBySticker({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      transaction,
    });
    const lockResult = acquireOrRefreshShipmentLock({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      userId: req.user ? String(req.user.id) : null,
    });
    if (!lockResult.ok) {
      await transaction.rollback();
      return res.status(423).json({
        error: `Shipment is currently being processed by user ${lockResult.lockedBy}.`,
      });
    }
    const summary = summarizeShipment(
      resolved.shipmentRows,
      linkedSummary.countsBySticker,
      linkedSummary.productsBySticker,
      {
        nonAuctionContexts: linkedSummary.nonAuctionContexts,
        lastNonAuctionContext: linkedSummary.lastNonAuctionContext,
      }
    );
    const missingOrderContexts = summary.checklist
      .filter((item) => Number(item.pendingProductLinks || 0) > 0)
      .map((item) => {
        if (item.nonAuctionContext && isNonAuctionInstanceKey(item.stickerNumber)) {
          return `${item.nonAuctionContext}`;
        }
        return item.stickerNumber;
      });

    if (missingOrderContexts.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot close shipment. Missing product links for order context(s): ${missingOrderContexts.join(', ')}`,
      });
    }

    const pendingLinkScans = await WhatnotShipmentScan.findAll({
      where: {
        whatnotShowId: showId,
        importId: activeImport.id,
        shipmentId: resolved.shipmentId,
        result: 'matched',
        productSku: { [Op.not]: null, [Op.ne]: '' },
        previousQuantity: { [Op.is]: null },
        newQuantity: { [Op.is]: null },
      },
      order: [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const scansBySku = new Map();
    for (const scan of pendingLinkScans) {
      const sku = normalizeText(scan.productSku);
      if (!sku) continue;
      if (!scansBySku.has(sku)) {
        scansBySku.set(sku, []);
      }
      scansBySku.get(sku).push(scan);
    }

    for (const [sku, scans] of scansBySku.entries()) {
      const product = await Products.findOne({
        where: { sku },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!product) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Cannot close shipment because SKU ${sku} no longer exists in Products.`,
        });
      }

      let runningQty = Number(product.quantity || 0);
      for (const scan of scans) {
        const previousQuantity = runningQty;
        const newQuantity = previousQuantity - 1;
        runningQty = newQuantity;
        await scan.update(
          {
            previousQuantity,
            newQuantity,
          },
          { transaction }
        );
      }

      await product.update(
        {
          quantity: runningQty,
        },
        { transaction }
      );
    }

    await WhatnotShipmentItem.update(
      {
        closedAt: new Date(),
        closedBy: req.user ? String(req.user.id) : null,
        status: 'completed',
      },
      {
        where: {
          whatnotShowId: showId,
          importId: activeImport.id,
          shipmentId: resolved.shipmentId,
        },
        transaction,
      }
    );

    await transaction.commit();
    releaseShipmentLock({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      userId: req.user ? String(req.user.id) : null,
      force: true,
    });
    return res.json({
      success: true,
      shipmentId: resolved.shipmentId,
      tracking,
      message: 'Shipment closed successfully.',
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error closing shipment:', error);
    return res.status(500).json({ error: 'Failed to close shipment' });
  }
});

router.post('/delete-link', auth, checkPermission('whatnotFulfillment', 'view'), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const showId = Number(req.body.showId);
    const tracking = normalizeTracking(req.body.tracking);
    const auctionStickerNumber = normalizeSticker(req.body.auctionStickerNumber);
    const sku = normalizeText(req.body.sku);
    const scanId = Number(req.body.scanId);
    const editPin = normalizeText(req.body.pin);

    if (!showId || !tracking || !auctionStickerNumber || !sku) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: 'showId, tracking, auctionStickerNumber, and sku are required' });
    }

    const isAdmin = normalizeText(req.user?.role).toLowerCase() === 'admin';
    if (!isAdmin) {
      if (!hasConfiguredEditPin()) {
        await transaction.rollback();
        return res.status(500).json({ error: 'Edit PIN is not configured on server.' });
      }
      const identityKey = getRequesterIdentity(req);
      const pinState = getPinRateState(identityKey);
      if (pinState.blockedUntil && pinState.blockedUntil > Date.now()) {
        await transaction.rollback();
        return res.status(429).json({ error: 'Too many invalid PIN attempts. Try again in a few minutes.' });
      }
      if (!isValidEditPin(editPin)) {
        const nextState = recordFailedPinAttempt(identityKey);
        await WhatnotShipmentScan.create({
          whatnotShowId: showId,
          importId: null,
          shipmentId: null,
          tracking,
          scannedValue: sku,
          auctionStickerNumber,
          productSku: sku,
          scanType: 'item',
          result: 'unexpected',
          message: `Invalid edit PIN attempt for delete-link. attempts=${nextState.attempts}`,
          userId: req.user ? String(req.user.id) : null,
        });
        await transaction.rollback();
        return res.status(403).json({ error: 'Invalid edit PIN. Link removal is not authorized.' });
      }
      clearPinRateState(identityKey);
    }

    const activeImport = await getActiveImport(showId);
    if (!activeImport) {
      await transaction.rollback();
      return res.status(400).json({ error: 'No active CSV import found for this show' });
    }

    const resolved = await resolveShipmentByTracking(showId, tracking, activeImport.id, transaction);
    if (resolved.type === 'shipment_not_found') {
      await transaction.rollback();
      return res.status(404).json({ error: 'Tracking number not found in active show import' });
    }
    if (resolved.type === 'tracking_conflict') {
      await transaction.rollback();
      return res.status(409).json({
        error: 'Tracking number maps to multiple shipment IDs and requires review',
        shipmentIds: resolved.shipmentIds,
      });
    }
    if (resolved.type === 'pending_review_blocked') {
      await transaction.rollback();
      return res.status(409).json({
        error: 'Shipment is pending review',
        shipmentId: resolved.shipmentId,
        reason: resolved.reason,
      });
    }
    if (resolved.type === 'already_processed') {
      await transaction.rollback();
      return res.status(409).json({
        error: 'This shipment has already been scanned and processed. Links cannot be deleted.',
        shipmentId: resolved.shipmentId,
      });
    }
    const lockResult = acquireOrRefreshShipmentLock({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      userId: req.user ? String(req.user.id) : null,
    });
    if (!lockResult.ok) {
      await transaction.rollback();
      return res.status(423).json({
        error: `Shipment is currently being processed by user ${lockResult.lockedBy}.`,
      });
    }

    const stagedWhere = {
      whatnotShowId: showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      result: 'matched',
      previousQuantity: { [Op.is]: null },
      newQuantity: { [Op.is]: null },
    };

    let linkRow = null;
    if (Number.isFinite(scanId) && scanId > 0) {
      linkRow = await WhatnotShipmentScan.findOne({
        where: {
          ...stagedWhere,
          id: scanId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }

    if (!linkRow) {
      linkRow = await WhatnotShipmentScan.findOne({
        where: {
          ...stagedWhere,
          productSku: sku,
          auctionStickerNumber,
        },
        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC'],
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }

    if (!linkRow) {
      await transaction.rollback();
      return res.status(404).json({ error: 'No removable staged linked product found for this context and SKU.' });
    }

    const removedSku = normalizeText(linkRow.productSku) || sku;
    const removedContext = normalizeText(linkRow.auctionStickerNumber) || auctionStickerNumber;

    await linkRow.update(
      {
        result: 'duplicate',
        message: `Link voided by ${isAdmin ? 'admin' : 'PIN-authorized user'}.`,
      },
      { transaction }
    );

    await WhatnotShipmentScan.create(
      {
        whatnotShowId: showId,
        importId: activeImport.id,
        shipmentId: resolved.shipmentId,
        tracking,
        scannedValue: removedSku,
        auctionStickerNumber: removedContext,
        productSku: removedSku,
        scanType: 'item',
        result: 'unexpected',
        message: `Linked product voided from ${removedContext}. scanId=${linkRow.id}`,
        userId: req.user ? String(req.user.id) : null,
      },
      { transaction }
    );

    const removedContextScanId = parseNonAuctionInstanceId(removedContext);
    if (removedContextScanId) {
      const remainingContextLinkCount = await WhatnotShipmentScan.count({
        where: {
          whatnotShowId: showId,
          importId: activeImport.id,
          shipmentId: resolved.shipmentId,
          auctionStickerNumber: removedContext,
          result: 'matched',
          productSku: { [Op.not]: null, [Op.ne]: '' },
        },
        transaction,
      });

      if (remainingContextLinkCount < 1) {
        await WhatnotShipmentScan.update(
          {
            result: 'duplicate',
            message: `Context cleared after last linked product was removed from ${removedContext}.`,
          },
          {
            where: {
              id: removedContextScanId,
              whatnotShowId: showId,
              importId: activeImport.id,
              shipmentId: resolved.shipmentId,
              scanType: 'item',
              result: 'matched',
              productSku: { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] },
              auctionStickerNumber: { [Op.in]: SPECIAL_NON_AUCTION_STICKERS },
            },
            transaction,
          }
        );
      }
    }

    const refreshedRows = await WhatnotShipmentItem.findAll({
      where: {
        whatnotShowId: showId,
        importId: activeImport.id,
        shipmentId: resolved.shipmentId,
      },
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const refreshedLinkedSummary = await getLinkedProductSummaryBySticker({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      transaction,
    });
    await syncNonAuctionRowsToContexts({
      shipmentRows: refreshedRows,
      nonAuctionContexts: refreshedLinkedSummary.nonAuctionContexts,
      transaction,
    });
    const linkedSummary = await getLinkedProductSummaryBySticker({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      transaction,
    });
    const summary = summarizeShipment(
      refreshedRows,
      linkedSummary.countsBySticker,
      linkedSummary.productsBySticker,
      {
        nonAuctionContexts: linkedSummary.nonAuctionContexts,
        lastNonAuctionContext: linkedSummary.lastNonAuctionContext,
      }
    );

    await transaction.commit();
    return res.json({
      success: true,
      shipmentId: resolved.shipmentId,
      tracking,
      message: `Removed one link for SKU ${removedSku} from ${removedContext}.`,
      ...summary,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting linked product from shipment context:', error);
    return res.status(500).json({ error: 'Failed to delete linked product from shipment context' });
  }
});

router.post('/reset-unlinked-auction-scans', auth, checkPermission('whatnotFulfillment', 'view'), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const showId = Number(req.body.showId);
    const tracking = normalizeTracking(req.body.tracking);
    const targetContextSticker = normalizeText(req.body.contextStickerNumber);

    if (!showId || !tracking) {
      await transaction.rollback();
      return res.status(400).json({ error: 'showId and tracking are required' });
    }

    const activeImport = await getActiveImport(showId);
    if (!activeImport) {
      await transaction.rollback();
      return res.status(400).json({ error: 'No active CSV import found for this show' });
    }

    const resolved = await resolveShipmentByTracking(showId, tracking, activeImport.id, transaction);
    if (resolved.type === 'shipment_not_found') {
      await transaction.rollback();
      return res.status(404).json({ error: 'Tracking number not found in active show import' });
    }
    if (resolved.type === 'tracking_conflict') {
      await transaction.rollback();
      return res.status(409).json({
        error: 'Tracking number maps to multiple shipment IDs and requires review',
        shipmentIds: resolved.shipmentIds,
      });
    }
    if (resolved.type === 'pending_review_blocked') {
      await transaction.rollback();
      return res.status(409).json({
        error: 'Shipment is pending review',
        shipmentId: resolved.shipmentId,
        reason: resolved.reason,
      });
    }
    if (resolved.type === 'already_processed') {
      await transaction.rollback();
      return res.status(409).json({
        error: 'This shipment has already been scanned and processed.',
        shipmentId: resolved.shipmentId,
      });
    }
    const lockResult = acquireOrRefreshShipmentLock({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      userId: req.user ? String(req.user.id) : null,
    });
    if (!lockResult.ok) {
      await transaction.rollback();
      return res.status(423).json({
        error: `Shipment is currently being processed by user ${lockResult.lockedBy}.`,
      });
    }

    const linkedSummary = await getLinkedProductSummaryBySticker({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      transaction,
    });

    const rowsToReset = resolved.shipmentRows.filter((row) => {
      if (targetContextSticker && normalizeSticker(row.stickerNumber) !== targetContextSticker) {
        return false;
      }
      if (!row.isAuctionItem) return false;
      const sticker = normalizeSticker(row.stickerNumber);
      if (!sticker) return false;
      const scannedQty = Number(row.scannedQty || 0);
      const linkedCount = Number(linkedSummary.countsBySticker[sticker] || 0);
      return scannedQty > 0 && linkedCount < 1;
    });
    const orphanNonAuctionContexts = (linkedSummary.nonAuctionContexts || []).filter((contextRow) => {
      const instanceKey = normalizeText(contextRow.instanceKey);
      if (!instanceKey) return false;
      if (targetContextSticker && instanceKey !== targetContextSticker) return false;
      return Number(linkedSummary.countsBySticker[instanceKey] || 0) < 1;
    });

    if (rowsToReset.length > 0) {
      await WhatnotShipmentItem.update(
        {
          scannedQty: 0,
          status: 'ready',
        },
        {
          where: {
            id: {
              [Op.in]: rowsToReset.map((row) => row.id),
            },
          },
          transaction,
        }
      );
    }

    const resetStickerSet = new Set(
      rowsToReset.map((row) => normalizeSticker(row.stickerNumber)).filter(Boolean)
    );

    if (orphanNonAuctionContexts.length > 0) {
      await WhatnotShipmentScan.update(
        {
          result: 'duplicate',
          message: 'Context reset because no linked products were attached.',
        },
        {
          where: {
            id: {
              [Op.in]: orphanNonAuctionContexts
                .map((contextRow) => parseNonAuctionInstanceId(contextRow.instanceKey))
                .filter((id) => Number.isFinite(id) && id > 0),
            },
            whatnotShowId: showId,
            importId: activeImport.id,
            shipmentId: resolved.shipmentId,
            scanType: 'item',
            result: 'matched',
            productSku: { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] },
            auctionStickerNumber: { [Op.in]: SPECIAL_NON_AUCTION_STICKERS },
          },
          transaction,
        }
      );

      const refreshedRows = await WhatnotShipmentItem.findAll({
        where: {
          whatnotShowId: showId,
          importId: activeImport.id,
          shipmentId: resolved.shipmentId,
        },
        order: [['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const refreshedLinkedSummary = await getLinkedProductSummaryBySticker({
        showId,
        importId: activeImport.id,
        shipmentId: resolved.shipmentId,
        transaction,
      });
      await syncNonAuctionRowsToContexts({
        shipmentRows: refreshedRows,
        nonAuctionContexts: refreshedLinkedSummary.nonAuctionContexts,
        transaction,
      });

      orphanNonAuctionContexts.forEach((contextRow) => {
        resetStickerSet.add(contextRow.contextType || contextRow.instanceKey);
      });
    }

    const finalRows = await WhatnotShipmentItem.findAll({
      where: {
        whatnotShowId: showId,
        importId: activeImport.id,
        shipmentId: resolved.shipmentId,
      },
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const finalLinkedSummary = await getLinkedProductSummaryBySticker({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      transaction,
    });
    const summary = summarizeShipment(
      finalRows,
      finalLinkedSummary.countsBySticker,
      finalLinkedSummary.productsBySticker,
      {
        nonAuctionContexts: finalLinkedSummary.nonAuctionContexts,
        lastNonAuctionContext: finalLinkedSummary.lastNonAuctionContext,
      }
    );

    await transaction.commit();
    releaseShipmentLock({
      showId,
      importId: activeImport.id,
      shipmentId: resolved.shipmentId,
      userId: req.user ? String(req.user.id) : null,
      force: true,
    });
    return res.json({
      success: true,
      shipmentId: resolved.shipmentId,
      tracking,
      resetCount: rowsToReset.length + orphanNonAuctionContexts.length,
      resetAuctionStickers: Array.from(resetStickerSet),
      ...summary,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error resetting unlinked auction scans:', error);
    return res.status(500).json({ error: 'Failed to reset unlinked auction scans' });
  }
});

module.exports = router;
