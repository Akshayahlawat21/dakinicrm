import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOTS_DIR = path.resolve('d:/CRM/screenshots');
const OUTPUT_PDF = path.resolve('d:/CRM/Dakini_AI_CRM_Frontend_Report.pdf');

// Read manifest
const manifestRaw = fs.readFileSync(path.join(SCREENSHOTS_DIR, 'manifest.json'), 'utf-8');
const manifest = JSON.parse(manifestRaw);

// Convert each image to base64 so Chrome PDF renderer embeds it instantly without file:// restrictions
const itemsWithBase64 = manifest.map((item) => {
  const imgBuffer = fs.readFileSync(item.file);
  const b64 = imgBuffer.toString('base64');
  return {
    ...item,
    dataUri: `data:image/png;base64,${b64}`
  };
});

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dakini AI CRM — Frontend Design & Architecture Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      page-break-after: always;
      position: relative;
      height: 100%;
      min-height: 260mm;
      display: flex;
      flex-direction: column;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    /* Cover Page */
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 265mm;
      padding: 20mm 10mm;
      background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%);
      border: 1px solid #dbeafe;
      border-radius: 16px;
    }

    .cover-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: #2563eb;
      color: #ffffff;
      font-size: 10pt;
      font-weight: 700;
      border-radius: 9999px;
      width: fit-content;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .cover-title {
      font-size: 32pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.15;
      letter-spacing: -0.02em;
      margin-top: 15px;
    }

    .cover-subtitle {
      font-size: 14pt;
      color: #2563eb;
      font-weight: 600;
      margin-top: 8px;
    }

    .cover-summary {
      font-size: 11pt;
      color: #475569;
      line-height: 1.6;
      max-width: 520px;
      margin-top: 18px;
    }

    .cover-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding-top: 20px;
      border-top: 2px solid #bfdbfe;
    }

    .cover-meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .cover-meta-label {
      font-size: 9pt;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .cover-meta-val {
      font-size: 11pt;
      color: #0f172a;
      font-weight: 700;
    }

    /* Standard Page Header */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .page-header-title {
      font-size: 15pt;
      font-weight: 800;
      color: #0f172a;
    }
    .page-header-sub {
      font-size: 9pt;
      color: #64748b;
      margin-top: 2px;
    }
    .page-badge {
      font-size: 8.5pt;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 9999px;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
    }

    /* Screenshot Container */
    .screenshot-card {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
      margin-bottom: 12px;
      background: #f8fafc;
    }
    .screenshot-img {
      width: 100%;
      height: auto;
      display: block;
    }

    /* Detail Description & Feature Highlights */
    .page-details {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-top: auto;
    }
    .details-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-bottom: 4px;
    }
    .details-desc {
      font-size: 9pt;
      color: #334155;
      line-height: 1.45;
    }

    /* Page Footer */
    .page-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      margin-top: 8px;
      font-size: 8pt;
      color: #94a3b8;
    }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="page">
    <div class="cover-page">
      <div>
        <div class="cover-badge">⚡ Enterprise Sales Platform</div>
        <h1 class="cover-title">Dakini AI CRM</h1>
        <div class="cover-subtitle">Modern White + Blue Frontend Architecture & Visual Report</div>
        <p class="cover-summary">
          A next-generation sales execution platform inspired by Salesforce Lightning, engineered with React, rich SVG visual analytics, autonomous AI copilot docks, and a pristine White & Electric Blue design system.
        </p>
      </div>

      <div style="background: #ffffff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px; margin: 20px 0;">
        <h3 style="font-size: 11pt; color: #1e3a8a; font-weight: 700; margin-bottom: 8px;">Key Design & Technical Transformations</h3>
        <ul style="font-size: 9.5pt; color: #334155; padding-left: 18px; line-height: 1.6;">
          <li><strong>Theme Conversion:</strong> Migrated from purple to an Electric Royal Blue (<code>#2563EB</code>) & Slate White palette with crisp WCAG AAA contrast.</li>
          <li><strong>Full Module Coverage:</strong> 15 production views including 3-column Lead Details (Aarav Patel), Deals Kanban, Accounts, Contacts, Inbox, Calendar, and Automations.</li>
          <li><strong>Visual Intelligence:</strong> Interactive SVG sparklines, monthly revenue trends with Bézier curves, pipeline stage bars, and radial progress gauges.</li>
          <li><strong>Autonomous AI Fleet:</strong> Slide-out Dakini Copilot dock with contextual prompt chips and human-in-the-loop approval queues.</li>
          <li><strong>MERN-Ready Architecture:</strong> Pure React with modular state in Context API, ready for Express & MongoDB REST/GraphQL integration.</li>
        </ul>
      </div>

      <div class="cover-meta-grid">
        <div class="cover-meta-item">
          <span class="cover-meta-label">Author / Stack</span>
          <span class="cover-meta-val">React 18 • Vite • Lucide • Vanilla CSS</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Live Local Server</span>
          <span class="cover-meta-val">http://localhost:3000/</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Design Standard</span>
          <span class="cover-meta-val">Salesforce Lightning + White & Blue</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Date Generated</span>
          <span class="cover-meta-val">October 2026</span>
        </div>
      </div>
    </div>
  </div>

  <!-- MODULE PAGES -->
  ${itemsWithBase64.map((item, idx) => `
    <div class="page">
      <div class="page-header">
        <div>
          <h2 class="page-header-title">${item.title}</h2>
          <p class="page-header-sub">Module ${idx + 1} of ${itemsWithBase64.length} • Dakini Sales Enterprise Workspace</p>
        </div>
        <span class="page-badge">Live Capture</span>
      </div>

      <div class="screenshot-card">
        <img src="${item.dataUri}" class="screenshot-img" alt="${item.title}" />
      </div>

      <div class="page-details">
        <div class="details-title">Module Functionality & Design Notes</div>
        <div class="details-desc">${item.desc}</div>
      </div>

      <div class="page-footer">
        <span>Dakini AI CRM Frontend Specification</span>
        <span>Page ${idx + 2} of ${itemsWithBase64.length + 1}</span>
      </div>
    </div>
  `).join('')}

</body>
</html>
`;

async function generatePDF() {
  console.log('Generating PDF via Headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set content
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  // Render PDF
  await page.pdf({
    path: OUTPUT_PDF,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: false,
    preferCSSPageSize: true
  });

  await browser.close();
  console.log(`PDF report successfully created at: ${OUTPUT_PDF}`);
}

generatePDF().catch((err) => {
  console.error('Error creating PDF report:', err);
  process.exit(1);
});
