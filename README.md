# WhatsApp Insurance Budget Bot

A WhatsApp bot that helps you track spending across categories by logging entries to Google Sheets and providing spending summaries.
My original use case was to track my insurance spending but soon realise it can also be used for anything I spend too much money on (e.g. food and drinks). I use Koyeb for my webserver as it offers a free-tier that does not go to sleep. Twilio powers the WhatsApp bot and is currently in sandbox. 

Everything below, including the code is humbly created by GenAI.

## Features

- Track spending by person and category via WhatsApp messages
- Automatic logging to Google Sheets with current date
- Real-time spending summaries
- Simple message format: `name, category, amount`
- Free hosting on Koyeb

## Prerequisites

- Google account (for Google Sheets and Google Cloud)
- Twilio account (for WhatsApp integration)
- Koyeb account (for free hosting)

## Deployment Instructions

### Step 1: Fork and Clone

1. **Fork this repository** by clicking the "Fork" button
2. **Clone your fork:**
```
git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
cd REPO_NAME
```

### Step 2: Set Up Google Sheets

#### Create Your Spreadsheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet named `InsuranceBudget`
3. In the first row, add these headers exactly:

```
Name | Date | Amount | Category
```

4. **Copy your Sheet ID** from the URL:
```
https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
```

#### Set Up Google Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**:
- Go to "APIs & Services" > "Library"
- Search for "Google Sheets API" and enable it
4. Create service account credentials:
- Go to "APIs & Services" > "Credentials"
- Click "Create Credentials" > "Service Account"
- Fill in the details and create
- Download the JSON credentials file
5. **Share your Google Sheet** with the service account email (found in the credentials file)

### Step 3: Update the Code

1. **Open `index.js`** in your forked repository
2. **Replace the Sheet ID** on line 11:

```
const SHEET_ID = 'YOUR_SHEET_ID_HERE';
```


### Step 4: Prepare Credentials for Koyeb

Since we don't want to commit credentials to the repository, we'll use Koyeb Secrets:

1. **Convert your credentials to Base64:**
```
base64 --input path/to/your/credentials.json
```

Copy the entire Base64 output.

### Step 5: Deploy to Koyeb

#### Create Koyeb Secret
1. Go to [Koyeb Dashboard](https://app.koyeb.com/)
2. Click "Secrets" in the navigation
3. Click "Add secret"
4. Set:
- **Name:** `GCP_SA_KEY`
- **Value:** Paste your Base64 credentials string
5. Click "Create Secret"

#### Deploy Your Service
1. In Koyeb, click "Create Web Service"
2. Select "GitHub" as the source
3. Connect and select your forked repository
4. Choose "Buildpack" deployment method
5. **Configure environment variables:**
- Name: `GCP_SA_KEY`
- Value: `{{ secret.GCP_SA_KEY }}`
6. Click "Deploy"
7. Wait for deployment to complete and note your service URL

### Step 6: Set Up Twilio WhatsApp

1. **Sign up for Twilio** at [twilio.com](https://www.twilio.com/try-twilio)
2. **Activate WhatsApp Sandbox:**
- Go to Console > Messaging > Try it out > Send a WhatsApp message
- Follow the sandbox setup instructions
3. **Configure webhook:**
- Set the webhook URL to: `https://YOUR_KOYEB_URL.koyeb.app/bot`
- Replace `YOUR_KOYEB_URL` with your actual Koyeb service URL
4. **Join the sandbox** by sending the join code to the Twilio WhatsApp number

### Step 7: Test Your Bot

1. **Send a test message** to the Twilio WhatsApp number:
`Alice, physio, 50`

2. **You should receive a reply** with current spending totals
3. **Check your Google Sheet** to confirm the entry was logged

## Usage

Send WhatsApp messages in this format: `name, category, amount`


Examples:
- `Alice, physio, 50`
- `Bob, TCM, 75`
- `Charlie, specialist, 120`

The bot will:
1. Log the entry to your Google Sheet with today's date
2. Reply with current spending totals for all people and categories
