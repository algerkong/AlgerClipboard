use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProgrammingLanguage {
    Rust,
    JavaScript,
    TypeScript,
    Python,
    Java,
    CSharp,
    Cpp,
    Go,
    Swift,
    Kotlin,
    Ruby,
    Php,
    Html,
    Css,
    Sql,
    Shell,
    Yaml,
    Toml,
    Dockerfile,
    Unknown,
}

impl ProgrammingLanguage {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Rust => "rust",
            Self::JavaScript => "javascript",
            Self::TypeScript => "typescript",
            Self::Python => "python",
            Self::Java => "java",
            Self::CSharp => "csharp",
            Self::Cpp => "cpp",
            Self::Go => "go",
            Self::Swift => "swift",
            Self::Kotlin => "kotlin",
            Self::Ruby => "ruby",
            Self::Php => "php",
            Self::Html => "html",
            Self::Css => "css",
            Self::Sql => "sql",
            Self::Shell => "shell",
            Self::Yaml => "yaml",
            Self::Toml => "toml",
            Self::Dockerfile => "dockerfile",
            Self::Unknown => "unknown",
        }
    }
}

pub fn detect_language(code: &str) -> ProgrammingLanguage {
    let trimmed = code.trim();
    if trimmed.is_empty() {
        return ProgrammingLanguage::Unknown;
    }

    // Score each language based on pattern matches
    let mut scores: Vec<(ProgrammingLanguage, i32)> = vec![];

    // Rust signals
    let mut rust_score = 0i32;
    if trimmed.contains("fn ") {
        rust_score += 3;
    }
    if trimmed.contains("let mut ") {
        rust_score += 4;
    }
    if trimmed.contains("pub fn ") || trimmed.contains("pub struct ") {
        rust_score += 5;
    }
    if trimmed.contains("impl ") {
        rust_score += 4;
    }
    if trimmed.contains("use std::") || trimmed.contains("use crate::") {
        rust_score += 5;
    }
    if trimmed.contains("println!(") || trimmed.contains("eprintln!(") {
        rust_score += 4;
    }
    if trimmed.contains("#[derive(") {
        rust_score += 5;
    }
    if trimmed.contains("-> Result<") || trimmed.contains("Option<") {
        rust_score += 3;
    }
    if trimmed.contains("match ") && trimmed.contains(" => ") {
        rust_score += 3;
    }
    scores.push((ProgrammingLanguage::Rust, rust_score));

    // TypeScript signals (check before JS since TS is a superset)
    let mut ts_score = 0i32;
    if trimmed.contains(": string") || trimmed.contains(": number") || trimmed.contains(": boolean")
    {
        ts_score += 4;
    }
    if trimmed.contains("interface ") && trimmed.contains("{") {
        ts_score += 3;
    }
    if trimmed.contains("<T>") || trimmed.contains("<T,") {
        ts_score += 2;
    }
    if trimmed.contains("as const") {
        ts_score += 4;
    }
    if trimmed.contains("type ") && trimmed.contains(" = ") {
        ts_score += 3;
    }
    if trimmed.contains("import ") && trimmed.contains(" from ") {
        ts_score += 2;
    }
    if trimmed.contains("export ") {
        ts_score += 1;
    }
    scores.push((ProgrammingLanguage::TypeScript, ts_score));

    // JavaScript signals
    let mut js_score = 0i32;
    if trimmed.contains("function ") {
        js_score += 2;
    }
    if trimmed.contains("const ") || trimmed.contains("let ") || trimmed.contains("var ") {
        js_score += 1;
    }
    if trimmed.contains("console.log(") {
        js_score += 3;
    }
    if trimmed.contains("require(") {
        js_score += 3;
    }
    if trimmed.contains("=> {") || trimmed.contains("=> (") {
        js_score += 2;
    }
    if trimmed.contains("document.") || trimmed.contains("window.") {
        js_score += 3;
    }
    if trimmed.contains("async ") || trimmed.contains("await ") {
        js_score += 1;
    }
    scores.push((ProgrammingLanguage::JavaScript, js_score));

    // Python signals
    let mut py_score = 0i32;
    if trimmed.contains("def ") && trimmed.contains("):") {
        py_score += 4;
    }
    if trimmed.contains("import ") && !trimmed.contains(" from \"") {
        py_score += 1;
    }
    if trimmed.contains("from ") && trimmed.contains(" import ") {
        py_score += 3;
    }
    if trimmed.contains("print(") {
        py_score += 2;
    }
    if trimmed.contains("self.") || trimmed.contains("self,") {
        py_score += 3;
    }
    if trimmed.contains("if __name__") {
        py_score += 5;
    }
    if trimmed.contains("elif ") {
        py_score += 4;
    }
    if trimmed.contains("class ") && trimmed.contains("):") {
        py_score += 3;
    }
    scores.push((ProgrammingLanguage::Python, py_score));

    // Java signals
    let mut java_score = 0i32;
    if trimmed.contains("public class ") || trimmed.contains("private class ") {
        java_score += 5;
    }
    if trimmed.contains("public static void main") {
        java_score += 6;
    }
    if trimmed.contains("System.out.println") {
        java_score += 5;
    }
    if trimmed.contains("import java.") {
        java_score += 5;
    }
    if trimmed.contains("@Override") {
        java_score += 4;
    }
    scores.push((ProgrammingLanguage::Java, java_score));

    // C# signals
    let mut cs_score = 0i32;
    if trimmed.contains("using System") {
        cs_score += 5;
    }
    if trimmed.contains("namespace ") {
        cs_score += 3;
    }
    if trimmed.contains("Console.Write") {
        cs_score += 5;
    }
    if trimmed.contains("public class ") && trimmed.contains("void ") {
        cs_score += 2;
    }
    if trimmed.contains("var ") && trimmed.contains(";") {
        cs_score += 1;
    }
    scores.push((ProgrammingLanguage::CSharp, cs_score));

    // C++ signals
    let mut cpp_score = 0i32;
    if trimmed.contains("#include ") {
        cpp_score += 5;
    }
    if trimmed.contains("std::") {
        cpp_score += 4;
    }
    if trimmed.contains("cout ") || trimmed.contains("cin ") {
        cpp_score += 4;
    }
    if trimmed.contains("int main(") {
        cpp_score += 4;
    }
    if trimmed.contains("nullptr") {
        cpp_score += 4;
    }
    scores.push((ProgrammingLanguage::Cpp, cpp_score));

    // Go signals
    let mut go_score = 0i32;
    if trimmed.contains("func ") && trimmed.contains("{") {
        go_score += 3;
    }
    if trimmed.contains("package ") {
        go_score += 4;
    }
    if trimmed.contains("fmt.Print") || trimmed.contains("fmt.Sprint") {
        go_score += 5;
    }
    if trimmed.contains(":= ") {
        go_score += 3;
    }
    if trimmed.contains("go func(") || trimmed.contains("goroutine") {
        go_score += 4;
    }
    scores.push((ProgrammingLanguage::Go, go_score));

    // Swift
    let mut swift_score = 0i32;
    if trimmed.contains("func ") && trimmed.contains("-> ") {
        swift_score += 4;
    }
    if trimmed.contains("guard let ") || trimmed.contains("if let ") {
        swift_score += 4;
    }
    if trimmed.contains("import UIKit") || trimmed.contains("import Foundation") {
        swift_score += 6;
    }
    scores.push((ProgrammingLanguage::Swift, swift_score));

    // Kotlin
    let mut kotlin_score = 0i32;
    if trimmed.contains("fun ") && trimmed.contains("{") {
        kotlin_score += 3;
    }
    if trimmed.contains("val ") || trimmed.contains("var ") {
        kotlin_score += 1;
    }
    if trimmed.contains("println(") {
        kotlin_score += 2;
    }
    if trimmed.contains("import kotlin.") || trimmed.contains("import android.") {
        kotlin_score += 5;
    }
    scores.push((ProgrammingLanguage::Kotlin, kotlin_score));

    // Ruby
    let mut ruby_score = 0i32;
    if trimmed.contains("def ") && trimmed.contains("end") {
        ruby_score += 4;
    }
    if trimmed.contains("puts ") {
        ruby_score += 3;
    }
    if trimmed.contains("require '") || trimmed.contains("require \"") {
        ruby_score += 4;
    }
    if trimmed.contains(".each do") || trimmed.contains("do |") {
        ruby_score += 4;
    }
    scores.push((ProgrammingLanguage::Ruby, ruby_score));

    // PHP
    let mut php_score = 0i32;
    if trimmed.contains("<?php") {
        php_score += 6;
    }
    if trimmed.contains("$") && trimmed.contains("->") {
        php_score += 3;
    }
    if trimmed.contains("echo ") {
        php_score += 2;
    }
    if trimmed.contains("function ") && trimmed.contains("$") {
        php_score += 3;
    }
    scores.push((ProgrammingLanguage::Php, php_score));

    // HTML
    let mut html_score = 0i32;
    if trimmed.contains("<!DOCTYPE") || trimmed.contains("<html") {
        html_score += 6;
    }
    if trimmed.contains("<div") || trimmed.contains("<span") || trimmed.contains("<p>") {
        html_score += 3;
    }
    if trimmed.contains("</") && trimmed.contains(">") {
        html_score += 2;
    }
    scores.push((ProgrammingLanguage::Html, html_score));

    // CSS
    let mut css_score = 0i32;
    if trimmed.contains("{")
        && (trimmed.contains("color:")
            || trimmed.contains("font-")
            || trimmed.contains("margin:")
            || trimmed.contains("padding:")
            || trimmed.contains("display:"))
    {
        css_score += 4;
    }
    if trimmed.contains("@media ") || trimmed.contains("@import ") {
        css_score += 4;
    }
    if trimmed.contains(".")
        && trimmed.contains("{")
        && trimmed.contains("}")
        && trimmed.contains(":")
    {
        css_score += 2;
    }
    scores.push((ProgrammingLanguage::Css, css_score));

    // SQL
    let mut sql_score = 0i32;
    let upper = trimmed.to_uppercase();
    if upper.starts_with("SELECT ")
        || upper.starts_with("INSERT ")
        || upper.starts_with("UPDATE ")
        || upper.starts_with("DELETE ")
    {
        sql_score += 5;
    }
    if upper.contains("FROM ") && upper.contains("WHERE ") {
        sql_score += 3;
    }
    if upper.contains("CREATE TABLE") || upper.contains("ALTER TABLE") {
        sql_score += 5;
    }
    scores.push((ProgrammingLanguage::Sql, sql_score));

    // Shell
    let mut sh_score = 0i32;
    if trimmed.starts_with("#!/bin/") || trimmed.starts_with("#!/usr/bin/env") {
        sh_score += 6;
    }
    if trimmed.contains("echo ") && !trimmed.contains("<?php") {
        sh_score += 2;
    }
    if trimmed.contains("if [ ") || trimmed.contains("then") && trimmed.contains("fi") {
        sh_score += 4;
    }
    if trimmed.contains("export ") {
        sh_score += 2;
    }
    scores.push((ProgrammingLanguage::Shell, sh_score));

    // YAML
    let mut yaml_score = 0i32;
    let colon_lines = trimmed
        .lines()
        .filter(|l| l.contains(": ") && !l.trim().starts_with('#'))
        .count();
    if colon_lines >= 2 && !trimmed.contains(";") {
        yaml_score += 3;
    }
    if trimmed.contains("---") && trimmed.lines().next().map_or(false, |l| l.trim() == "---") {
        yaml_score += 3;
    }
    scores.push((ProgrammingLanguage::Yaml, yaml_score));

    // TOML
    let mut toml_score = 0i32;
    if trimmed.contains("[") && trimmed.contains("]") && trimmed.contains(" = ") {
        toml_score += 3;
    }
    if trimmed.contains("[package]") || trimmed.contains("[dependencies]") {
        toml_score += 6;
    }
    scores.push((ProgrammingLanguage::Toml, toml_score));

    // Dockerfile
    let mut docker_score = 0i32;
    if trimmed.starts_with("FROM ") {
        docker_score += 5;
    }
    if trimmed.contains("RUN ")
        || trimmed.contains("CMD ")
        || trimmed.contains("COPY ")
        || trimmed.contains("WORKDIR ")
    {
        docker_score += 3;
    }
    scores.push((ProgrammingLanguage::Dockerfile, docker_score));

    // Find the highest scoring language with minimum threshold of 3
    scores.sort_by(|a, b| b.1.cmp(&a.1));
    if let Some((lang, score)) = scores.first() {
        if *score >= 3 {
            return lang.clone();
        }
    }

    ProgrammingLanguage::Unknown
}
