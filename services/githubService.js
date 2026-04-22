const https = require('https');
const http = require('http');
const path = require('path');
const AdmZip = require('adm-zip');
const { generateSummary } = require('./openaiservices');

const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rb', '.php',
  '.cs', '.cpp', '.c', '.h', '.rs', '.swift', '.kt', '.scala', '.sh',
  '.yaml', '.yml', '.json', '.html', '.css', '.md',
]);

function parseGitHubUrl(repoUrl) {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?\s*$/);
  if (!match) throw new Error('Invalid GitHub URL. Expected: https://github.com/owner/repo');
  return { owner: match[1], repo: match[2] };
}

function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    const options = {};
    if (process.env.GITHUB_TOKEN) {
      options.headers = { Authorization: `token ${process.env.GITHUB_TOKEN}` };
    }

    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadToBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download repo: HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

const fetchRepo = async (repoUrl) => {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const zipUrl = `https://github.com/${owner}/${repo}/archive/HEAD.zip`;
  const buffer = await downloadToBuffer(zipUrl);
  return buffer;
};

const processRepo = async (buffer) => {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const results = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!CODE_EXTENSIONS.has(ext)) continue;

    const code = entry.getData().toString('utf8');
    if (!code.trim() || code.length < 10) continue;

    const summary = await generateSummary(code);
    results.push({ fileName: entry.entryName, code, summary });
  }

  return results;
};

module.exports = { fetchRepo, processRepo };
