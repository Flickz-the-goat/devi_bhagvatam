from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import get_db


# =========================================================
# APP CONFIG
# =========================================================

app = FastAPI(
    title="Devi Bhagavatam API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# GET ALL BOOKS
# =========================================================

@app.get("/books")
def get_books():

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id, name
            FROM books
            ORDER BY id;
        """)

        books = cursor.fetchall()

        return {
            "books": [
                {
                    "id": book[0],
                    "name": book[1]
                }
                for book in books
            ]
        }

    finally:
        cursor.close()
        conn.close()


# =========================================================
# GET PAGES OF A BOOK
# =========================================================

@app.get("/books/{book_id}/pages")
def get_book_pages(book_id: int):

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id
            FROM books
            WHERE id = %s;
        """, (book_id,))

        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=404,
                detail="Book not found"
            )

        cursor.execute("""
            SELECT id, book_id, page_number
            FROM pages
            WHERE book_id = %s
            ORDER BY page_number;
        """, (book_id,))

        pages = cursor.fetchall()

        return {
            "book_id": book_id,
            "pages": [
                {
                    "id": page[0],
                    "book_id": page[1],
                    "page_number": page[2]
                }
                for page in pages
            ]
        }

    finally:
        cursor.close()
        conn.close()


# =========================================================
# GET RAW TEXT OF A PAGE
# =========================================================

@app.get("/pages/{page_id}/texts")
def get_page_texts(page_id: int):

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id
            FROM pages
            WHERE id = %s;
        """, (page_id,))

        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=404,
                detail="Page not found"
            )

        cursor.execute("""
            SELECT id, page_id, type, text
            FROM raw_text
            WHERE page_id = %s
            ORDER BY id;
        """, (page_id,))

        rows = cursor.fetchall()

        return {
            "page_id": page_id,
            "texts": [
                {
                    "id": row[0],
                    "page_id": row[1],
                    "type": row[2],
                    "text": row[3]
                }
                for row in rows
            ]
        }

    finally:
        cursor.close()
        conn.close()


# =========================================================
# GET PAGE CONTENT WITH TRANSLATIONS
# =========================================================

@app.get("/pages/{page_id}/content")
def get_page_content(page_id: int):

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id, book_id, page_number
            FROM pages
            WHERE id = %s;
        """, (page_id,))

        page = cursor.fetchone()

        if page is None:
            raise HTTPException(
                status_code=404,
                detail="Page not found"
            )

        cursor.execute("""
            SELECT
                r.id,
                r.page_id,
                r.type,
                r.text,
                t.id AS translation_id,
                t.text_id,
                t.translation
            FROM raw_text r
            LEFT JOIN LATERAL (
                SELECT
                    id,
                    text_id,
                    translation
                FROM translations
                WHERE text_id = r.id
                ORDER BY id DESC
                LIMIT 1
            ) t ON TRUE
            WHERE r.page_id = %s
            ORDER BY r.id;
        """, (page_id,))

        rows = cursor.fetchall()

        content = []

        for row in rows:

            translation = None

            if row[4] is not None:
                translation = {
                    "id": row[4],
                    "text_id": row[5],
                    "translation": row[6]
                }

            content.append({
                "id": row[0],
                "page_id": row[1],
                "type": row[2],
                "text": row[3],
                "translation": translation
            })

        return {
            "page_id": page[0],
            "book_id": page[1],
            "page_number": page[2],
            "content": content
        }

    finally:
        cursor.close()
        conn.close()

