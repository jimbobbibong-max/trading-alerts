const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const NOTION_DB = process.env.NOTION_WATCHLIST_DB;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

const LEVEL_CONFIG = {
  execution: { emoji: '🔵', color: 0x3498db },
  demand: { emoji: '🟡', color: 0xf1c40f },
  pivot: { emoji: '⚪', color: 0x95a5a6 },
  strength: { emoji: '🟢', color: 0x2ecc71 },
  invalidation: { emoji: '🔴', color: 0xe74c3c },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON payload' }),
    };
  }

  const { ticker, price, level = 'execution' } = payload;

  if (!ticker || !price) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: ticker and price' }),
    };
  }

  let notionResponse;
  try {
    notionResponse = await notion.databases.query({
      database_id: NOTION_DB,
      filter: {
        property: 'Ticker',
        title: {
          equals: ticker.toUpperCase(),
        },
      },
    });
  } catch (err) {
    console.error('Notion API error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to query Notion database' }),
    };
  }

  if (notionResponse.results.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: `Ticker ${ticker} not found in watchlist` }),
    };
  }

  const page = notionResponse.results[0];
  const properties = page.properties;

  // Extract all field values
  const entryConditions = getRichText(properties['Entry Conditions']);
  const invalidationLevel = getRichText(properties['Invalidation Level']);
  const industryETF = getRichText(properties['Industry ETF']);
  const demandZone = getRichText(properties['Demand Zone']);
  const tier = getSelect(properties['Tier']);
  const strengthLevel = getRichText(properties['Strength Level']);
  const pivotLevel = getRichText(properties['Pivot Level']);
  const executionLines = getRichText(properties['Execution Lines']);

  // Build warnings
  const warnings = getWarnings(tier, entryConditions);

  // Determine colour (Radar tier overrides to red)
  const levelConfig = LEVEL_CONFIG[level] || LEVEL_CONFIG.execution;
  const embedColor = tier === 'Radar' ? 0xe74c3c : levelConfig.color;
  const emoji = levelConfig.emoji;

  // Build Discord embed
  const embed = buildEmbed({
    ticker: ticker.toUpperCase(),
    price,
    level,
    emoji,
    color: embedColor,
    warnings,
    tier,
    strengthLevel,
    pivotLevel,
    demandZone,
    executionLines,
    invalidationLevel,
    entryConditions,
    industryETF,
  });

  // Post to Discord
  try {
    const discordResponse = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!discordResponse.ok) {
      throw new Error(`Discord responded with ${discordResponse.status}`);
    }
  } catch (err) {
    console.error('Discord webhook error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to post to Discord' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, ticker: ticker.toUpperCase() }),
  };
};

function getRichText(property) {
  if (!property || property.type !== 'rich_text') return '';
  return property.rich_text.map((t) => t.plain_text).join('') || '';
}

function getSelect(property) {
  if (!property || property.type !== 'select') return '';
  return property.select?.name || '';
}

function getWarnings(tier, entryConditions) {
  const warnings = [];

  // Radar tier warning
  if (tier === 'Radar') {
    warnings.push('⚠️ RADAR STOCK - Review before acting');
  }

  // Paused entry warning
  if (entryConditions.includes('PAUSED') || entryConditions.includes('DO NOT ENTER')) {
    warnings.push('🛑 ENTRY PAUSED');
  }

  // Stale analysis warning
  const entryDate = parseEntryDate(entryConditions);
  if (entryDate && isStale(entryDate)) {
    warnings.push('⏰ STALE ANALYSIS - Refresh before acting');
  }

  return warnings;
}

function parseEntryDate(entryConditions) {
  // Match patterns like "ENTRY DATE: 14 Jan 2026" or "ENTRY DATE: 14 January 2026"
  const match = entryConditions.match(/ENTRY DATE:\s*(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (!match) return null;

  const [, day, month, year] = match;
  const monthMap = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };

  const monthNum = monthMap[month.toLowerCase()];
  if (monthNum === undefined) return null;

  return new Date(parseInt(year), monthNum, parseInt(day));
}

function isStale(entryDate) {
  const now = new Date();
  const diffMs = now - entryDate;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 7;
}

function buildEmbed({
  ticker,
  price,
  level,
  emoji,
  color,
  warnings,
  tier,
  strengthLevel,
  pivotLevel,
  demandZone,
  executionLines,
  invalidationLevel,
  entryConditions,
  industryETF,
}) {
  let description = '';

  // Warnings section
  if (warnings.length > 0) {
    description += warnings.join('\n') + '\n\n';
  }

  // Tier
  if (tier) {
    description += `**Tier:** ${tier}\n\n`;
  }

  // Levels section
  description += '**LEVELS:**\n';
  description += `🟢 Strength: ${strengthLevel || '-'}\n`;
  description += `⚪ Pivot: ${pivotLevel || '-'}\n`;
  description += `🟡 Demand: ${demandZone || '-'}\n`;
  description += `🔵 Execution: ${executionLines || '-'}\n`;
  description += `🔴 Invalidation: ${invalidationLevel || '-'}\n\n`;

  // Play section
  if (entryConditions) {
    description += `**PLAY:**\n${entryConditions}\n\n`;
  }

  // Sector
  if (industryETF) {
    description += `**Sector:** ${industryETF}\n\n`;
  }

  // Chart link
  description += `📈 [View Chart](https://www.tradingview.com/chart/?symbol=${ticker})`;

  return {
    title: `${emoji} ${ticker} hit $${price} [${level}]`,
    description,
    color,
    timestamp: new Date().toISOString(),
  };
}
