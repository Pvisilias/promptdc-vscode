# PromptDC VS Code Extension - Publishing Guide

## Official VS Code Extension Publishing

### 🎯 Overview

This guide covers the complete publishing process for the PromptDC extension to the VS Code Marketplace based on [official VS Code documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

Target platform:
- **VS Code** (via VS Code Marketplace)

---

## 📋 Pre-Publishing Checklist

### **1. Code Quality & Security**
- [ ] Extension compiles without errors (`npm run compile`)
- [ ] All functionality tested in VS Code
- [ ] No console.log statements in production code
- [ ] No hardcoded secrets or API keys
- [ ] Authentication flow working correctly
- [ ] Error handling implemented for all API calls
- [ ] TypeScript compilation passes without warnings

### **2. VS Code Marketplace Compliance**
- [ ] No user-provided SVG images (Security constraint)
- [ ] Icon in package.json is PNG/JPEG format
- [ ] All image URLs use HTTPS
- [ ] Extension follows VS Code UX guidelines

### **3. Package.json Validation**
- [ ] Version follows semver format (major.minor.patch)
- [ ] Publisher name matches registered publisher ID
- [ ] Display name is unique
- [ ] Extension name is unique
- [ ] Keywords limited to 30 maximum
- [ ] engines.vscode version specified correctly
- [ ] activationEvents properly defined
- [ ] contributes section complete and valid
- [ ] Extension icon exists and is valid (PNG/JPEG only)
- [ ] Repository, bugs, and homepage URLs provided

### **4. VS Code Testing**
- [ ] Test in VS Code stable version
- [ ] Test all keyboard shortcuts work
- [ ] Test authentication flow
- [ ] Test prompt enhancement functionality
- [ ] Test error scenarios and recovery
- [ ] Test with different VS Code themes

---

## 🚀 Publishing Process

### **Prerequisites: Azure DevOps Setup**

VS Code Marketplace uses **Azure DevOps** for publishing services.

#### **Create Azure DevOps Organization**
1. Go to [dev.azure.com](https://dev.azure.com)
2. Create new organization (e.g., `promptdc-org`)

#### **Generate Personal Access Token (PAT)**
1. From organization: `https://dev.azure.com/promptdc-org`
2. User Settings → **Personal Access Tokens**
3. Click **New Token**
4. Configure token:
   - **Name**: "VS Code Extension Publishing"
   - **Organization**: All accessible organizations
   - **Scopes**: Custom defined → Marketplace → Manage ✓
5. **Copy token securely**

### **Step 1: Create Marketplace Publisher**

```bash
# Install VS Code Extension Manager
npm install -g @vscode/vsce

# Verify installation
vsce --version
```

#### **Register Publisher**
1. Go to [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers/)
2. Sign in with Microsoft account
3. Click **Create publisher**
4. Configure publisher:
   - **ID**: `promptdc` (unique identifier)
   - **Name**: "PromptDC"
   - **Email**: Contact email
   - **Website**: Company website
5. Click **Create**

#### **Login with vsce**
```bash
# Login with publisher ID
vsce login promptdc
# Enter PAT token when prompted
```

### **Step 2: Prepare Extension**

```bash
# Navigate to extension directory
cd vscode-extension

# Clean build
rm -rf out/ node_modules/
npm install
npm run compile
```

#### **Create .vscodeignore**
```bash
cat > .vscodeignore << EOF
**/*.ts
**/tsconfig.json
**/.gitignore
**/node_modules/**
src/**
.vscode/**
*.md
!README.md
EOF
```

### **Step 3: Package & Validate**

```bash
# Create VSIX package
vsce package

# List package contents
vsce ls

# Validate without packaging
vsce package --dry-run
```

### **Step 4: Test Locally**

```bash
# Install extension locally
code --install-extension promptdc-vscode-1.0.0.vsix

# Test all functionality in VS Code
```

### **Step 5: Publish**

```bash
# Publish to VS Code Marketplace
vsce publish

# Or publish specific version
vsce publish 1.0.1
```

---

## 📊 Post-Publishing

### **Monitor Extension**
- Check [VS Code Marketplace](https://marketplace.visualstudio.com/) for listing
- Monitor downloads and ratings
- Respond to user feedback

### **Updates**
```bash
# Update version and publish
vsce publish patch  # 1.0.0 → 1.0.1
vsce publish minor  # 1.0.0 → 1.1.0  
vsce publish major  # 1.0.0 → 2.0.0
```

---

## 🔧 Troubleshooting

### **Common Issues**
- **Authentication failed**: Verify PAT token has Marketplace permissions
- **Package validation errors**: Check package.json format
- **Publisher not found**: Ensure publisher is created and verified

### **Resources**
- 📖 [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- 🎨 [VS Code UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)
- 🏪 [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers/)

---

**The extension will be available in the VS Code Marketplace once published!** 🎉 