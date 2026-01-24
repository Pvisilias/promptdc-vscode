# PromptDC — AI Prompt Enhancer for VS Code

**Fix your prompts in one keyboard click.**

PromptDC enhances your coding prompts without leaving VS Code. Write your prompt, press the shortcut, and get a clearer, more structured version instantly.

**[Watch Tutorial](https://youtu.be/MN45fGjTdpc)**

---

## How It Works

1. **Write** your prompt in the chat
2. **Press** the keyboard shortcut `Cmd+Ctrl+E` (Mac) or `Ctrl+Alt+E` (Windows/Linux)
3. **Done** — your prompt is enhanced and replaced automatically

---

## Supported Models

| Model | Status |
|-------|--------|
| **GitHub Copilot** | Default |
| **Cline** | Supported |
| **Codex (OpenAI)** | Supported |
| **Gemini Code Assist** | Supported |
| **Claude Code** | Supported |
| **Kilo Code** | Supported |

---

## Enhancement Modes

### Simple Mode

Quick, focused enhancements in a single paragraph. Best for small tasks and quick fixes.

```
Build a responsive portfolio website for a web designer. Include home,
portfolio gallery with project thumbnails, about page with bio and skills,
and contact page with a form. Use React with TypeScript, implement mobile-first
design, and ensure all images are lazy-loaded for performance.
```

### Structured Mode

Organized output with ROLE, OBJECTIVE, SCOPE, PLAN sections. Best for complex, multi-step tasks.

```
ROLE: Senior Frontend Engineer

OBJECTIVE: Build a portfolio website for a web designer

SUCCESS CRITERIA:
- Responsive design across all devices
- Portfolio gallery with filtering
- Contact form with validation

SCOPE:
- In scope: Frontend implementation, responsive design
- Out of scope: Backend, database, authentication

PLAN:
1. Detect & orient: Identify stack and project structure
2. Design approach: Component hierarchy and routing
3. Implement: Build pages and components
...
```

---

## Installation

[Install PromptDC for VS Code](https://marketplace.visualstudio.com/items?itemName=promptdc.promptdc-vscode)

Or manually:
1. Open VS Code
2. Go to Extensions (`Cmd+Shift+X` or `Ctrl+Shift+X`)
3. Search for "PromptDC"
4. Click Install

---

## Sidebar Panel

PromptDC adds a sidebar with three tabs: **Settings**, **Library**, and **Community**.

### Settings

Configure how your prompts are enhanced:

- **Model** — Select your AI platform (Copilot, Cline, Codex, Gemini, Claude Code, Kilo Code)
- **Enhancement Mode** — Simple or Structured
- **Language** — English, Chinese, Spanish, Portuguese, Korean, Hindi, Russian, Vietnamese, Czech
- **Format** — Regular, JSON, XML, YAML

### Custom Prompt

Override the default enhancement with your own system prompt. Save reusable prompts to your Library.

### Always Include

Add text to the end of every enhanced prompt. Perfect for project rules or coding standards.

Examples:
- "Always check .mdc rule files in the repo"
- "Use TypeScript with strict mode"
- "Follow CONVENTIONS.md for naming"

### Personal Library

Save and organize your own prompts, markdown files, and system prompts. Filter by type and category.

### Community Library

Browse and copy prompts shared by other developers. Filter by type, category, and model.

---

## Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Enhance Prompt | `Cmd+Ctrl+E` | `Ctrl+Alt+E` |
| Enhance (Simple) | Customizable | Customizable |
| Enhance (Structured) | Customizable | Customizable |

To change shortcuts: Open Command Palette > "Preferences: Open Keyboard Shortcuts" > Search "PromptDC"

---

## FAQ

**Q: What is PromptDC?**
A: PromptDC is a coding-first prompt enhancer that improves AI code generation by transforming vague prompts into precise, implementation-ready instructions.

**Q: Does PromptDC work with VS Code?**
A: Yes. PromptDC for VS Code integrates directly into the editor for seamless prompt enhancement.

**Q: Does PromptDC work with GitHub Copilot?**
A: Yes. PromptDC enhances prompts that you can use with Copilot Chat or any AI coding assistant.

**Q: What AI assistants does PromptDC support?**
A: PromptDC supports GitHub Copilot, Cline, Codex (OpenAI), Gemini Code Assist, Claude Code, and Kilo Code.

**Q: What's the difference between Simple and Structured mode?**
A: Simple mode returns a clear, detailed paragraph. Structured mode returns organized sections with ROLE, OBJECTIVE, SCOPE, and PLAN for complex tasks.

**Q: Can I use my own custom prompt template?**
A: Yes. PromptDC allows you to override the default enhancement with your own custom prompt template.

**Q: Is there a community library?**
A: Yes. Browse and copy prompts shared by other developers, filtered by type, category, and model.

---

## Other Platforms

- [PromptDC for Cursor](https://open-vsx.org/extension/promptdc/promptdc-vscode) — Cursor extension
- [PromptDC Website](https://chromewebstore.google.com/detail/ai-prompt-enhancer-for-ev/dandneiidpgdhdadiogkcikebchholpp) — Chrome extension

---

## Privacy & Terms

By using PromptDC, you agree to our [Privacy Policy](https://promptdc.com/privacy-policy) and [Terms of Service](https://promptdc.com/terms).

---

## Resources

- **[Watch Tutorial](https://youtu.be/MN45fGjTdpc)** — Video walkthrough
- **[Sign Up](https://promptdc.com/login)** — Create account
- **[Pricing](https://promptdc.com/pricing)** — Plans and lifetime option
- **[Feedback](https://promptdc.featurebase.app/)** — Share your thoughts
- **Email:** spromptdc@gmail.com

---

**PromptDC — the coding-first prompt enhancer for AI-assisted software development.**
