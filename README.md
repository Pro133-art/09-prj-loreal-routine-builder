# Project 9: L'Oréal Routine Builder

L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder.

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Safe API key setup with Cloudflare Workers

If your OpenAI key was exposed in the frontend, use this safer setup:

1. Keep your key out of browser code.
2. Deploy [cloudflare-worker.js](cloudflare-worker.js) as a Cloudflare Worker.
3. In Cloudflare Worker settings, add a secret named `OPENAI_API_KEY`.
4. In [script.js](script.js), set `CLOUDFLARE_WORKER_URL` to your Worker URL.

The app now uses Cloudflare Worker only and does not require `secrets.js`.
