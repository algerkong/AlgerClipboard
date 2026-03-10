# Search Guide

AlgerClipboard features a powerful full-text search engine powered by SQLite FTS5. It supports multi-field search, pinyin matching, regex, time range filtering, and search history.

## Basic Search

Type keywords in the search bar to search across:

- **Text content** — clipboard text, rich text
- **AI summaries** — auto-generated AI summaries
- **File names** — names of copied files
- **Source app** — the application the content was copied from
- **Tags** — user-assigned tags
- **Pinyin** — Chinese pinyin (full spelling + initials)
- **Image OCR text** — text extracted from images via OCR

### Multi-Keyword Search

Separate keywords with spaces. All keywords must match (AND logic):

```
hello world       → entries containing both "hello" AND "world"
```

### Exact Phrase

Wrap a phrase in double quotes for exact matching:

```
"hello world"     → entries containing the exact phrase "hello world"
```

### Exclude Keywords

Prefix a keyword with `-` to exclude entries containing it:

```
hello -world      → entries with "hello" but NOT "world"
code -test -debug → entries with "code", excluding "test" and "debug"
```

### Combined Example

```
react "state management" -redux
```

Finds entries containing "react" and the exact phrase "state management", but not "redux".

## Regex Search

Wrap your pattern in forward slashes to use regex:

```
/\d{4}-\d{2}-\d{2}/     → match date patterns like 2024-01-15
/https?:\/\/\S+/         → match URLs
/TODO|FIXME|HACK/        → match any of these markers
/^import\s+/             → match lines starting with "import"
```

When regex mode is active, the search icon changes to `.*` as a visual indicator.

> **Note:** Regex search scans all fields but doesn't use the FTS index, so it may be slightly slower on very large datasets.

## Pinyin Search

Type pinyin to match Chinese content:

```
nihao        → matches "你好"
nh           → matches "你好" (initials)
jiemu        → matches "节目"
```

Both full pinyin and initial letters are indexed automatically.

## Time Range Filter

Hover over the search bar to reveal the calendar icon on the right. Click it to filter by time range:

| Option | Scope |
|--------|-------|
| All Time | No time restriction |
| Today | Entries from today |
| Last 3 Days | Last 3 days |
| This Week | Last 7 days |
| This Month | Last 30 days |
| Last 3 Months | Last 90 days |

When a time filter is active, the calendar icon stays highlighted with a dot indicator — even when the mouse leaves the search bar.

Time filters work together with keyword search.

## Search History

Hover over the search bar (with an empty input) to see your recent searches:

- Click a history item to re-run that search
- Click the **X** button on an item to delete it
- Click **Clear All History** to remove all records

Up to 50 search history items are stored. Duplicate searches update the existing record rather than creating a new one.

## Image OCR Search

When auto-OCR is enabled (Settings > OCR > Trigger Mode = "On Clipboard"), text is automatically extracted from copied images and indexed for search. This means you can search for text that appears in images.

When an image matches a search via its OCR text, the matching text snippet is shown below the image thumbnail with highlighted keywords.

## Search Result Highlighting

When searching, matching keywords are highlighted in the result list:

- **Text preview** — matching words highlighted in the entry card, showing context around the match
- **AI summary** — matching words highlighted in the summary block
- **File names** — matching words highlighted in file path entries
- **Image OCR text** — matching OCR text shown below image thumbnails

Highlighting works for both normal keyword search and regex mode. Text previews are context-aware — when the match is not near the beginning of the text, the preview scrolls to show the surrounding context.

## Tips

- Search is **case-insensitive** for both normal and regex modes
- Results are ranked by **relevance** (FTS5 ranking) when using keyword search
- Results are sorted by **creation date** when using regex search
- The search debounces input by 200ms to avoid excessive queries
- Pinned entries always appear first regardless of search ranking
