use regex::Regex;
use std::sync::OnceLock;

struct SensitiveRule {
    name: &'static str,
    pattern: &'static str,
    validator: Option<fn(&str) -> bool>,
}

const RULES: &[SensitiveRule] = &[
    SensitiveRule {
        name: "bank_card",
        pattern: r"\b[3-6]\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",
        validator: Some(luhn_check),
    },
    SensitiveRule {
        name: "api_key_openai",
        pattern: r"\bsk-[a-zA-Z0-9]{20,}\b",
        validator: None,
    },
    SensitiveRule {
        name: "api_key_aws",
        pattern: r"\bAKIA[A-Z0-9]{16}\b",
        validator: None,
    },
    SensitiveRule {
        name: "api_key_github",
        pattern: r"\bghp_[a-zA-Z0-9]{36}\b",
        validator: None,
    },
    SensitiveRule {
        name: "private_key",
        pattern: r"-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----",
        validator: None,
    },
    SensitiveRule {
        name: "password_pattern",
        pattern: r"(?i)(password|passwd|pwd|secret|token)\s*[:=]\s*\S+",
        validator: None,
    },
    SensitiveRule {
        name: "id_card_cn",
        pattern: r"\b\d{17}[\dXx]\b",
        validator: None,
    },
    SensitiveRule {
        name: "phone_cn",
        pattern: r"\b1[3-9]\d{9}\b",
        validator: None,
    },
];

fn luhn_check(s: &str) -> bool {
    let digits: Vec<u32> = s
        .chars()
        .filter(|c| c.is_ascii_digit())
        .filter_map(|c| c.to_digit(10))
        .collect();
    if digits.len() < 13 || digits.len() > 19 {
        return false;
    }
    let mut sum = 0u32;
    let mut double = false;
    for &d in digits.iter().rev() {
        let mut val = d;
        if double {
            val *= 2;
            if val > 9 {
                val -= 9;
            }
        }
        sum += val;
        double = !double;
    }
    sum % 10 == 0
}

struct CompiledRule {
    name: &'static str,
    regex: Regex,
    validator: Option<fn(&str) -> bool>,
}

fn compiled_rules() -> &'static Vec<CompiledRule> {
    static COMPILED: OnceLock<Vec<CompiledRule>> = OnceLock::new();
    COMPILED.get_or_init(|| {
        RULES
            .iter()
            .filter_map(|r| {
                Regex::new(r.pattern).ok().map(|regex| CompiledRule {
                    name: r.name,
                    regex,
                    validator: r.validator,
                })
            })
            .collect()
    })
}

/// Check text for sensitive content. Returns list of detected rule type names.
/// `disabled_rules` contains rule names to skip.
pub fn check_sensitive(text: &str, disabled_rules: &[String]) -> Vec<String> {
    let mut found = Vec::new();
    for rule in compiled_rules() {
        if disabled_rules.iter().any(|d| d == rule.name) {
            continue;
        }
        for m in rule.regex.find_iter(text) {
            let matched = m.as_str();
            let valid = rule.validator.map_or(true, |f| f(matched));
            if valid {
                found.push(rule.name.to_string());
                break; // one match per rule type is enough
            }
        }
    }
    found
}

/// Get all available rule names (for settings UI).
pub fn available_rules() -> Vec<&'static str> {
    RULES.iter().map(|r| r.name).collect()
}
