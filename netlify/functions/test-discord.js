const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

exports.handler = async (event) => {
  // Allow GET or POST
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!DISCORD_WEBHOOK) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'DISCORD_WEBHOOK_URL environment variable not set' }),
    };
  }

  const testMessage = 'Trading Alerts webhook is connected and working.';

  try {
    const response = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: testMessage }),
    });

    if (!response.ok) {
      throw new Error(`Discord responded with ${response.status}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Test message sent to Discord' }),
    };
  } catch (err) {
    console.error('Discord webhook error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send test message to Discord' }),
    };
  }
};
