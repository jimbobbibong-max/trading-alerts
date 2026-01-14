const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const NOTION_DB = process.env.NOTION_WATCHLIST_DB;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

exports.handler = async (event) => {
  // Only allow POST requests
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

  const { ticker, price } = payload;

  if (!ticker || !price) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: ticker and price' }),
    };
  }

  // Query Notion database for the ticker
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

  // Extract field values
  const entryConditions = getRichText(properties['Entry Conditions']);
  const invalidationLevel = getRichText(properties['Invalidation Level']);
  const industryETF = getRichText(properties['Industry ETF']);
  const demandZone = getRichText(properties['Demand Zone']);
  const tier = getSelect(properties['Tier']);

  // Format Discord message
  const message = formatDiscordMessage({
    ticker: ticker.toUpperCase(),
    price,
    tier,
    demandZone,
    entryConditions,
    invalidationLevel,
    industryETF,
  });

  // Post to Discord
  try {
    const discordResponse = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
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

function formatDiscordMessage({ ticker, price, tier, demandZone, entryConditions, invalidationLevel, industryETF }) {
  let msg = `**${ticker}** hit $${price}\n\n`;

  if (tier) msg += `**Tier:** ${tier}\n`;
  if (demandZone) msg += `**Demand Zone:** ${demandZone}\n`;

  if (tier || demandZone) msg += '\n';

  if (entryConditions) msg += `${entryConditions}\n\n`;

  if (invalidationLevel) msg += `**Invalidation:** ${invalidationLevel}\n`;
  if (industryETF) msg += `**Sector:** ${industryETF}\n`;

  return msg.trim();
}
