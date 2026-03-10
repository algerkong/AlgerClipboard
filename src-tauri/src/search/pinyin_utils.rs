use pinyin::ToPinyin;

/// Convert Chinese text to "full_pinyin initials" format.
/// E.g. "你好" → "ni hao nh"
/// Non-Chinese characters are kept as-is in the full pinyin part.
pub fn to_pinyin_text(input: &str) -> String {
    let mut full_pinyin = String::new();
    let mut initials = String::new();
    let mut has_pinyin = false;

    for ch in input.chars() {
        if let Some(pinyin) = ch.to_pinyin() {
            if !full_pinyin.is_empty() && !full_pinyin.ends_with(' ') {
                full_pinyin.push(' ');
            }
            full_pinyin.push_str(pinyin.plain());
            initials.push_str(&pinyin.plain()[..1]);
            has_pinyin = true;
        } else {
            // Keep non-Chinese characters as-is
            if ch == ' ' {
                if !full_pinyin.is_empty() && !full_pinyin.ends_with(' ') {
                    full_pinyin.push(' ');
                }
            } else {
                full_pinyin.push(ch);
            }
        }
    }

    if has_pinyin {
        format!("{} {}", full_pinyin.trim(), initials)
    } else {
        full_pinyin.trim().to_string()
    }
}

/// Return pinyin variants for search. Currently returns the keyword as-is.
/// Reserved for future expansion (e.g., fuzzy pinyin matching).
pub fn search_pinyin_variants(keyword: &str) -> Vec<String> {
    vec![keyword.to_string()]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_pinyin_text_chinese() {
        let result = to_pinyin_text("你好");
        assert!(result.contains("ni"));
        assert!(result.contains("hao"));
        assert!(result.contains("nh"));
    }

    #[test]
    fn test_to_pinyin_text_ascii() {
        let result = to_pinyin_text("hello");
        assert_eq!(result, "hello");
    }

    #[test]
    fn test_search_pinyin_variants() {
        let result = search_pinyin_variants("test");
        assert_eq!(result, vec!["test".to_string()]);
    }
}
