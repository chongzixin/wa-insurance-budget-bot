const express = require('express');
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
        const a = parseFloat(row._rawData[2] || 0);
        if (!totals[n]) totals[n] = {};
        if (!totals[n][c]) totals[n][c] = 0;
        totals[n][c] += a;
    });
    return totals;
}

app.post('/bot', async (req, res) => {
    const body = req.body.Body || '';
    try {
        const [name, category, amountStr] = body.split(',').map(s => s.trim());
        if (!name || !category || !amountStr) throw new Error();
        const amount = parseFloat(amountStr);
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

app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
