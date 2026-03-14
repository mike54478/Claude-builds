#!/usr/bin/env python3
"""
Billing Tracker - Main orchestrator.

Commands:
  python billing_tracker.py scan <image_or_folder>   Scan receipt photo(s)
  python billing_tracker.py emails [--days 7]        Fetch billing emails
  python billing_tracker.py run [--days 7]           Full pipeline (emails + receipts -> sheet)
  python billing_tracker.py watch                    Watch receipts folder for new photos
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

from receipt_scanner import scan_receipt, scan_all_receipts, SUPPORTED_FORMATS
from gmail_parser import fetch_and_parse_billing_emails
from sheets_writer import append_records


def cmd_scan(args):
    """Scan receipt(s) and push to Google Sheet."""
    target = args.path
    sheet_id = os.environ.get("GOOGLE_SHEET_ID")

    print(f"\n--- Receipt Scanner ---")
    if os.path.isdir(target):
        records = scan_all_receipts(target)
    else:
        records = [scan_receipt(target)]

    print(f"\nExtracted {len(records)} record(s).")

    if args.dry_run:
        print(json.dumps(records, indent=2))
        return

    if sheet_id and not args.no_sheet:
        print(f"\nPushing to Google Sheet...")
        tab = os.environ.get("SHEET_TAB_NAME", "Sheet1")
        result = append_records(records, sheet_id, tab)
        print(f"Done: {result['added']} added, {result['skipped']} duplicates skipped.")
    else:
        print(json.dumps(records, indent=2))
        if not sheet_id:
            print("\nTip: Set GOOGLE_SHEET_ID in .env to auto-push to your sheet.")


def cmd_emails(args):
    """Fetch billing emails and push to Google Sheet."""
    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    label = os.environ.get("GMAIL_BILLING_LABEL")

    print(f"\n--- Email Parser (last {args.days} days) ---")
    records = fetch_and_parse_billing_emails(days_back=args.days, label=label)
    print(f"\nExtracted {len(records)} billing record(s) from email.")

    if args.dry_run:
        print(json.dumps(records, indent=2))
        return

    if sheet_id and not args.no_sheet:
        print(f"\nPushing to Google Sheet...")
        tab = os.environ.get("SHEET_TAB_NAME", "Sheet1")
        result = append_records(records, sheet_id, tab)
        print(f"Done: {result['added']} added, {result['skipped']} duplicates skipped.")
    else:
        print(json.dumps(records, indent=2))


def cmd_run(args):
    """Full pipeline: emails + receipts -> Google Sheet."""
    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    if not sheet_id and not args.dry_run:
        print("Error: GOOGLE_SHEET_ID not set in .env")
        sys.exit(1)

    all_records = []

    # 1. Scan receipts folder
    receipt_folder = os.environ.get("RECEIPT_WATCH_FOLDER", "./receipts")
    if os.path.isdir(receipt_folder) and any(
        f.suffix.lower() in SUPPORTED_FORMATS for f in Path(receipt_folder).iterdir()
    ):
        print(f"\n--- Scanning receipts in {receipt_folder} ---")
        receipt_records = scan_all_receipts(receipt_folder)
        all_records.extend(receipt_records)

    # 2. Fetch billing emails
    print(f"\n--- Fetching billing emails (last {args.days} days) ---")
    label = os.environ.get("GMAIL_BILLING_LABEL")
    try:
        email_records = fetch_and_parse_billing_emails(days_back=args.days, label=label)
        all_records.extend(email_records)
    except FileNotFoundError as e:
        print(f"  Gmail skipped: {e}")

    print(f"\n--- Total: {len(all_records)} records ---")

    if args.dry_run:
        print(json.dumps(all_records, indent=2))
        return

    if all_records:
        print(f"\nPushing to Google Sheet...")
        tab = os.environ.get("SHEET_TAB_NAME", "Sheet1")
        result = append_records(all_records, sheet_id, tab)
        print(f"\nDone: {result['added']} added, {result['skipped']} duplicates skipped.")
    else:
        print("No records to add.")


def cmd_watch(args):
    """Watch receipts folder for new images and auto-process them."""
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler
    except ImportError:
        print("Install watchdog: pip install watchdog")
        sys.exit(1)

    receipt_folder = os.environ.get("RECEIPT_WATCH_FOLDER", "./receipts")
    sheet_id = os.environ.get("GOOGLE_SHEET_ID")

    Path(receipt_folder).mkdir(parents=True, exist_ok=True)

    class ReceiptHandler(FileSystemEventHandler):
        def on_created(self, event):
            if event.is_directory:
                return
            path = Path(event.src_path)
            if path.suffix.lower() not in SUPPORTED_FORMATS:
                return

            # Small delay to ensure file is fully written
            time.sleep(1)
            print(f"\nNew receipt detected: {path.name}")
            try:
                record = scan_receipt(str(path))
                print(f"  -> {record.get('vendor', '?')} | ${record.get('total_amount', '?')}")

                if sheet_id:
                    tab = os.environ.get("SHEET_TAB_NAME", "Sheet1")
                    result = append_records([record], sheet_id, tab)
                    print(f"  -> Sheet: {result['added']} added")
                else:
                    print(json.dumps(record, indent=2))

                # Move processed receipt
                processed_dir = Path(receipt_folder) / "processed"
                processed_dir.mkdir(exist_ok=True)
                dest = processed_dir / path.name
                path.rename(dest)
                print(f"  -> Moved to {dest}")

            except Exception as e:
                print(f"  -> Error: {e}")

    observer = Observer()
    observer.schedule(ReceiptHandler(), receipt_folder, recursive=False)
    observer.start()

    print(f"\nWatching {receipt_folder} for new receipts...")
    print("Drop a receipt photo into that folder (or sync from your phone).")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


def main():
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Billing Tracker - Automate bill tracking with Claude AI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # scan command
    p_scan = subparsers.add_parser("scan", help="Scan receipt photo(s)")
    p_scan.add_argument("path", help="Image file or folder of images")
    p_scan.add_argument("--dry-run", action="store_true", help="Print results without writing to sheet")
    p_scan.add_argument("--no-sheet", action="store_true", help="Skip Google Sheets push")

    # emails command
    p_emails = subparsers.add_parser("emails", help="Fetch billing emails")
    p_emails.add_argument("--days", type=int, default=7, help="Days to look back (default: 7)")
    p_emails.add_argument("--dry-run", action="store_true", help="Print results without writing to sheet")
    p_emails.add_argument("--no-sheet", action="store_true", help="Skip Google Sheets push")

    # run command (full pipeline)
    p_run = subparsers.add_parser("run", help="Full pipeline: emails + receipts -> sheet")
    p_run.add_argument("--days", type=int, default=7, help="Days to look back for emails (default: 7)")
    p_run.add_argument("--dry-run", action="store_true", help="Print results without writing to sheet")

    # watch command
    subparsers.add_parser("watch", help="Watch receipts folder for new photos")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "scan": cmd_scan,
        "emails": cmd_emails,
        "run": cmd_run,
        "watch": cmd_watch,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
