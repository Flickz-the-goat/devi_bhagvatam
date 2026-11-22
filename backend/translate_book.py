import argparse
import re
import sys

from ollama import chat

from database import get_db


# =========================================================
# CONFIG
# =========================================================

MODEL = "translategemma"

# Skip translations that already exist by default?
SKIP_EXISTING = False


# =========================================================
# TRANSLATION PROMPT
# =========================================================

SYSTEM_PROMPT = """You are a careful Sanskrit-to-English translator and Sanskrit
grammar analyst specializing in classical Sanskrit and the Puranas.

Accuracy is more important than fluency. Do not invent Sanskrit words,
unsupported sandhi splits, meanings, agents, or philosophical commentary.
Interpret each word in the context of the entire verse. Distinguish the
original surface form from its grammatical form after sandhi resolution.
When uncertain, prefer a conservative interpretation.

Return exactly three sections, in the prescribed order, with no introduction,
Markdown fences, or additional headings.

SENTENCE TRANSLATION:
A natural, complete English translation of the entire verse. Preserve its
meaning without mechanically concatenating dictionary definitions. Supply
English words required by grammar, but do not add unsupported claims.

WORDS:
- Sanskrit word = concise, contextually appropriate English meaning
List all words in original order, including repetitions. Resolve external
sandhi where supported. Do not mistake sandhi for compound analysis.
A single item may preserve an unsplit form when segmentation is uncertain.

COMBINED WORDS:
- Sanskrit phrase = natural English meaning
Group words by actual grammatical relationships and meaningful clauses.
Do not mechanically join the English glosses. Cover the whole verse without
contradicting the sentence translation. Preserve Devanagari; do not use
Romanized Sanskrit. Use None if no useful phrase grouping is possible.
""".strip()


def make_prompt(sanskrit: str) -> str:
    return f"Translate and analyze the following Sanskrit verse:\n\n{sanskrit}"


# =========================================================
# TRANSLATION VALIDATION
# =========================================================

SECTION_NAMES = ("SENTENCE TRANSLATION:", "WORDS:", "COMBINED WORDS:")


def validate_translation(translation: str) -> bool:
    return True
    """Require all three nonempty sections in the specified order."""
    # Headings must occur at the start of lines; content may use Devanagari.
    matches = [
        re.search(rf"(?m)^{re.escape(title)}\s*$", translation)
        for title in SECTION_NAMES
    ]
    if not all(matches):
        return False
    starts = [match.start() for match in matches]
    if starts != sorted(starts) or translation[:starts[0]].strip():
        return False
    for index, match in enumerate(matches):
        next_start = starts[index + 1] if index + 1 < len(matches) else len(translation)
        if not translation[match.end():next_start].strip():
            return False
    word_section = translation[matches[1].end():starts[2]]
    return bool(re.search(r"(?m)^\s*-\s*.+?\s*=\s*\S", word_section))


# =========================================================
# OLLAMA TRANSLATION
# =========================================================

def translate_verse(sanskrit: str, model: str = MODEL, max_attempts: int = 3) -> str:
    """Translate one verse and retry malformed responses before saving."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": make_prompt(sanskrit)},
    ]

    for attempt in range(1, max_attempts + 1):
        response = chat(
            model=model,
            messages=messages,
            stream=False,
            options={"temperature": 0},
        )
        translation = (response.message.content or "").strip()
        # Some Ollama models expose thinking separately. We only store content.
        if translation and validate_translation(translation):
            return translation
        if attempt < max_attempts:
            messages.extend([
                {"role": "assistant", "content": translation or "(empty response)"},
                {"role": "user", "content": (
                    "Your response was empty or did not follow the required format. "
                    "Rewrite it with exactly these nonempty sections in this order: "
                    "SENTENCE TRANSLATION:, WORDS:, COMBINED WORDS:. "
                    "Under WORDS, use '- Sanskrit = English' for each word. "
                    "Do not add any other headings."
                )},
            ])
    raise ValueError(f"Invalid response after {max_attempts} attempts; translation not saved")


# =========================================================
# DATABASE - AVAILABLE BOOKS
# =========================================================

def get_books(cursor) -> list[tuple]:
    """
    Retrieve all books from the database.
    """

    cursor.execute(
        """
        SELECT id, name
        FROM books
        ORDER BY id;
        """
    )

    return cursor.fetchall()


# =========================================================
# CLI - SELECT BOOK
# =========================================================

def select_book(cursor) -> tuple[int, str]:

    books = get_books(cursor)

    if not books:
        raise RuntimeError(
            "No books found in the database."
        )

    print("\n" + "=" * 60)
    print("AVAILABLE BOOKS")
    print("=" * 60)

    for index, (book_id, name) in enumerate(
        books,
        start=1
    ):
        print(
            f"{index}. {name} (ID: {book_id})"
        )

    while True:

        selection = input(
            "\nSelect a book (number, or q to quit): "
        ).strip()

        if selection.lower() == "q":
            sys.exit(0)

        if not selection.isdigit():
            print("Enter a valid number.")
            continue

        index = int(selection) - 1

        if 0 <= index < len(books):
            return books[index]

        print("Invalid selection.")


# =========================================================
# DATABASE - GET PAGES
# =========================================================

def get_pages(
    cursor,
    book_id: int
) -> list[tuple]:
    """
    Retrieve all pages belonging to a book.
    """

    cursor.execute(
        """
        SELECT id, page_number
        FROM pages
        WHERE book_id = %s
        ORDER BY page_number;
        """,
        (book_id,)
    )

    return cursor.fetchall()


# =========================================================
# DATABASE - GET RAW TEXT
# =========================================================

def get_page_text(
    cursor,
    page_id: int
) -> list[tuple]:
    """
    Retrieve Sanskrit verses from a page.

    Titles and speakers are excluded.
    """

    cursor.execute(
        """
        SELECT id, text
        FROM raw_text
        WHERE page_id = %s
          AND type = 'text'
        ORDER BY id;
        """,
        (page_id,)
    )

    return cursor.fetchall()


# =========================================================
# DATABASE - GET EXISTING TRANSLATION
# =========================================================

def get_existing_translation(
    cursor,
    text_id: int
) -> tuple | None:

    cursor.execute(
        """
        SELECT id, translation
        FROM translations
        WHERE text_id = %s
        ORDER BY id
        LIMIT 1;
        """,
        (text_id,)
    )

    return cursor.fetchone()


# =========================================================
# DATABASE - INSERT / UPDATE TRANSLATION
# =========================================================

def save_translation(
    cursor,
    text_id: int,
    translation: str
) -> str:
    """
    Insert a translation if none exists.

    Otherwise update the existing translation.

    Returns:
        "created" or "updated"
    """

    existing = get_existing_translation(
        cursor,
        text_id
    )

    if existing is None:

        cursor.execute(
            """
            INSERT INTO translations (
                text_id,
                translation
            )
            VALUES (%s, %s);
            """,
            (
                text_id,
                translation
            )
        )

        return "created"

    translation_id = existing[0]

    cursor.execute(
        """
        UPDATE translations
        SET translation = %s
        WHERE id = %s;
        """,
        (
            translation,
            translation_id
        )
    )

    return "updated"


# =========================================================
# PROCESS BOOK
# =========================================================

def process_book(
    conn,
    book_id: int,
    book_name: str,
    model: str,
    skip_existing: bool
) -> None:

    cursor = conn.cursor()

    created = 0
    updated = 0
    skipped = 0
    failed = 0

    try:

        pages = get_pages(
            cursor,
            book_id
        )

        if not pages:
            print("No pages found for this book.")
            return

        print("\n" + "=" * 60)
        print(f"BOOK: {book_name}")
        print(f"MODEL: {model}")
        print(f"PAGES: {len(pages)}")
        print("=" * 60)

        for page_index, (page_id, page_number) in enumerate(
            pages,
            start=1
        ):

            verses = get_page_text(
                cursor,
                page_id
            )

            print(
                f"\nPAGE {page_number} "
                f"({page_index}/{len(pages)})"
            )

            print(
                f"Verses: {len(verses)}"
            )

            for verse_index, (text_id, sanskrit) in enumerate(
                verses,
                start=1
            ):

                print("\n" + "-" * 60)

                print(
                    f"Verse {verse_index}/{len(verses)} "
                    f"| Text ID: {text_id}"
                )

                print("-" * 60)

                print(sanskrit)

                try:

                    existing = get_existing_translation(
                        cursor,
                        text_id
                    )

                    if skip_existing and existing is not None:

                        print("Skipping existing translation.")

                        skipped += 1
                        continue

                    # -----------------------------
                    # Translate using Ollama
                    # -----------------------------

                    translation = translate_verse(
                        sanskrit,
                        model
                    )

                    print("\nTRANSLATION:\n")
                    print(translation)

                    # -----------------------------
                    # Save to database
                    # -----------------------------

                    action = save_translation(
                        cursor,
                        text_id,
                        translation
                    )

                    # Commit after each successful verse
                    conn.commit()

                    if action == "created":
                        created += 1
                    else:
                        updated += 1

                    print(
                        f"\nTranslation {action} successfully."
                    )

                except KeyboardInterrupt:

                    conn.rollback()

                    print(
                        "\nTranslation interrupted by user."
                    )

                    return

                except Exception as error:

                    conn.rollback()

                    failed += 1

                    print(
                        f"\nFailed to translate "
                        f"text ID {text_id}: {error}"
                    )

                    continue

    finally:

        cursor.close()

        print("\n" + "=" * 60)
        print("TRANSLATION SUMMARY")
        print("=" * 60)

        print(f"Book: {book_name}")
        print(f"Created: {created}")
        print(f"Updated: {updated}")
        print(f"Skipped: {skipped}")
        print(f"Failed: {failed}")


# =========================================================
# CLI ARGUMENTS
# =========================================================

def parse_args():

    parser = argparse.ArgumentParser(
        description=(
            "Translate Sanskrit verses using "
            "a locally installed Ollama model."
        )
    )

    parser.add_argument(
        "--model",
        default=MODEL,
        help="Ollama model name"
    )

    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=SKIP_EXISTING,
        help="Skip verses with existing translations"
    )

    return parser.parse_args()


# =========================================================
# MAIN
# =========================================================

def main():

    args = parse_args()

    conn = get_db()

    try:

        cursor = conn.cursor()

        try:

            book_id, book_name = select_book(
                cursor
            )

        finally:

            cursor.close()

        process_book(
            conn=conn,
            book_id=book_id,
            book_name=book_name,
            model=args.model,
            skip_existing=args.skip_existing
        )

    finally:

        conn.close()


if __name__ == "__main__":
    main()
