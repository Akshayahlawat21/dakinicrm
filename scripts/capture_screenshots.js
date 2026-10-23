import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.resolve('d:/CRM/screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const PAGES_TO_CAPTURE = [
  {
    name: '01_Dashboard_Overview',
    hash: '#/dashboard',
    title: 'Executive Dashboard & Commercial Snapshot',
    desc: 'Elena Rostova commercial snapshot with 6 KPI cards, sparkline growth, target progress gauge, revenue trend curve, and pipeline stages.',
    action: null
  },
  {
    name: '02_Dashboard_AI_Copilot',
    hash: '#/dashboard',
    title: 'Dakini AI Copilot & Approvals Dock',
    desc: 'Slide-out autonomous AI Copilot with context awareness, suggested action chips, and pending email approvals.',
    action: async (page, delay) => {
      // Click Ask Dakini button
      const btn = await page.$('.btn-sparkle');
      if (btn) await btn.click();
      await delay(500);
    }
  },
  {
    name: '03_Leads_Management',
    hash: '#/leads',
    title: 'Leads Directory & Scoring Pipeline',
    desc: 'Enterprise leads table with 248 prospective accounts, soft blue status pills, AI score progress meters, and bulk action bar.',
    action: null
  },
  {
    name: '04_Lead_Detail_Aarav_Patel',
    hash: '#/lead-detail',
    title: 'Salesforce 3-Column Lead Detail Record (Aarav Patel)',
    desc: 'Full 3-column architecture featuring AP avatar card, score 128, multi-dimension score breakdown bars, timeline, and contextual Copilot.',
    action: null
  },
  {
    name: '05_Deals_Pipeline_Kanban',
    hash: '#/deals',
    title: 'Active Deals & Opportunity Pipeline Kanban',
    desc: 'Salesforce Kanban board with stage totals, stuck deal amber warnings, velocity probability metrics, and Salesforce Path chevrons.',
    action: async (page, delay) => {
      // Click first deal to show Salesforce path
      const deal = await page.$('.deal-card');
      if (deal) await deal.click();
      await delay(400);
    }
  },
  {
    name: '06_Accounts_Directory',
    hash: '#/accounts',
    title: 'Accounts & Enterprise Companies Directory',
    desc: 'Company directory with ARR contracts, health score bars, website verification links, and 360-degree account drawer.',
    action: async (page, delay) => {
      // Click first account to show drawer
      const acc = await page.$('.crm-table tbody tr');
      if (acc) await acc.click();
      await delay(400);
    }
  },
  {
    name: '07_Contacts_Directory',
    hash: '#/contacts',
    title: 'Key Decision Makers & Buyers Directory',
    desc: 'Executive stakeholder directory across accounts with one-click Dakini AI draft outreach triggers.',
    action: null
  },
  {
    name: '08_Campaigns_Tracking',
    hash: '#/campaigns',
    title: 'Marketing Campaigns, Roadshows & ROI Analytics',
    desc: 'Roadshows, webinars, and inbound campaigns tracking budget spent, pipeline generated, and ROI percentages.',
    action: null
  },
  {
    name: '09_Tasks_Action_Queue',
    hash: '#/tasks',
    title: 'Tasks & Priority Action Queue',
    desc: 'Time-sensitive sales cadences categorized by Overdue (red alert), Today, and Tomorrow, with instant quick-add line.',
    action: null
  },
  {
    name: '10_Inbox_Communication',
    hash: '#/inbox',
    title: '3-Pane Email Client with CRM Record Linking',
    desc: 'Integrated mailbox with automatic CRM record detection and Dakini Smart Reply generator.',
    action: null
  },
  {
    name: '11_Calendar_Engagements',
    hash: '#/calendar',
    title: 'Calendar & Meeting Scheduler',
    desc: 'Weekly schedule of customer discovery calls, architecture reviews, and today’s video bridge agenda.',
    action: null
  },
  {
    name: '12_Reports_Analytics',
    hash: '#/reports',
    title: 'Pipeline Reports, Donut Attribution & Conversion Funnel',
    desc: 'Lead source donut attribution, 5-stage commercial conversion funnel, revenue pacing vs quota, and team leaderboard.',
    action: null
  },
  {
    name: '13_Automations_Builder',
    hash: '#/automations',
    title: 'Visual Workflow Builder Canvas',
    desc: 'Deterministic rule builder connecting Event Trigger -> Qualification Condition -> Autonomous Action execution.',
    action: null
  },
  {
    name: '14_AI_Agents_Fleet',
    hash: '#/agents',
    title: 'Dakini AI Autonomous Agents Fleet',
    desc: 'Autonomous agent fleet configuration with human-in-the-loop guardrails, activity logs, and 1-click undo.',
    action: null
  },
  {
    name: '15_Workspace_Settings',
    hash: '#/settings',
    title: 'Workspace Settings & Integrations',
    desc: '2-column enterprise preferences, team roles, custom CRM fields, and two-way Salesforce/Gmail connectors.',
    action: null
  }
];

async function run() {
  console.log('Launching Chrome via Puppeteer-Core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: {
      width: 1600,
      height: 980,
      deviceScaleFactor: 1.5
    },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Custom sleep helper
  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  console.log('Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await delay(1000);

  const manifest = [];

  for (const item of PAGES_TO_CAPTURE) {
    console.log(`Capturing: ${item.name} (${item.hash})...`);
    await page.goto(`http://localhost:3000/${item.hash}`, { waitUntil: 'networkidle0' });
    await delay(700);

    if (item.action) {
      await item.action(page, delay);
      await delay(500);
    }

    const filename = `${item.name}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);

    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`Saved screenshot: ${filename}`);

    manifest.push({
      file: filepath,
      filename: filename,
      title: item.title,
      desc: item.desc
    });
  }

  await browser.close();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('All screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});
