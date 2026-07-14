'use strict';

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const EmailService = require('../Services/EmailService');

// In-memory submission tracker: userId -> submittedAt (Date)
const submissionLog = new Map();

const EASTERN_TZ = 'America/New_York';

// Returns a Date representing 9:00 AM Eastern time on the current Eastern calendar day.
function get9amEastern() {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: EASTERN_TZ }).format(now); // YYYY-MM-DD
  // Try UTC hours that map to 9am Eastern (EDT=UTC-4 → 13:00Z, EST=UTC-5 → 14:00Z)
  for (const h of [13, 14]) {
    const candidate = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00Z`);
    const easternHour = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: EASTERN_TZ, hour: 'numeric', hour12: false }).format(candidate),
      10
    );
    if (easternHour === 9) return candidate;
  }
  return new Date(`${dateStr}T14:00:00Z`); // fallback: 9am EST
}

function getEffectiveResetTime() {
  const reset = get9amEastern();
  const now = new Date();
  // If 9am Eastern today hasn't happened yet, the reset was yesterday at 9am Eastern
  return reset > now ? new Date(reset.getTime() - 86400000) : reset;
}

function hasSubmittedToday(userId) {
  const submittedAt = submissionLog.get(userId);
  if (!submittedAt) return false;
  return submittedAt >= getEffectiveResetTime();
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// GET /api/checklist/status — check if current user has submitted today
router.get('/status', auth, async (req, res) => {
  const userId = req.user?.id;
  res.json({ submitted: hasSubmittedToday(userId) });
});

// POST /api/checklist/submit
router.post('/submit', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name || req.user?.username || 'Unknown';
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && hasSubmittedToday(userId)) {
      return res.status(409).json({ error: 'Already submitted today.' });
    }

    const { items, submittedAt } = req.body;
    const { User } = require('../models');
    const admins = await User.findAll({
      where: { role: 'admin', isActive: true },
      attributes: ['email'],
    });
    const adminEmails = admins.map(a => a.email).filter(Boolean);

    if (!adminEmails.length) {
      return res.status(500).json({ error: 'No admin email addresses found.' });
    }

    const dateStr = new Date(submittedAt).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const timeStr = new Date(submittedAt).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });

    const rows = items.map(item => {
      const refillCell = item.needsRefill
        ? `<td style="padding:8px 10px;text-align:center;color:#c62828;font-weight:600;">&#10003; Yes</td>`
        : `<td style="padding:8px 10px;text-align:center;color:#888;">No</td>`;
      const doneCell = item.done
        ? `<td style="padding:8px 10px;text-align:center;color:#2e7d32;font-weight:600;">&#10003; Done</td>`
        : `<td style="padding:8px 10px;text-align:center;color:#888;">—</td>`;
      const notesCell = item.notes
        ? `<td style="padding:8px 10px;font-size:12px;color:#333;">${escapeHtml(item.notes)}</td>`
        : `<td style="padding:8px 10px;color:#bbb;">—</td>`;
      return `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 10px;font-family:monospace;font-size:12px;color:#1565c0;">${escapeHtml(item.sku)}</td>
          <td style="padding:8px 10px;font-size:13px;">${escapeHtml(item.fullName)}</td>
          <td style="padding:8px 10px;text-align:center;font-weight:600;font-size:13px;">${item.quantity ?? 0}</td>
          ${refillCell}
          ${doneCell}
          ${notesCell}
        </tr>`;
    }).join('');

    const needsRefillCount = items.filter(i => i.needsRefill).length;
    const doneCount = items.filter(i => i.done).length;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;">
        <div style="background:#1565c0;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="color:white;margin:0;font-size:20px;">Daily Inventory Checklist</h2>
          <p style="color:#bbdefb;margin:4px 0 0;font-size:13px;">Submitted by ${userName} on ${dateStr} at ${timeStr}</p>
        </div>
        <div style="background:#e3f2fd;padding:12px 24px;">
          <span style="font-size:13px;color:#1565c0;margin-right:24px;"><strong>${items.length}</strong> items checked</span>
          <span style="font-size:13px;color:#c62828;margin-right:24px;"><strong>${needsRefillCount}</strong> need refill</span>
          <span style="font-size:13px;color:#2e7d32;"><strong>${doneCount}</strong> marked done</span>
        </div>
        <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e0e0e0;border-top:none;">
          <thead>
            <tr style="background:#f5f5f5;border-bottom:1px solid #e0e0e0;">
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#888;font-weight:500;">SKU</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#888;font-weight:500;">Product</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#888;font-weight:500;">Qty</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#c62828;font-weight:500;">Need refill</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#2e7d32;font-weight:500;">Done</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#888;font-weight:500;">Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="background:#f9f9f9;padding:12px 24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
          <p style="margin:0;font-size:11px;color:#aaa;">Inventoz · Daily Checklist System</p>
        </div>
      </div>`;

    await EmailService.sendEmail({
      to: adminEmails.join(','),
      subject: `Daily Checklist — ${userName} — ${dateStr}`,
      html,
    });

    // Record submission after email sent (admins are not tracked so they can resubmit)
    if (!isAdmin) submissionLog.set(userId, new Date());

    res.json({ success: true });
  } catch (error) {
    console.error('Checklist submit error:', error);
    res.status(500).json({ error: 'Failed to submit checklist.' });
  }
});

module.exports = router;
