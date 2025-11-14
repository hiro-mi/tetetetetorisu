# GitHub Copilot Instructions for dtwr-sast

## Project Overview

This repository contains a comprehensive SAST (Static Application Security Testing) pipeline for Perl projects. The pipeline integrates multiple security scanning tools to provide multi-layered vulnerability detection and reporting.

### Purpose

The dtwr-sast pipeline automates security diagnostics for Perl codebases by:
- Detecting code vulnerabilities (SAST)
- Scanning for hardcoded secrets
- Auditing dependencies for known vulnerabilities (SCA)
- Generating unified, prioritized HTML/JSON/CSV reports

### Key Tools Integrated

1. **Zarn** - High-precision Perl vulnerability scanner focusing on injection attacks (e.g., command injection via `open3`)
2. **Semgrep** - Pattern-based scanner for SQL injection, command injection, deserialization flaws, weak cryptography, etc.
3. **Gitleaks** - Secrets scanner for detecting hardcoded API keys, passwords, and tokens
4. **CPAN::Audit** - Dependency vulnerability checker for Perl modules listed in `cpanfile`
5. **Perl::Critic** (planned) - Code quality and style checker

### Future Roadmap

- Integration of **SBOM generation** (CycloneDX format) for dependency transparency
- **SLOC metrics** (via tokei) to quantify scan scope
- **Perl::Critic** integration for code quality analysis
- Multi-layer report structure: SBOM → SCA → SAST → Secrets

## Repository Structure

```
dtwr-sast/
├── .github/               # GitHub configuration and Copilot instructions
├── tools/                 # Pipeline scripts and utilities
│   ├── run_sast.sh       # Main pipeline orchestrator
│   ├── sarif_report_wrapper.py  # SARIF aggregation and deduplication
│   ├── sast_report.py    # HTML/JSON/CSV report generator
│   ├── cpan_audit_to_sarif.py   # CPAN::Audit → SARIF converter
│   └── sonar_to_sarif.py # SonarQube → SARIF converter (if needed)
├── settings/             # Scanner rule configurations
│   ├── zarn_rules.yml    # Zarn detection rules
│   └── semgrep_rules.yml # Semgrep detection patterns
├── perl_vuln_lab/        # Demo/test project with intentional vulnerabilities
└── out/                  # Output directory (generated during scans)
    └── report_TIMESTAMP/ # Time-stamped scan results
```

## How to Contribute

### Prerequisites

- **Operating System**: Ubuntu 20.04/22.04 (or compatible Linux)
- **Required Tools**:
  - Git, Perl 5.x, Python 3.x
  - Docker (for Semgrep and Gitleaks)
  - `cpanm` (CPAN module installer)
  - System packages: `build-essential`, `curl`, `jq`, `dos2unix`

### Initial Setup

1. **Install system dependencies**:
   ```bash
   sudo apt update
   sudo apt install -y git build-essential perl curl unzip jq python3 python3-venv docker.io dos2unix
   curl -L https://cpanmin.us | sudo perl - App::cpanminus
   ```

2. **Configure Docker** (for Semgrep and Gitleaks):
   ```bash
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER
   newgrp docker
   ```

3. **Install Zarn** (from within the repository):
   ```bash
   git clone https://github.com/htrgouvea/zarn
   cd zarn
   sudo cpanm --installdeps .
   ```

4. **Install CPAN::Audit**:
   ```bash
   sudo cpanm CPAN::Audit
   ```

5. **Normalize line endings** (important for cross-platform compatibility):
   ```bash
   dos2unix ./settings/*.yml
   dos2unix ./tools/*.py
   ```

6. **Make scripts executable**:
   ```bash
   chmod +x ./tools/run_sast.sh
   ```

### Running the Pipeline

Execute the full scan on a target Perl project:

```bash
./tools/run_sast.sh /path/to/perl-project
```

For testing with the demo project:

```bash
./tools/run_sast.sh ./perl_vuln_lab
```

**Output**: Results are generated in `./out/report_YYYYMMDD-HHMMSS/` as:
- `audit_report.html` (interactive report)
- `audit_report.json` (machine-readable)
- `audit_report.csv` (spreadsheet format)

### Building and Testing

**No traditional build step** is required for this pipeline. Validation involves:

1. **Linting Python scripts**:
   ```bash
   python3 -m py_compile tools/*.py
   ```

2. **Testing the pipeline**:
   ```bash
   # Run against the demo project
   ./tools/run_sast.sh ./perl_vuln_lab
   
   # Verify outputs exist
   ls -l out/report_*/audit_report.*
   ```

3. **Validating SARIF files** (optional):
   ```bash
   # Check SARIF syntax
   jq empty out/report_*/intermediate_files/*.sarif
   ```

### Code Style and Principles

#### Shell Scripts (`tools/*.sh`)

- Use **Bash** (shebang: `#!/bin/bash`)
- Enable strict mode: `set -e` (exit on error)
- Use descriptive variable names in UPPER_CASE for globals
- Include comments in Japanese where appropriate for consistency with existing code
- Use `check_file()` function pattern for validation

#### Python Scripts (`tools/*.py`)

- **Python 3.x** compatible
- Use UTF-8 encoding: `# -*- coding: utf-8 -*-` or `encoding="utf-8"` in file operations
- Follow PEP 8 style guidelines where practical
- Keep scripts modular: separate parsing, transformation, and output logic
- Use JSON for structured data exchange
- Include version numbers in script headers (e.g., `# v4.5`)

#### YAML Configuration (`settings/*.yml`)

- Use consistent indentation (2 spaces)
- Include descriptive comments for rule purpose
- Follow existing pattern structure (see `zarn_rules.yml` and `semgrep_rules.yml`)

### SARIF Format Requirements

All scanners must output results in **SARIF 2.1.0** format. Key requirements:

- Use consistent `tool.driver.name` across invocations
- Map severity levels: `error` → HIGH, `warning` → MEDIUM, `note`/`none` → INFO
- Include `result.locations[0].physicalLocation` with:
  - `artifactLocation.uri` (file path)
  - `region.startLine` (line number)
- Provide meaningful `message.text` for each finding

### Deduplication Strategy

The `sarif_report_wrapper.py` deduplicates findings based on:
- Tool name (`tool`)
- Rule ID (`ruleId`)
- File path (`file`)
- Line number (`line`)
- Message text (`message`)

When adding new tools, ensure they follow this keying convention to enable proper deduplication.

### Documentation Requirements

When making changes:

1. **Update `README.md`** if:
   - Adding new tools or dependencies
   - Changing setup/installation steps
   - Modifying pipeline execution flow

2. **Update `AGENTS.md`** if:
   - Adding architectural guidelines
   - Defining new conventions for tool integration
   - Establishing report structure requirements

3. **Update version numbers** in script headers when making functional changes

4. **Add inline comments** for complex logic, especially:
   - Character encoding handling
   - Path normalization (container vs. host paths)
   - Severity remapping logic

## Working with Existing Code

### Critical Implementation Details

1. **Character Encoding**: The pipeline enforces UTF-8 throughout using:
   - `LANG=C.UTF-8 LC_ALL=C.UTF-8`
   - Perl `-CSDA` flag for Unicode handling
   - Python `encoding="utf-8"` in file operations

2. **Path Normalization**: Container-based tools (Semgrep, Gitleaks) use different path prefixes:
   - Semgrep: `/src/` → strip to relative path
   - Gitleaks: `/repo/` → strip to relative path
   - Implement in `rel()` function in `sarif_report_wrapper.py`

3. **Severity Mapping**: Centralized in `sarif_report_wrapper.py`:
   ```python
   severity_map = {
       "zarn.code_injection.open3": "CRITICAL",
       "semgrep.command_injection": "HIGH",
       # ... etc.
   }
   ```
   Update this map when adding new rules or tools.

4. **Temporary Files**: All intermediate files go to:
   ```
   out/report_TIMESTAMP/intermediate_files/
   ```
   Don't store them in the project root or `/tmp`.

### Testing Your Changes

1. **Always test against `perl_vuln_lab`** before claiming completion
2. **Verify report generation** succeeds without errors
3. **Check report content** manually in browser for:
   - Correct vulnerability counts
   - Proper severity display
   - No missing or broken sections
   - Interactive filtering works

### Common Pitfalls

- **Docker permissions**: Ensure user is in `docker` group before running scans
- **Line endings**: Always run `dos2unix` on YAML/Python files if edited on Windows
- **Missing Zarn**: Clone and install dependencies in `zarn/` directory
- **Empty SARIF files**: Check that tools executed successfully and didn't fail silently

## Security Considerations

- **Never commit secrets** to this repository
- **Validate input paths** to prevent directory traversal
- **Review vulnerability detection rules** before adding them to ensure low false positives
- **Keep Docker images updated** for Semgrep and Gitleaks
- **Audit dependencies** regularly using `CPAN::Audit` and `pip` security checkers

## Issue and Pull Request Guidelines

When creating or working on issues:

1. **Be specific**: Clearly state what feature/fix is needed
2. **Provide context**: Reference documentation, error messages, or examples
3. **Define acceptance criteria**: What does "done" look like?
4. **Tag appropriately**: Use labels like `enhancement`, `bug`, `documentation`

When submitting pull requests:

1. **Reference the issue**: Use "Fixes #N" or "Closes #N"
2. **Test your changes**: Include test results in PR description
3. **Update documentation**: If you change behavior, update relevant docs
4. **Keep PRs focused**: One logical change per PR
5. **Follow existing patterns**: Match the style and structure of surrounding code

## Getting Help

- **Documentation**: Start with `README.md` for setup and usage
- **Architecture**: See `AGENTS.md` for development guidelines and roadmap
- **Tool-specific issues**:
  - Zarn: https://github.com/htrgouvea/zarn
  - Semgrep: https://semgrep.dev/docs/
  - Gitleaks: https://github.com/gitleaks/gitleaks

---

*This instruction file helps GitHub Copilot understand the project structure, conventions, and best practices for contributing to dtwr-sast.*
## 共通設定
- 日本語で回答してください
- 簡潔で分かりやすい説明を心がけてください
- ベストプラクティスの具体例を提示してください
- 学習リソースの提案を積極的に行ってください
- スケーラビリティとパフォーマンスを重点的にチェックしてください

## コードレビュー専用指示
### レビューの基本方針
以下のプレフィックスを使用してレビューコメントを分類してください：
- `[must]` - 必須修正項目（セキュリティ、バグ、重大な設計問題）
- `[recommend]` - 推奨修正項目（パフォーマンス、可読性の大幅改善）
- `[nits]` - 軽微な指摘（コードスタイル、タイポ等）

### 重点チェック項目
1. **セキュリティ**: SQLインジェクション、XSS、認証・認可の不備
2. **パフォーマンス**: N+1問題、不要なループ、メモリリーク
3. **可読性**: 変数名、関数名、コメントの適切性
4. **保守性**: DRY原則、SOLID原則の遵守
5. **テスト**: テストケースの網羅性、エッジケースの考慮
6. **言語固有のベストプラクティス**: 各言語の推奨パターンに準拠しているか、非推奨・廃止予定のAPIや構文を使用していないかチェック
