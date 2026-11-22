
import re
import requests

from bs4 import BeautifulSoup
from bs4.element import NavigableString, Tag

from database import get_db


# =========================================================
# CONFIG
# =========================================================

URL = "https://sanskritdocuments.org/doc_purana/devIbhAgavatam01.html"

# Book / Skandha information
BOOK_NAME = "Devi Bhagvatam / Skandha 1"

# Starting page number within this book
START_PAGE_NUMBER = 1

# Maximum number of shlokas per app page
SHLOKAS_PER_PAGE = 20


# =========================================================
# REGEX
# =========================================================

# Matches:
# ॥ १॥
# ॥ १२॥
# ॥ 123॥
VERSE_END = re.compile(
    r"॥\s*[०१२३४५६७८९0-9]+\s*॥"
)

# Matches:
# सूत उवाच ।
# शौनक उवाच ।
# व्यास उवाच ।
SPEAKER_PATTERN = re.compile(
    r"^([^।॥]*उवाच\s*(?:[।॥]|-))\s*"
)


# =========================================================
# SCRAPER
# =========================================================

def get_page() -> BeautifulSoup:

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/136.0.0.0 Safari/537.36"
        ),
        "Accept": (
            "text/html,application/xhtml+xml,"
            "application/xml;q=0.9,image/avif,"
            "image/webp,*/*;q=0.8"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://sanskritdocuments.org/",
    }

    print(f"Scraping {URL}")

    response = requests.get(
        URL,
        headers=headers,
        timeout=30
    )

    print(f"HTTP status: {response.status_code}")

    response.raise_for_status()

    return BeautifulSoup(
        response.text,
        "html.parser"
    )


# =========================================================
# TEXT CLEANING
# =========================================================

def clean_text(text: str) -> str:

    text = text.strip()

    lines = []

    for line in text.splitlines():

        line = re.sub(
            r"[ \t]+",
            " ",
            line
        ).strip()

        if line:
            lines.append(line)

    return "\n".join(lines)


# =========================================================
# SHLOKA SPLITTING
# =========================================================

def split_shlokas(text: str) -> list[str]:

    results = []
    last_end = 0

    for match in VERSE_END.finditer(text):

        shloka = text[
            last_end:match.end()
        ].strip()

        if shloka:
            results.append(shloka)

        last_end = match.end()

    remaining = text[last_end:].strip()

    if remaining:
        results.append(remaining)

    return results


# =========================================================
# SPEAKER DETECTION
# =========================================================

def separate_speaker(
    text: str
) -> tuple[str | None, str]:

    match = SPEAKER_PATTERN.match(text)

    if not match:
        return None, text

    speaker = match.group(1).strip()

    remaining = text[
        match.end():
    ].strip()

    return speaker, remaining


# =========================================================
# PARSE RAW SANSKRIT
# =========================================================

def parse_raw_text(text: str) -> list[dict]:

    parsed = []

    text = clean_text(text)

    if not text:
        return parsed

    shlokas = split_shlokas(text)

    for shloka in shlokas:

        speaker, verse = separate_speaker(shloka)

        if speaker:
            parsed.append({
                "type": "speaker",
                "text": speaker,
            })

        if verse:
            parsed.append({
                "type": "text",
                "text": verse,
            })

    return parsed


# =========================================================
# SCRAPE DOCUMENT
# =========================================================

def scrape() -> list[dict]:

    soup = get_page()

    content = soup.find(
        "pre",
        id="content"
    )

    if content is None:
        raise RuntimeError(
            "Could not find <pre id='content'>"
        )

    results = []

    for child in content.children:

        # -------------------------
        # H2 -> TITLE
        # -------------------------

        if (
            isinstance(child, Tag)
            and child.name == "h2"
        ):

            title = clean_text(
                child.get_text(
                    " ",
                    strip=True
                )
            )

            if title:
                results.append({
                    "type": "title",
                    "text": title,
                })

        # -------------------------
        # RAW TEXT
        # -------------------------

        elif isinstance(child, NavigableString):

            raw_text = clean_text(str(child))

            if not raw_text:
                continue

            parsed = parse_raw_text(raw_text)

            results.extend(parsed)

    return results


# =========================================================
# DATABASE - BOOK
# =========================================================

def get_or_create_book(
    cursor,
    book_name: str
) -> int:
    """
    Find an existing book by name.

    If it does not exist, create it.

    Returns:
        book_id
    """

    cursor.execute(
        """
        SELECT id
        FROM books
        WHERE name = %s
        ORDER BY id
        LIMIT 1;
        """,
        (book_name,)
    )

    row = cursor.fetchone()

    if row is not None:

        book_id = row[0]

        print(
            f"Found existing book: {book_name} "
            f"(ID: {book_id})"
        )

        return book_id

    cursor.execute(
        """
        INSERT INTO books (name)
        VALUES (%s)
        RETURNING id;
        """,
        (book_name,)
    )

    row = cursor.fetchone()

    if row is None:
        raise RuntimeError(
            "Failed to create book."
        )

    book_id = row[0]

    print(
        f"Created book: {book_name} "
        f"(ID: {book_id})"
    )

    return book_id


# =========================================================
# DATABASE - PAGE
# =========================================================

def create_page(
    cursor,
    book_id: int,
    page_number: int
) -> int:
    """
    Create a page belonging to a book.

    Prevents accidentally importing the same page twice.

    Returns:
        page_id
    """

    cursor.execute(
        """
        SELECT id
        FROM pages
        WHERE book_id = %s
          AND page_number = %s;
        """,
        (book_id, page_number)
    )

    existing_page = cursor.fetchone()

    if existing_page is not None:
        raise ValueError(
            f"Page {page_number} already exists "
            f"for book ID {book_id}. "
            "Import cancelled to prevent duplicate entries."
        )

    cursor.execute(
        """
        INSERT INTO pages (
            book_id,
            page_number
        )
        VALUES (%s, %s)
        RETURNING id;
        """,
        (book_id, page_number)
    )

    row = cursor.fetchone()

    if row is None:
        raise RuntimeError(
            "Failed to create page."
        )

    page_id = row[0]

    print(
        f"Created page {page_number} "
        f"(ID: {page_id})"
    )

    return page_id


# =========================================================
# DATABASE - RAW TEXT
# =========================================================

def insert_text_entries(
    cursor,
    page_id: int,
    results: list[dict]
) -> None:
    """
    Insert titles, speakers, and Sanskrit verses
    into the raw_text table.
    """

    for item in results:

        cursor.execute(
            """
            INSERT INTO raw_text (
                page_id,
                type,
                text
            )
            VALUES (%s, %s, %s);
            """,
            (
                page_id,
                item["type"],
                item["text"],
            )
        )

    print(
        f"Inserted {len(results)} raw text entries."
    )


# =========================================================
# PAGINATION
# =========================================================

def paginate_shlokas(
    results: list[dict],
    shlokas_per_page: int = SHLOKAS_PER_PAGE
) -> list[list[dict]]:
    """Group entries into pages with at most N shlokas each.

    Only entries with type='text' count toward the limit.
    Titles and speaker labels retain their original sequence and
    are placed with the shloka that follows them at a page boundary.
    """
    if shlokas_per_page < 1:
        raise ValueError("shlokas_per_page must be positive")

    pages = []
    current_page = []
    pending_metadata = []
    verse_count = 0

    for item in results:
        if item["type"] != "text":
            # Hold metadata so that if a page is already full, the
            # heading/speaker appears on the following page.
            pending_metadata.append(item)
            continue

        if verse_count == shlokas_per_page:
            pages.append(current_page)
            current_page = []
            verse_count = 0

        current_page.extend(pending_metadata)
        pending_metadata = []
        current_page.append(item)
        verse_count += 1

    # If only trailing metadata remains, keep it on the final page
    # rather than creating a page containing zero shlokas.
    current_page.extend(pending_metadata)

    if current_page:
        pages.append(current_page)

    return pages


# =========================================================
# DATABASE - IMPORT
# =========================================================

def import_to_database(
    book_name: str,
    start_page_number: int,
    results: list[dict],
    shlokas_per_page: int = SHLOKAS_PER_PAGE
) -> tuple[int, list[int]]:
    """Import all pages atomically; refuse to overwrite existing pages."""
    if start_page_number < 1:
        raise ValueError("start_page_number must be positive")

    pages = paginate_shlokas(results, shlokas_per_page)
    verse_total = sum(item["type"] == "text" for item in results)
    if not pages or not verse_total:
        raise ValueError("No Sanskrit shlokas found. Import cancelled.")

    conn = get_db()
    cursor = conn.cursor()

    try:
        book_id = get_or_create_book(cursor, book_name)

        # Check every destination before inserting any new pages.
        cursor.execute(
            """
            SELECT page_number FROM pages
            WHERE book_id = %s
              AND page_number >= %s
              AND page_number < %s
            ORDER BY page_number;
            """,
            (book_id, start_page_number, start_page_number + len(pages))
        )
        existing = [row[0] for row in cursor.fetchall()]
        if existing:
            raise ValueError(
                f"Pages already exist in book {book_id}: {existing}. "
                "Import cancelled; no data was changed."
            )

        page_ids = []
        for offset, entries in enumerate(pages):
            number = start_page_number + offset
            page_id = create_page(cursor, book_id, number)
            insert_text_entries(cursor, page_id, entries)
            page_ids.append(page_id)
            shlokas = sum(e["type"] == "text" for e in entries)
            print(f"Page {number}: {shlokas} shlokas, {len(entries)} entries")

        conn.commit()
        print("Database transaction committed.")
        return book_id, page_ids

    except Exception:
        conn.rollback()
        print("Import failed. Transaction rolled back.")
        raise

    finally:
        cursor.close()
        conn.close()


# =========================================================
# PRINT RESULTS
# =========================================================

def print_results(
    results: list[dict]
) -> None:

    for index, item in enumerate(results):

        print("=" * 70)

        print(
            f"{index} | {item['type'].upper()}"
        )

        print("=" * 70)

        print(item["text"])
        print()


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":
    results = scrape()
    print(f"\nExtracted {len(results)} blocks.\n")

    # To inspect the Sanskrit, uncomment:
    # print_results(results)

    pages = paginate_shlokas(results)
    print(f"Divided into {len(pages)} pages (max {SHLOKAS_PER_PAGE} shlokas/page).")

    book_id, page_ids = import_to_database(
        BOOK_NAME,
        START_PAGE_NUMBER,
        results
    )

    print("\n" + "=" * 70)
    print("IMPORT COMPLETE")
    print("=" * 70)
    print(f"Book: {BOOK_NAME} (ID: {book_id})")
    print(f"Pages created: {len(page_ids)}")
    print(f"Page range: {START_PAGE_NUMBER}-{START_PAGE_NUMBER + len(page_ids) - 1}")
    print(f"Shlokas: {sum(item['type'] == 'text' for item in results)}")
    print(f"Text entries: {len(results)}")

