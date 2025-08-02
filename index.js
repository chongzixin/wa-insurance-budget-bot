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

const creds = JSON.parse(Buffer.from(credsBase64, 'base64').toString('utf8'));

// Prepare JWT auth object
const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

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

// support twilio
app.post('/bot', async (req, res) => {
    const body = req.body.Body || '';
    try {
        const [name, category, amountStr] = body.split(',').map(s => s.trim());
        if (!name || !category || !amountStr) throw new Error();
        const amount = Math.round(parseFloat(amountStr) * 100) / 100; // Round to 2 decimal places
        if (isNaN(amount)) throw new Error();
        
        const currentDate = new Date().toISOString().split('T')[0];
        
        const totals = await addEntryAndGetTotals(name, category, amount, currentDate);
        
        let reply = 'Current spending totals:\n';
        Object.entries(totals).forEach(([person, cats]) => {
            reply += `${person}:\n`;
            Object.entries(cats).forEach(([cat, total]) => {
                reply += `  ${cat}: ${total}\n`;
            });
        });
        
        // Twilio WhatsApp expects XML (TwiML)
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message(reply);
        res.set('Content-Type', 'text/xml');
        res.send(twiml.toString());
    } catch (e) {
        console.error(e);
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message('Error! Use: name, category, amount');
        res.set('Content-Type', 'text/xml');
        res.send(twiml.toString());
    }
});

// support Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;  // Set your Telegram bot token in env
const WEBHOOK_URL = 'https://monthly-correy-chongzixin-ef29d02a.koyeb.app/telegram-webhook'; // Replace with your actual webhook URL
axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}`);

if (!TELEGRAM_BOT_TOKEN) {
    console.warn('Warning: TELEGRAM_BOT_TOKEN not set. Telegram support disabled.');
}

async function sendTelegramMessage(chatId, text) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
        });
    } catch (error) {
        console.error('Error sending message to Telegram:', error.message);
    }
}

app.post('/telegram-webhook', async (req, res) => {
    const message = req.body.message;
    if (!message || !message.text) {
        return res.sendStatus(200); // No message/text, ignore
    }
    
    try {
        const chatId = message.chat.id;
        // Expect messages in format: "Name, category, amount"
        const [name, category, amountStr] = message.text.split(',').map(s => s.trim());
        if (!name || !category || !amountStr) throw new Error('Invalid format');
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) throw new Error('Amount not a number');
        
        const currentDate = new Date().toISOString().split('T')[0];
        const totals = await addEntryAndGetTotals(name, category, amount, currentDate);
        
        let reply = '*Current spending totals:*\n';
        Object.entries(totals).forEach(([person, cats]) => {
            reply += `${person}:\n`;
            Object.entries(cats).forEach(([cat, total]) => {
                reply += ` • ${cat}: ${total}\n`;
            });
        });
        
        await sendTelegramMessage(chatId, reply);
    } catch (err) {
        console.error(err);
        const chatId = message.chat.id;
        await sendTelegramMessage(chatId, 'Error! Please use the format: name, category, amount');
    }
    
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Bot running on port ${PORT}`)
    if(TELEGRAM_BOT_TOKEN){
        console.log('Telegram webhook endpoint enabled at /telegram-webhook');
    }
});
