CREATE OR REPLACE FUNCTION analytics_is_bot_user_agent(
  value text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    COALESCE(value, '') ~* (
      'bot\M'
      || '|crawler'
      || '|spider'
      || '|slurp'
      || '|bingpreview'
      || '|headlesschrome'
      || '|chrome-lighthouse'
      || '|lighthouse'
      || '|pagespeed'
      || '|google-inspectiontool'
      || '|facebookexternalhit'
      || '|telegrambot'
      || '|whatsapp'
      || '|baiduspider'
      || '|duckduckbot'
      || '|petalbot'
      || '|semrushbot'
      || '|ahrefsbot'
      || '|mj12bot'
      || '|dotbot'
      || '|bytespider'
      || '|applebot'
      || '|gptbot'
      || '|chatgpt-user'
      || '|oai-searchbot'
      || '|claudebot'
      || '|anthropic-ai'
      || '|perplexitybot'
      || '|ccbot'
      || '|dataforseo'
      || '|serpstatbot'
      || '|seznambot'
      || '|siteauditbot'
      || '|uptimerobot'
      || '|pingdom'
      || '|statuscake'
      || '|playwright'
      || '|puppeteer'
      || '|\mcurl\M'
      || '|\mwget\M'
      || '|python-requests'
      || '|python-urllib'
      || '|go-http-client'
      || '|libwww-perl'
    );
$$;
