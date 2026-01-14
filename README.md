# Trading Alerts

A webhook system that receives TradingView alerts, looks up stock details in Notion, and posts formatted entry conditions to Discord.

## Setup

### 1. Deploy to Netlify

1. Push this repo to GitHub
2. Connect the repo to Netlify
3. Netlify will automatically detect the functions directory

### 2. Configure Environment Variables

In your Netlify dashboard, go to **Site Settings > Environment Variables** and add:

| Variable | Description |
|----------|-------------|
| `NOTION_API_KEY` | Your Notion integration API key |
| `NOTION_WATCHLIST_DB` | The ID of your Notion watchlist database |
| `DISCORD_WEBHOOK_URL` | Your Discord channel webhook URL |

### 3. Test the Discord Connection

After deploying, visit:

```
https://your-site.netlify.app/.netlify/functions/test-discord
```

You should see a test message appear in your Discord channel.

### 4. Configure TradingView Alerts

1. Open TradingView and create a new alert on your desired ticker
2. In the alert settings, enable **Webhook URL**
3. Enter your webhook URL:
   ```
   https://your-site.netlify.app/.netlify/functions/webhook
   ```
4. Set the **Message** to:
   ```json
   {"ticker": "{{ticker}}", "price": "{{close}}"}
   ```
5. Save the alert

When the alert triggers, it will:
- Send the ticker and price to your webhook
- Look up the ticker in your Notion watchlist
- Post the entry conditions to Discord

## Notion Database Requirements

Your Notion database should have these properties:

| Property | Type | Description |
|----------|------|-------------|
| Ticker | Rich text | Stock ticker symbol (e.g. AAPL, MSFT) |
| Entry Conditions | Rich text | Your entry criteria for the trade |
| Invalidation Level | Rich text | Price level where the setup is invalid |
| Industry ETF | Select | The sector ETF (e.g. XLK, XLF) |
| Demand Zone | Rich text | The demand zone price range |
| Tier | Select | Your tier classification |

## Discord Message Format

When an alert triggers, you will receive a message like:

```
**GE** hit $314.05

**Tier:** A
**Demand Zone:** $310-315

Look for bullish engulfing on 5min chart with volume confirmation.

**Invalidation:** $308.50
**Sector:** XLI
```

## Troubleshooting

### Alert not posting to Discord

1. Check that all environment variables are set correctly in Netlify
2. Test the Discord webhook using the test endpoint
3. Verify the ticker exists in your Notion database (case insensitive)
4. Check the Netlify function logs for error details

### Ticker not found

The webhook searches for an exact match on the Ticker property. Ensure:
- The ticker in your TradingView alert matches your Notion entry
- The Ticker property in Notion is a rich text field

### Empty fields in Discord message

If some fields appear empty, verify that:
- The property names in Notion match exactly (including capitalisation)
- The property types are correct (rich text vs select)

## Local Development

To test locally with Netlify CLI:

```bash
npm install
netlify dev
```

Then send a test POST request:

```bash
curl -X POST http://localhost:8888/.netlify/functions/webhook \
  -H "Content-Type: application/json" \
  -d '{"ticker": "GE", "price": "314.05"}'
```
