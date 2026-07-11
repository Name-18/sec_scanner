const express = require('express');
const axios = require('axios');
const Scan = require('../models/Scan');
const { analyzeHeaders } = require('../utils/analyzeHeaders');
const { generateFixSummary } = require('../utils/generateFixSummary');

const router = express.Router();

// Basic guard: only allow http/https URLs, block localhost/private IPs
// to avoid the server being used to probe internal network (SSRF risk).
function isSafeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (!['http:', 'https:'].includes(u.protocol)) return false;

    const hostname = u.hostname.toLowerCase();
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blocked.includes(hostname)) return false;

    // block private IP ranges (10.x, 172.16-31.x, 192.168.x)
    const privateIpRegex =
      /^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/;
    if (privateIpRegex.test(hostname)) return false;

    return true;
  } catch {
    return false;
  }
}

// POST /api/scan  { url: "https://example.com" }
router.post('/scan', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid "url" string is required.' });
  }

  const normalizedUrl = url.trim().match(/^https?:\/\//i) ? url.trim() : `https://${url.trim()}`;

  if (!isSafeUrl(normalizedUrl)) {
    return res.status(400).json({ error: 'URL is invalid or points to a disallowed/private host.' });
  }

  try {
    const response = await axios.get(normalizedUrl, {
      timeout: 8000,
      maxRedirects: 5,
      validateStatus: () => true, // we want to inspect even 4xx/5xx responses
      headers: { 'User-Agent': 'SecScanner/1.0 (educational security header checker)' },
    });

    // axios lowercases header keys already
    const { checks, score, grade } = analyzeHeaders(response.headers);

    const scan = await Scan.create({
      url: normalizedUrl,
      statusCode: response.status,
      score,
      grade,
      checks,
    });

    return res.status(201).json(scan);
  } catch (err) {
    const message =
      err.code === 'ECONNABORTED'
        ? 'Request timed out while contacting the target URL.'
        : err.message || 'Failed to reach the target URL.';

    const failedScan = await Scan.create({
      url: normalizedUrl,
      score: 0,
      grade: 'F',
      checks: [],
      error: message,
    });

    return res.status(502).json(failedScan);
  }
});

// GET /api/scans  -> most recent scans first
router.get('/scans', async (req, res) => {
  const scans = await Scan.find().sort({ createdAt: -1 }).limit(50);
  res.json(scans);
});

// GET /api/scans/:id  -> single scan detail
router.get('/scans/:id', async (req, res) => {
  const scan = await Scan.findById(req.params.id);
  if (!scan) return res.status(404).json({ error: 'Scan not found.' });
  res.json(scan);
});

// POST /api/scans/:id/ai-summary -> generate (or return cached) Gemini fix plan
router.post('/scans/:id/ai-summary', async (req, res) => {
  const scan = await Scan.findById(req.params.id);
  if (!scan) return res.status(404).json({ error: 'Scan not found.' });

  if (scan.error) {
    return res.status(400).json({ error: 'Cannot summarize a failed scan.' });
  }

  // Cache: don't re-call the AI API if we already generated one for this scan.
  if (scan.aiSummary) {
    return res.json({ aiSummary: scan.aiSummary, cached: true });
  }

  try {
    const summary = await generateFixSummary({
      url: scan.url,
      score: scan.score,
      grade: scan.grade,
      checks: scan.checks,
    });

    scan.aiSummary = summary;
    await scan.save();

    res.json({ aiSummary: summary, cached: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate AI summary.', detail: err.message });
  }
});

module.exports = router;
