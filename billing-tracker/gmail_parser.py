"""
Gmail Parser - Fetches and parses billing-related emails via Gmail API.

Uses Claude to intelligently extract billing data from email content,
including amounts, due dates, vendor names, and account numbers.
"""

import anthropic
import base64
import json
import os
import pickle
from datetime import datetime, timedelta
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Gmail API scope - read-only access to emails
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# Keywords that indicate a billing/invoice email
BILLING_KEYWORDS = [
    "invoice",
    "bill",
    "payment due",
    "statement",
    "amount due",
    "receipt",
    "charge",
    "subscription",
    "renewal",
    "billing",
    "payment confirmation",
    "auto-pay",
    "autopay",
    "monthly charge",
    "your bill",
    "payment received",
    "transaction",
]

EMAIL_PARSE_PROMPT = """Analyze this email and extract billing/payment information.
Return ONLY a JSON object (no markdown, no explanation):

{
  "vendor": "Company/service name",
  "date": "YYYY-MM-DD (date of email or billing date)",
  "due_date": "YYYY-MM-DD or null if not applicable",
  "total_amount": 0.00,
  "account_number": "account/reference number or null",
  "payment_status": "paid/due/overdue/confirmation",
  "category": "one of: utilities, food, transportation, office, subscription, insurance, medical, entertainment, rent, phone, internet, other",
  "description": "Brief description (e.g., 'Monthly internet bill - March 2026')",
  "is_billing_email": true,
  "source": "gmail"
}

If this is NOT a billing-related email, return:
{"is_billing_email": false}

Email subject: {subject}
Email from: {sender}
Email date: {date}
Email body:
{body}"""


def get_gmail_credentials(credentials_path: str = "config/credentials.json") -> Credentials:
    """
    Authenticate with Gmail API using OAuth2.

    First run requires browser-based auth. Subsequent runs use saved token.
    """
    token_path = "config/gmail_token.pickle"
    creds = None

    if os.path.exists(token_path):
        with open(token_path, "rb") as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(credentials_path):
                raise FileNotFoundError(
                    f"Gmail credentials not found at {credentials_path}.\n"
                    "Download from Google Cloud Console -> APIs & Services -> Credentials.\n"
                    "See SETUP_GUIDE.md for detailed instructions."
                )
            flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(token_path, "wb") as token:
            pickle.dump(creds, token)

    return creds


def get_email_body(payload: dict) -> str:
    """Extract plain text body from Gmail message payload."""
    body = ""

    if "parts" in payload:
        for part in payload["parts"]:
            if part["mimeType"] == "text/plain" and "data" in part.get("body", {}):
                body += base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
            elif "parts" in part:
                body += get_email_body(part)
    elif "body" in payload and "data" in payload["body"]:
        body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

    return body


def build_billing_query(days_back: int = 7, label: str | None = None) -> str:
    """Build Gmail search query for billing emails."""
    date_after = (datetime.now() - timedelta(days=days_back)).strftime("%Y/%m/%d")
    keyword_query = " OR ".join(BILLING_KEYWORDS)
    query = f"after:{date_after} ({keyword_query})"

    if label and label != "INBOX":
        query = f"label:{label} {query}"

    return query


def fetch_billing_emails(
    days_back: int = 7,
    label: str | None = None,
    max_results: int = 50,
    credentials_path: str = "config/credentials.json",
) -> list[dict]:
    """
    Fetch recent billing-related emails from Gmail.

    Returns list of raw email data (subject, sender, date, body).
    """
    creds = get_gmail_credentials(credentials_path)
    service = build("gmail", "v1", credentials=creds)

    query = build_billing_query(days_back, label)
    print(f"  Gmail query: {query[:80]}...")

    results = service.users().messages().list(
        userId="me", q=query, maxResults=max_results
    ).execute()

    messages = results.get("messages", [])
    if not messages:
        print("  No billing emails found.")
        return []

    print(f"  Found {len(messages)} potential billing emails.")
    emails = []

    for msg_ref in messages:
        msg = service.users().messages().get(
            userId="me", id=msg_ref["id"], format="full"
        ).execute()

        headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}
        body = get_email_body(msg["payload"])

        # Truncate very long emails to avoid token waste
        if len(body) > 5000:
            body = body[:5000] + "\n... [truncated]"

        emails.append({
            "id": msg_ref["id"],
            "subject": headers.get("Subject", ""),
            "sender": headers.get("From", ""),
            "date": headers.get("Date", ""),
            "body": body,
        })

    return emails


def parse_email_with_claude(email: dict, api_key: str | None = None) -> dict:
    """Use Claude to extract structured billing data from an email."""
    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise ValueError("No API key. Set ANTHROPIC_API_KEY env var.")

    client = anthropic.Anthropic(api_key=key)

    prompt = EMAIL_PARSE_PROMPT.format(
        subject=email["subject"],
        sender=email["sender"],
        date=email["date"],
        body=email["body"],
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text.strip()

    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        result = {"is_billing_email": False, "parse_error": response_text}

    result["email_id"] = email["id"]
    result["email_subject"] = email["subject"]
    return result


def fetch_and_parse_billing_emails(
    days_back: int = 7,
    label: str | None = None,
    api_key: str | None = None,
    credentials_path: str = "config/credentials.json",
) -> list[dict]:
    """Full pipeline: fetch billing emails from Gmail, parse with Claude."""
    emails = fetch_billing_emails(days_back, label, credentials_path=credentials_path)

    billing_records = []
    for email in emails:
        print(f"  Parsing: {email['subject'][:60]}...")
        try:
            parsed = parse_email_with_claude(email, api_key)
            if parsed.get("is_billing_email", False):
                billing_records.append(parsed)
                print(f"    -> {parsed.get('vendor', '?')} | ${parsed.get('total_amount', '?')}")
            else:
                print(f"    -> Skipped (not billing-related)")
        except Exception as e:
            print(f"    -> Error: {e}")

    return billing_records


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    print("Fetching billing emails from last 7 days...")
    records = fetch_and_parse_billing_emails(days_back=7)
    print(f"\nFound {len(records)} billing records:")
    print(json.dumps(records, indent=2))
