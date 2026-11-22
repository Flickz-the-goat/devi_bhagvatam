BEGIN;
-- Delete existing tables and all their data
DROP TABLE IF EXISTS translations CASCADE;
DROP TABLE IF EXISTS raw_text CASCADE;
DROP TABLE IF EXISTS text CASCADE;
DROP TABLE IF EXISTS pages CASCADE;
DROP TABLE IF EXISTS books CASCADE;

-- 1. Books
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

-- 2. Pages
CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,

    UNIQUE (book_id, page_number)
);

-- 3. Raw OCR Text
CREATE TABLE raw_text (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL
        CHECK (type IN ('title', 'speaker', 'text')),
    text TEXT NOT NULL
);

-- 4. Translations
CREATE TABLE translations (
    id SERIAL PRIMARY KEY,
    text_id INTEGER NOT NULL REFERENCES raw_text(id) ON DELETE CASCADE,
    translation TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_pages_book_id ON pages(book_id);
CREATE INDEX idx_raw_text_page_id ON raw_text(page_id);
CREATE INDEX idx_translations_text_id ON translations(text_id);

COMMIT;
