/**
 * Security header rules, modeled on the OWASP Secure Headers Project
 * and the logic used by tools like securityheaders.com.
 *
 * Each rule:
 *  - header: the HTTP response header name to look for
 *  - severity: how bad it is if missing
 *  - points: how much this header contributes to the 0-100 score
 *  - validate(value): optional extra check on the header's actual value
 *  - recommendation: human-readable fix, shown in the UI
 */

const RULES = [
  {
    header: 'strict-transport-security',
    severity: 'high',
    points: 20,
    recommendation:
      'Add Strict-Transport-Security (HSTS) to force browsers to use HTTPS only, preventing protocol-downgrade and cookie-hijacking attacks.',
    validate: (v) => v.includes('max-age'),
    invalidMsg: 'HSTS header present but missing max-age directive.',
  },
  {
    header: 'content-security-policy',
    severity: 'high',
    points: 20,
    recommendation:
      'Add a Content-Security-Policy (CSP) to restrict which scripts/styles/resources can load, mitigating XSS and data-injection attacks.',
  },
  {
    header: 'x-frame-options',
    severity: 'medium',
    points: 15,
    recommendation:
      'Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking via iframes.',
  },
  {
    header: 'x-content-type-options',
    severity: 'medium',
    points: 15,
    recommendation:
      'Add X-Content-Type-Options: nosniff to stop browsers from MIME-sniffing responses away from the declared content type.',
    validate: (v) => v.toLowerCase() === 'nosniff',
    invalidMsg: 'Header present but value should be exactly "nosniff".',
  },
  {
    header: 'referrer-policy',
    severity: 'low',
    points: 10,
    recommendation:
      'Add a Referrer-Policy (e.g. strict-origin-when-cross-origin) to limit how much URL data leaks to third parties via the Referer header.',
  },
  {
    header: 'permissions-policy',
    severity: 'low',
    points: 10,
    recommendation:
      'Add a Permissions-Policy to explicitly disable browser features (camera, mic, geolocation) your site does not use.',
  },
  {
    header: 'x-xss-protection',
    severity: 'low',
    points: 5,
    recommendation:
      'Legacy header for older browsers\' built-in XSS filter. Low priority if CSP is set correctly, but cheap to add.',
  },
  {
    header: 'set-cookie',
    severity: 'medium',
    points: 5,
    recommendation:
      'Ensure cookies use Secure, HttpOnly, and SameSite attributes to prevent theft via XSS/CSRF and transmission over plain HTTP.',
    validate: (v) =>
      /secure/i.test(v) && /httponly/i.test(v) && /samesite/i.test(v),
    invalidMsg:
      'Cookies found but missing one or more of Secure / HttpOnly / SameSite attributes.',
    optional: true, // only scored if the site actually sets cookies
  },
];

/**
 * Turns raw response headers into a structured checklist + score + grade.
 * @param {Object} headers - lowercase-keyed headers object (from axios/fetch)
 * @returns {{checks: Array, score: number, grade: string}}
 */
function analyzeHeaders(headers) {
  const checks = [];
  let earnedPoints = 0;
  let possiblePoints = 0;

  for (const rule of RULES) {
    const rawValue = headers[rule.header];
    const present = Boolean(rawValue);

    // Cookie check only counts if the site actually sets cookies
    if (rule.optional && !present) continue;

    possiblePoints += rule.points;

    let ok = present;
    let recommendation = rule.recommendation;

    if (present && rule.validate && !rule.validate(String(rawValue))) {
      ok = false;
      recommendation = rule.invalidMsg || rule.recommendation;
    }

    if (ok) earnedPoints += rule.points;

    checks.push({
      name: rule.header,
      present,
      value: present ? String(rawValue).slice(0, 300) : null,
      severity: rule.severity,
      recommendation: ok ? 'Looks good.' : recommendation,
    });
  }

  const score = possiblePoints === 0 ? 100 : Math.round((earnedPoints / possiblePoints) * 100);
  const grade = scoreToGrade(score);

  return { checks, score, grade };
}

function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

module.exports = { analyzeHeaders };
