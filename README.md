# Objective

A simple tool to help me manage budget based on categories. It was inspired by the need to ensure I don't exceed my annual insurance budget. I connect it to a WhatsApp bot such that I can 
1. Send a message to the WhatsApp bot in the format `name, category, amount` (e.g. John, Toys, 235.10)
2. This gets written to a Google Sheet
3. Bot responds with a summary of spend per person per category.

I use Koyeb for my webserver as it offers a free-tier that does not go to sleep. Twilio powers the WhatsApp bot and is currently in sandbox.
