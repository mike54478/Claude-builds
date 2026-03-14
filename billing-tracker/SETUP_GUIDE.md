# Billing Tracker - Setup Guide

Automate your entire bill tracking: receipt photos from your phone + billing emails → Google Sheet.

## Architecture

```
Phone Photo ──→ receipts/ folder ──→ Claude Vision ──→ Google Sheet
                                                           ↑
Gmail Inbox ──→ Gmail API ──→ Claude AI Parser ────────────┘
```

## What You Need

| Component | Cost | Purpose |
|-----------|------|---------|
| Anthropic API Key | Pay-per-use (~$0.01/receipt) | Claude reads receipts & emails |
| Google Cloud Project | Free tier | Gmail + Sheets API access |
| Python 3.11+ | Free | Runs the tracker |

---

## Step 1: Install Python Dependencies

```bash
cd billing-tracker
pip install -r requirements.txt
```

## Step 2: Get Your Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Create an account or sign in
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-`)

## Step 3: Set Up Google Cloud Project

This is the most involved step, but you only do it once.

### 3a. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it `billing-tracker` → **Create**

### 3b. Enable APIs

In your Google Cloud project, enable these APIs:

1. Go to **APIs & Services** → **Library**
2. Search and enable: **Gmail API**
3. Search and enable: **Google Sheets API**
4. Search and enable: **Google Drive API**

### 3c. Set Up Gmail OAuth (for reading your emails)

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - User Type: **External**
   - App name: `Billing Tracker`
   - Add your email as a test user
4. Back in Credentials → **OAuth client ID**:
   - Application type: **Desktop app**
   - Name: `Billing Tracker Gmail`
5. Click **Download JSON**
6. Save as `config/credentials.json` in this project

### 3d. Set Up Service Account (for writing to Google Sheets)

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
   - Name: `billing-tracker-sheets`
   - Click **Create and Continue**
   - Skip the optional steps → **Done**
3. Click on the new service account → **Keys** tab
4. **Add Key** → **Create new key** → **JSON** → **Create**
5. Save the downloaded file as `config/service_account.json`

### 3e. Share Your Google Sheet with the Service Account

1. Open the JSON file you just saved
2. Find the `client_email` field (looks like `billing-tracker-sheets@project.iam.gserviceaccount.com`)
3. Open your Google Sheet
4. Click **Share** → paste that email → give **Editor** access

## Step 4: Configure Your .env File

```bash
cp .env.example .env
```

Edit `.env` with your values:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
GOOGLE_SHEET_ID=19WE81Vj3O8cvI7mvXl1zIggEuesGvIiX
GMAIL_BILLING_LABEL=INBOX
EMAIL_CHECK_INTERVAL=30
RECEIPT_WATCH_FOLDER=./receipts
SHEET_TAB_NAME=Sheet1
```

Your Google Sheet ID is the long string in the URL:
`https://docs.google.com/spreadsheets/d/THIS_PART/edit`

---

## Usage

### Scan a receipt photo
```bash
python billing_tracker.py scan receipt.jpg
```

### Scan all receipts in a folder
```bash
python billing_tracker.py scan ./receipts/
```

### Fetch billing emails (last 7 days)
```bash
python billing_tracker.py emails --days 7
```

### Full pipeline (receipts + emails → sheet)
```bash
python billing_tracker.py run --days 7
```

### Watch for new receipts (auto-process on drop)
```bash
python billing_tracker.py watch
```

### Dry run (preview without writing to sheet)
```bash
python billing_tracker.py run --dry-run
```

---

## Phone-to-Sheet Workflow (Receipt Photos)

The easiest ways to get receipt photos from your phone to the `receipts/` folder:

### Option A: Google Drive Sync (Recommended)
1. Install **Google Drive** on your phone
2. Create a folder called `BillingReceipts` in Drive
3. On your computer, use **Google Drive for Desktop** to sync that folder
4. Point `RECEIPT_WATCH_FOLDER` in `.env` to the synced folder
5. Run `python billing_tracker.py watch`
6. Now just photograph receipts and save to the Drive folder — they auto-process!

### Option B: iCloud/Dropbox/OneDrive
Same concept — sync a phone folder to your computer and point the watcher at it.

### Option C: Email Receipts to Yourself
1. Take a photo of a receipt
2. Email it to yourself with subject line containing "receipt"
3. The email parser will pick it up automatically

### Option D: Direct AirDrop/USB
Just drop photos directly into the `receipts/` folder.

---

## Automating with Cron (Run on a Schedule)

To auto-check emails every 30 minutes:

```bash
# Edit crontab
crontab -e

# Add this line (runs every 30 minutes)
*/30 * * * * cd /path/to/billing-tracker && /usr/bin/python3 billing_tracker.py emails --days 1 >> /tmp/billing-tracker.log 2>&1
```

For a daily full run (emails + any pending receipts):

```bash
# Daily at 8am
0 8 * * * cd /path/to/billing-tracker && /usr/bin/python3 billing_tracker.py run --days 1 >> /tmp/billing-tracker.log 2>&1
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `FileNotFoundError: credentials.json` | Complete Step 3c - download OAuth credentials |
| `FileNotFoundError: service_account.json` | Complete Step 3d - create service account key |
| `gspread.exceptions.SpreadsheetNotFound` | Share your Google Sheet with the service account email (Step 3e) |
| `ANTHROPIC_API_KEY not set` | Add your key to `.env` file |
| Gmail auth opens browser | Normal on first run - authorize the app |
| Duplicate entries | Built-in dedup checks (date + vendor + amount) |

## Cost Estimate

- **Claude API**: ~$0.01-0.03 per receipt/email processed (using Sonnet)
- **Google APIs**: Free (within standard quotas)
- Processing 100 bills/month: ~$1-3/month in API costs
