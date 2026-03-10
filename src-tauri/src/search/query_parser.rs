/// Parsed search query — either FTS5 MATCH or regex mode.
#[derive(Debug, Clone)]
pub enum SearchQuery {
    Fts {
        match_expr: String,
        time_range: Option<String>,
        type_filter: Option<String>,
    },
    Regex {
        pattern: String,
        time_range: Option<String>,
        type_filter: Option<String>,
    },
}

/// Parse user search input into a SearchQuery.
///
/// - If input starts and ends with `/` (length > 2), treat as regex.
/// - Otherwise, build an FTS5 MATCH expression.
pub fn parse_query(
    input: &str,
    time_range: Option<String>,
    type_filter: Option<String>,
) -> SearchQuery {
    let trimmed = input.trim();

    // Regex mode: /pattern/
    if trimmed.len() > 2 && trimmed.starts_with('/') && trimmed.ends_with('/') {
        let pattern = trimmed[1..trimmed.len() - 1].to_string();
        return SearchQuery::Regex {
            pattern,
            time_range,
            type_filter,
        };
    }

    // FTS mode
    let match_expr = build_fts_expression(trimmed);
    SearchQuery::Fts {
        match_expr,
        time_range,
        type_filter,
    }
}

/// Build an FTS5 MATCH expression from user input.
///
/// Rules:
/// - `foo bar` → `"foo" AND "bar"`
/// - `"exact phrase"` → `"exact phrase"` (preserved)
/// - `-word` → `NOT "word"`
/// - FTS5 special characters are escaped in individual tokens.
pub fn build_fts_expression(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let mut parts: Vec<String> = Vec::new();
    let mut chars = trimmed.chars().peekable();

    while let Some(&ch) = chars.peek() {
        // Skip whitespace
        if ch.is_whitespace() {
            chars.next();
            continue;
        }

        // Quoted phrase: pass through as-is
        if ch == '"' {
            chars.next(); // consume opening quote
            let mut phrase = String::from('"');
            while let Some(&c) = chars.peek() {
                chars.next();
                phrase.push(c);
                if c == '"' {
                    break;
                }
            }
            // Ensure closing quote
            if !phrase.ends_with('"') || phrase.len() == 1 {
                phrase.push('"');
            }
            parts.push(phrase);
            continue;
        }

        // Negation: -word
        if ch == '-' {
            chars.next(); // consume '-'
            let token = consume_token(&mut chars);
            if !token.is_empty() {
                parts.push(format!("NOT \"{}\"", escape_fts_token(&token)));
            }
            continue;
        }

        // Regular token — use prefix matching (token*) for fuzzy search
        let token = consume_token_with_first(ch, &mut chars);
        if !token.is_empty() {
            let escaped = escape_fts_token(&token);
            // FTS5 prefix syntax: unquoted token followed by *
            // Only use prefix for tokens without special chars
            if token.chars().all(|c| c.is_alphanumeric() || c > '\x7f') {
                parts.push(format!("{}*", escaped));
            } else {
                parts.push(format!("\"{}\"", escaped));
            }
        }
    }

    parts.join(" AND ")
}

/// Consume a token (sequence of non-whitespace, non-quote chars).
fn consume_token(chars: &mut std::iter::Peekable<std::str::Chars>) -> String {
    let mut token = String::new();
    while let Some(&c) = chars.peek() {
        if c.is_whitespace() || c == '"' {
            break;
        }
        token.push(c);
        chars.next();
    }
    token
}

/// Consume a token starting with a known first character.
fn consume_token_with_first(
    first: char,
    chars: &mut std::iter::Peekable<std::str::Chars>,
) -> String {
    chars.next(); // consume the first char
    let mut token = String::new();
    token.push(first);
    while let Some(&c) = chars.peek() {
        if c.is_whitespace() || c == '"' {
            break;
        }
        token.push(c);
        chars.next();
    }
    token
}

/// Escape FTS5 special characters in a token.
/// Double any existing double-quotes inside the token.
fn escape_fts_token(token: &str) -> String {
    token.replace('"', "\"\"")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_words() {
        let expr = build_fts_expression("foo bar");
        assert_eq!(expr, "foo* AND bar*");
    }

    #[test]
    fn test_quoted_phrase() {
        let expr = build_fts_expression("\"exact phrase\"");
        assert_eq!(expr, "\"exact phrase\"");
    }

    #[test]
    fn test_negation() {
        let expr = build_fts_expression("foo -bar");
        assert_eq!(expr, "foo* AND NOT \"bar\"");
    }

    #[test]
    fn test_chinese_prefix() {
        let expr = build_fts_expression("你好");
        assert_eq!(expr, "你好*");
    }

    #[test]
    fn test_regex_mode() {
        let query = parse_query("/test.*pattern/", None, None);
        match query {
            SearchQuery::Regex { pattern, .. } => {
                assert_eq!(pattern, "test.*pattern");
            }
            _ => panic!("Expected regex mode"),
        }
    }

    #[test]
    fn test_fts_mode() {
        let query = parse_query("hello world", None, Some("PlainText".into()));
        match query {
            SearchQuery::Fts {
                match_expr,
                type_filter,
                ..
            } => {
                assert_eq!(match_expr, "hello* AND world*");
                assert_eq!(type_filter, Some("PlainText".into()));
            }
            _ => panic!("Expected FTS mode"),
        }
    }
}
