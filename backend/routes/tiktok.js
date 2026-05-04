const express = require('express');
const router = express.Router();
const { TikTokShow } = require('../models');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

const MONTH_NAME_TO_INDEX = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const getShowSortTimestamp = (show) => {
  const rawName = String(show?.name || '').trim();
  const match = rawName.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{1,2})-(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return new Date(show?.createdAt || 0).getTime() || 0;
  }

  const day = Number(match[1]);
  const monthIndex = MONTH_NAME_TO_INDEX[String(match[2] || '').toLowerCase()];
  let hour = Number(match[3]);
  const minute = Number(match[4]);
  const meridiem = String(match[5] || '').toUpperCase();
  const fallbackYear = new Date(show?.createdAt || Date.now()).getFullYear();

  if (!Number.isInteger(day) || monthIndex === undefined || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    return new Date(show?.createdAt || 0).getTime() || 0;
  }

  if (meridiem === 'AM') {
    if (hour === 12) hour = 0;
  } else if (meridiem === 'PM' && hour !== 12) {
    hour += 12;
  }

  return new Date(fallbackYear, monthIndex, day, hour, minute, 0, 0).getTime();
};

router.get('/shows', auth, checkPermission('whatnot', 'view'), async (req, res) => {
  try {
    const shows = await TikTokShow.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC'], ['name', 'ASC']],
    });

    const sortedShows = [...shows].sort((left, right) => {
      const timeDiff = getShowSortTimestamp(right) - getShowSortTimestamp(left);
      if (timeDiff !== 0) return timeDiff;
      return String(left.name || '').localeCompare(String(right.name || ''));
    });

    res.json(sortedShows);
  } catch (error) {
    console.error('Error fetching TikTok shows:', error);
    res.status(500).json({ error: 'Failed to fetch TikTok shows' });
  }
});

router.post('/shows', auth, checkPermission('whatnot', 'create'), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const [show] = await TikTokShow.findOrCreate({
      where: {
        name: String(name).trim(),
      },
      defaults: {
        name: String(name).trim(),
        isActive: true,
        createdBy: req.user ? String(req.user.id) : null,
      },
    });

    res.status(201).json(show);
  } catch (error) {
    console.error('Error creating TikTok show:', error);
    res.status(500).json({ error: 'Failed to create TikTok show' });
  }
});

module.exports = router;
