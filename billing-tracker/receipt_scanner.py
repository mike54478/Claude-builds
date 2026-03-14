"""
Receipt Scanner - Uses Claude Vision to extract billing data from receipt photos.

Drop a photo of any receipt into the receipts/ folder (or send from your phone),
and this module extracts vendor, amount, date, category, and line items.
"""

import anthropic
import base64
import json
import os
import sys
from pathlib import Path

SUPPORTED_FORMATS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"}

MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".heic": "image/heic",
}

EXTRACTION_PROMPT = """Analyze this receipt image and extract the billing information.
Return ONLY a JSON object with these fields (no markdown, no explanation):

{
  "vendor": "Business/company name",
  "date": "YYYY-MM-DD format",
  "total_amount": 0.00,
  "tax_amount": 0.00,
  "subtotal": 0.00,
  "payment_method": "card/cash/other",
  "category": "one of: utilities, food, transportation, office, subscription, insurance, medical, entertainment, other",
  "description": "Brief one-line description of the purchase",
  "line_items": [
    {"item": "item name", "quantity": 1, "price": 0.00}
  ],
  "source": "receipt_scan"
}

If any field is unclear or missing from the receipt, use null for that field.
Always return valid JSON."""


def encode_image(image_path: str) -> tuple[str, str]:
    """Read and base64-encode an image file."""
    path = Path(image_path)
    suffix = path.suffix.lower()

    if suffix not in SUPPORTED_FORMATS:
        raise ValueError(
            f"Unsupported format: {suffix}. Use: {', '.join(SUPPORTED_FORMATS)}"
        )

    media_type = MEDIA_TYPES.get(suffix, "image/jpeg")

    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")

    return data, media_type


def scan_receipt(image_path: str, api_key: str | None = None) -> dict:
    """
    Scan a receipt image and extract structured billing data.

    Args:
        image_path: Path to the receipt image file
        api_key: Anthropic API key (falls back to ANTHROPIC_API_KEY env var)

    Returns:
        Dictionary with extracted billing fields
    """
    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise ValueError(
            "No API key provided. Set ANTHROPIC_API_KEY or pass api_key parameter."
        )

    image_data, media_type = encode_image(image_path)
    client = anthropic.Anthropic(api_key=key)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {"type": "text", "text": EXTRACTION_PROMPT},
                ],
            }
        ],
    )

    response_text = message.content[0].text.strip()

    # Handle case where model wraps JSON in markdown code blocks
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        result = {
            "vendor": "PARSE_ERROR",
            "raw_response": response_text,
            "source": "receipt_scan",
        }

    result["source_file"] = str(image_path)
    return result


def scan_all_receipts(folder: str, api_key: str | None = None) -> list[dict]:
    """Scan all receipt images in a folder."""
    folder_path = Path(folder)
    if not folder_path.exists():
        print(f"Receipt folder not found: {folder}")
        return []

    results = []
    for file in sorted(folder_path.iterdir()):
        if file.suffix.lower() in SUPPORTED_FORMATS:
            print(f"  Scanning: {file.name}...")
            try:
                data = scan_receipt(str(file), api_key)
                results.append(data)
                print(f"    -> {data.get('vendor', '?')} | ${data.get('total_amount', '?')}")
            except Exception as e:
                print(f"    -> Error: {e}")
                results.append({"vendor": "ERROR", "error": str(e), "source_file": str(file)})

    return results


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    if len(sys.argv) < 2:
        print("Usage: python receipt_scanner.py <image_path_or_folder>")
        print("  Scan a single receipt:  python receipt_scanner.py receipt.jpg")
        print("  Scan a folder:          python receipt_scanner.py ./receipts/")
        sys.exit(1)

    target = sys.argv[1]

    if os.path.isdir(target):
        results = scan_all_receipts(target)
        print(f"\nScanned {len(results)} receipts:")
        print(json.dumps(results, indent=2))
    else:
        result = scan_receipt(target)
        print(json.dumps(result, indent=2))
