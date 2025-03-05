# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within Hermes Desktop Translator, please send an email to [your-email@example.com](mailto:your-email@example.com). All security vulnerabilities will be promptly addressed.

Please include the following information in your report:

- Type of vulnerability
- Description of the vulnerability
- Steps to reproduce the issue
- Affected versions
- Potential impact

## Security Measures

Hermes Desktop Translator takes several measures to ensure security:

1. **API Key Storage**: API keys are stored securely using the OS's secure credential storage (via keytar)
2. **Context Isolation**: The application uses Electron's context isolation to prevent direct access to Node.js from the renderer process
3. **Regular Updates**: We keep dependencies updated to patch known vulnerabilities

## Best Practices for Users

To keep your installation secure:

1. Always update to the latest version
2. Keep your DeepL API key confidential
3. Only download the application from the official GitHub repository
4. Report any suspicious behavior or potential vulnerabilities 