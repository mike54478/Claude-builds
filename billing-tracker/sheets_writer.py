"""
Google Sheets Writer - Pushes extracted billing data to your Google Sheet.

Handles authentication, formatting, duplicate detection, and appending rows.
"""

import os
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials

# Sheets API scopes
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Column headers for the billing tracker sheet
HEADERS = [
    "Date",
    "Vendor",
    "Description",
    "Category",
    "Amount",
    "Tax",
    "Payment Method",
    "Status",
    "Due Date",
    "Source",
    "Added On",
]


def get_sheets_client(service_account_path: str = "config/service_account.json") -> gspread.Client:
    """Authenticate with Google Sheets using a service account."""
    if not os.path.exists(service_account_path):
        raise FileNotFoundError(
            f"Service account key not found at {service_account_path}.\n"
            "Download from Google Cloud Console -> IAM -> Service Accounts.\n"
            "See SETUP_GUIDE.md for instructions."
        )

    creds = Credentials.from_service_account_file(service_account_path, scopes=SCOPES)
    return gspread.authorize(creds)


def open_sheet(
    sheet_id: str,
    tab_name: str = "Sheet1",
    service_account_path: str = "config/service_account.json",
) -> gspread.Worksheet:
    """Open a specific tab in a Google Sheet."""
    client = get_sheets_client(service_account_path)
    spreadsheet = client.open_by_key(sheet_id)

    try:
        worksheet = spreadsheet.worksheet(tab_name)
    except gspread.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=tab_name, rows=1000, cols=len(HEADERS))

    return worksheet


def ensure_headers(worksheet: gspread.Worksheet) -> None:
    """Make sure the header row exists. Add it if the sheet is empty."""
    existing = worksheet.row_values(1)
    if not existing or existing[0] == "":
        worksheet.update("A1", [HEADERS])
        worksheet.format("A1:K1", {
            "textFormat": {"bold": True},
            "backgroundColor": {"red": 0.2, "green": 0.2, "blue": 0.2},
            "horizontalAlignment": "CENTER",
        })
        print("  Headers added to sheet.")


def record_to_row(record: dict) -> list:
    """Convert a billing record dict to a spreadsheet row."""
    return [
        record.get("date") or "",
        record.get("vendor") or "",
        record.get("description") or "",
        record.get("category") or "",
        record.get("total_amount") or "",
        record.get("tax_amount") or "",
        record.get("payment_method") or "",
        record.get("payment_status") or "",
        record.get("due_date") or "",
        record.get("source") or "",
        datetime.now().strftime("%Y-%m-%d %H:%M"),
    ]


def get_existing_entries(worksheet: gspread.Worksheet) -> set:
    """Get a set of (date, vendor, amount) tuples for duplicate detection."""
    all_values = worksheet.get_all_values()
    entries = set()
    for row in all_values[1:]:  # skip header
        if len(row) >= 5:
            entries.add((row[0], row[1], str(row[4])))
    return entries


def is_duplicate(record: dict, existing: set) -> bool:
    """Check if a record already exists in the sheet."""
    key = (
        record.get("date") or "",
        record.get("vendor") or "",
        str(record.get("total_amount") or ""),
    )
    return key in existing


def append_records(
    records: list[dict],
    sheet_id: str,
    tab_name: str = "Sheet1",
    service_account_path: str = "config/service_account.json",
    skip_duplicates: bool = True,
) -> dict:
    """
    Append billing records to Google Sheet.

    Returns summary with counts of added/skipped/errors.
    """
    if not records:
        return {"added": 0, "skipped": 0, "errors": 0}

    worksheet = open_sheet(sheet_id, tab_name, service_account_path)
    ensure_headers(worksheet)

    existing = get_existing_entries(worksheet) if skip_duplicates else set()
    rows_to_add = []
    skipped = 0

    for record in records:
        if skip_duplicates and is_duplicate(record, existing):
            print(f"  Skipping duplicate: {record.get('vendor')} | ${record.get('total_amount')}")
            skipped += 1
            continue
        rows_to_add.append(record_to_row(record))

    if rows_to_add:
        # Batch append for efficiency
        worksheet.append_rows(rows_to_add, value_input_option="USER_ENTERED")
        print(f"  Added {len(rows_to_add)} records to sheet.")

    return {
        "added": len(rows_to_add),
        "skipped": skipped,
        "errors": 0,
    }


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    if not sheet_id:
        print("Set GOOGLE_SHEET_ID in .env")
        exit(1)

    # Test with a sample record
    test_record = {
        "date": "2026-03-14",
        "vendor": "Test Entry",
        "description": "Test billing record",
        "category": "other",
        "total_amount": 0.00,
        "tax_amount": 0.00,
        "payment_method": "test",
        "payment_status": "paid",
        "due_date": None,
        "source": "manual_test",
    }

    result = append_records([test_record], sheet_id)
    print(f"Result: {result}")
