const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const twilio = require('twilio');
const app = express();
const PORT = process.env.PORT || 8000; // Koyeb expects 8000

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const SHEET_ID = '1ulatsc1tzHlkqvO3rvQitHmlH0vl_yRIXcZvnFro_po';

// Decode credentials from environment variable
const credsBase64 = process.env.GCP_INSURANCEBOT_KEY;
if (!credsBase64) {
    throw new Error('GCP_INSURANCEBOT_KEY environment variable is required');
}

// set up Google Sheets API authentication
const creds = JSON.parse(Buffer.from(credsBase64, 'base64').toString('utf8'));
const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// support Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;  // Set your Telegram bot token in env
const WEBHOOK_URL = 'https://monthly-correy-chongzixin-ef29d02a.koyeb.app/telegram-webhook'; // Replace with your actual webhook URL
axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}`); // set the telegram webhook

if (!TELEGRAM_BOT_TOKEN) {
    console.warn('Warning: TELEGRAM_BOT_TOKEN not set. Telegram support disabled.');
}

// --- Shared Helpers ---

/**
* Parse user input string in the format "name, category, amount".
* Returns { name, category, amount } or throws an error if invalid.
*/
function parseInput(text) {
    if (!text) throw new Error('Empty input');
    const parts = text.split(',').map(s => s.trim());
    if (parts.length !== 3) throw new Error('Input must be in "name, category, amount" format');
    const [name, category, amountStr] = parts;
    if (!name || !category || !amountStr) throw new Error('Missing fields');
    const amount = Math.round(parseFloat(amountStr) * 100) / 100;
    if (isNaN(amount)) throw new Error('Amount is not a valid number');
    return { name, category, amount };
}

/**
* Add a new entry to Google Sheet and get updated totals.
* Returns an object { [name]: { [category]: totalAmount ... } }
*/
async function addEntryAndGetTotals(name, category, amount, date) {
    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({ Name: name, Date: date, Amount: amount, Category: category });
    
    const rows = await sheet.getRows();
    
    const totals = {};
    rows.forEach(row => {
        const n = row._rawData[0]; // Assuming Name is the first column
        const c = row._rawData[3]; // Assuming Category is the fourth column
        const a = Math.round(parseFloat(row._rawData[2] || 0) * 100) / 100; // Assuming Amount is the third column, round to 2 decimal places
        if (!totals[n]) totals[n] = {};
        if (!totals[n][c]) totals[n][c] = 0;
        totals[n][c] += a;
    });
    return totals;
}

/**
* Format the totals object into a plain text message.
*/
function formatTotalsMessage(totals) {
    let msg = 'Current spending totals:\n';
    for (const [person, cats] of Object.entries(totals)) {
        msg += `${person}:\n`;
        for (const [cat, total] of Object.entries(cats)) {
            msg += ` ${cat}: ${total.toFixed(2)}\n`;
        }
    }
    return msg;
}

/**
* Process incoming message text and return the formatted reply message.
*/
async function processMessage(text) {
    const { name, category, amount } = parseInput(text);
    const date = new Date().toISOString().split('T')[0];
    const totals = await addEntryAndGetTotals(name, category, amount, date);
    return formatTotalsMessage(totals);
}

// --- WhatsApp / Twilio endpoint ---
app.post('/bot', async (req, res) => {
    const body = req.body.Body || '';
    const twiml = new twilio.twiml.MessagingResponse();
    
    try {
        const reply = await processMessage(body);
        twiml.message(reply);
    } catch (e) {
        console.error('WhatsApp handler error:', e.message);
        twiml.message('Error! Use format: name, category, amount');
    }
    
    res.set('Content-Type', 'text/xml');
    res.send(twiml.toString());
});

// --- Telegram webhook endpoint ---
if (TELEGRAM_BOT_TOKEN) {
  app.post('/telegram-webhook', async (req, res) => {
    const message = req.body.message;
    if (!message || !message.text) return res.sendStatus(200);

    const chatId = message.chat.id;

    try {
      const reply = await processMessage(message.text);
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: reply,
      });
    } catch (err) {
      console.error('Telegram handler error:', err.message);
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: 'Error! Please use the format: name, category, amount',
      });
    }

    return res.sendStatus(200);
  });
} else {
  console.warn('TELEGRAM_BOT_TOKEN not set. Telegram webhook disabled.');
}

app.listen(PORT, () => {
    console.log(`Bot running on port ${PORT}`)
    if(TELEGRAM_BOT_TOKEN){
        console.log('Telegram webhook endpoint enabled at /telegram-webhook');
    }
});
