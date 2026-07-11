import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:5000/api';

const SEVERITY_COLOR = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#65a30d',
};

const GRADE_COLOR = {
  A: '#16a34a',
  B: '#65a30d',
  C: '#d97706',
  D: '#ea580c',
  F: '#dc2626',
};

function GradeBadge({ grade, score }) {
  return (
    <div className="grade-badge" style={{ borderColor: GRADE_COLOR[grade] }}>
      <span className="grade-letter" style={{ color: GRADE_COLOR[grade] }}>
        {grade}
      </span>
      <span className="grade-score">{score}/100</span>
    </div>
  );
}

function CheckRow({ check }) {
  return (
    <div className={`check-row ${check.present ? 'pass' : 'fail'}`}>
      <div className="check-header">
        <span className="check-icon">{check.present ? '✓' : '✗'}</span>
        <span className="check-name">{check.name}</span>
        <span
          className="check-severity"
          style={{ background: SEVERITY_COLOR[check.severity] }}
        >
          {check.severity}
        </span>
      </div>
      {check.value && <div className="check-value">{check.value}</div>}
      <div className="check-recommendation">{check.recommendation}</div>
    </div>
  );
}

function AiSummaryPanel({ scanId, initialSummary }) {
  const [summary, setSummary] = useState(initialSummary || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset when the user switches to a different scan.
  useEffect(() => {
    setSummary(initialSummary || null);
    setError('');
  }, [scanId, initialSummary]);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/scans/${scanId}/ai-summary`);
      setSummary(res.data.aiSummary);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate AI summary.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <span>✨ AI Fix Summary (Gemini)</span>
        {!summary && (
          <button className="ai-generate-btn" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
      {summary && <pre className="ai-summary-text">{summary}</pre>}
    </div>
  );
}

function ScanResult({ scan }) {
  if (scan.error) {
    return (
      <div className="result-card error">
        <h3>Scan failed for {scan.url}</h3>
        <p>{scan.error}</p>
      </div>
    );
  }

  return (
    <div className="result-card">
      <div className="result-header">
        <div>
          <h3>{scan.url}</h3>
          <span className="status-code">HTTP {scan.statusCode}</span>
        </div>
        <GradeBadge grade={scan.grade} score={scan.score} />
      </div>
      <div className="checks-list">
        {scan.checks.map((c) => (
          <CheckRow key={c.name} check={c} />
        ))}
      </div>
      <AiSummaryPanel scanId={scan._id} initialSummary={scan.aiSummary} />
    </div>
  );
}

function HistoryItem({ scan, onSelect }) {
  return (
    <button className="history-item" onClick={() => onSelect(scan)}>
      <span className="history-url">{scan.url}</span>
      <span
        className="history-grade"
        style={{ color: GRADE_COLOR[scan.grade] }}
      >
        {scan.grade}
      </span>
    </button>
  );
}

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentScan, setCurrentScan] = useState(null);
  const [history, setHistory] = useState([]);
  const [formError, setFormError] = useState('');

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/scans`);
      setHistory(res.data);
    } catch {
      // history is non-critical; fail silently in UI
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleScan = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!url.trim()) {
      setFormError('Enter a URL to scan.');
      return;
    }

    setLoading(true);
    setCurrentScan(null);

    try {
      const res = await axios.post(`${API_BASE}/scan`, { url: url.trim() });
      setCurrentScan(res.data);
      fetchHistory();
    } catch (err) {
      if (err.response?.data) {
        setCurrentScan(err.response.data);
      } else {
        setFormError('Could not reach the server. Is it running?');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔒 Security Header Scanner</h1>
        <p>Checks any site's HTTP response headers against OWASP recommendations.</p>
      </header>

      <form className="scan-form" onSubmit={handleScan}>
        <input
          type="text"
          placeholder="example.com or https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Scanning…' : 'Scan'}
        </button>
      </form>
      {formError && <p className="form-error">{formError}</p>}

      <div className="layout">
        <div className="main-panel">
          {currentScan ? (
            <ScanResult scan={currentScan} />
          ) : (
            <p className="empty-state">Run a scan to see results here.</p>
          )}
        </div>

        <aside className="history-panel">
          <h4>Recent scans</h4>
          {history.length === 0 && <p className="empty-state">No scans yet.</p>}
          {history.map((scan) => (
            <HistoryItem key={scan._id} scan={scan} onSelect={setCurrentScan} />
          ))}
        </aside>
      </div>
    </div>
  );
}
