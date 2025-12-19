import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { Feature } from '../db/types';

/**
 * Manages project context files for AI assistants:
 * - .shepherd/COPILOT.md - Auto-generated context
 * - docs/requirements/design.md - Global design guide
 * - CLAUDE.md - User's file with reference to COPILOT.md
 */
export class ProjectContext {
    private readonly workspaceRoot: string;
    private readonly shepherdDir: string;
    private readonly requirementsDir: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.shepherdDir = path.join(workspaceRoot, '.shepherd');
        this.requirementsDir = path.join(workspaceRoot, 'docs', 'requirements');
    }

    /**
     * Initialize all project context files
     * Called on extension activation
     */
    async initialize(): Promise<void> {
        // Ensure directories exist
        await fs.promises.mkdir(this.shepherdDir, { recursive: true });
        await fs.promises.mkdir(this.requirementsDir, { recursive: true });

        // Create files if missing
        await this.ensureCopilotMd();
        await this.ensureDesignMd();
        await this.ensureClaudeMd();
    }

    /**
     * Create .shepherd/COPILOT.md if missing
     */
    private async ensureCopilotMd(): Promise<void> {
        const copilotPath = path.join(this.shepherdDir, 'COPILOT.md');

        if (!fs.existsSync(copilotPath)) {
            await fs.promises.writeFile(copilotPath, this.getCopilotTemplate(), 'utf-8');
        }
    }

    /**
     * Create docs/requirements/design.md if missing
     */
    private async ensureDesignMd(): Promise<void> {
        const designPath = path.join(this.requirementsDir, 'design.md');

        if (!fs.existsSync(designPath)) {
            await fs.promises.writeFile(designPath, this.getDesignTemplate(), 'utf-8');
        }
    }

    /**
     * Create CLAUDE.md if missing, or prompt to add reference if exists
     */
    private async ensureClaudeMd(): Promise<void> {
        const claudePath = path.join(this.workspaceRoot, 'CLAUDE.md');

        if (!fs.existsSync(claudePath)) {
            // Create new CLAUDE.md with reference
            await fs.promises.writeFile(claudePath, this.getClaudeTemplate(), 'utf-8');
            vscode.window.showInformationMessage('Created CLAUDE.md with Product Cockpit context reference.');
        } else {
            // Check if reference exists
            const content = await fs.promises.readFile(claudePath, 'utf-8');
            if (!content.includes('COPILOT.md') && !content.includes('.shepherd')) {
                // Prompt user to add reference
                const choice = await vscode.window.showInformationMessage(
                    'Add Product Cockpit context reference to CLAUDE.md? This helps Claude find your requirements and design guide.',
                    'Add Reference',
                    'Skip'
                );

                if (choice === 'Add Reference') {
                    await this.injectClaudeReference(claudePath, content);
                }
            }
        }
    }

    /**
     * Inject reference into existing CLAUDE.md
     */
    private async injectClaudeReference(claudePath: string, existingContent: string): Promise<void> {
        const reference = `
## Product Cockpit Context
See [.shepherd/COPILOT.md](.shepherd/COPILOT.md) for requirements, design guide, and feature documentation managed by Shepherd.
`;
        // Add after first heading or at the start
        let newContent: string;
        const firstHeadingMatch = existingContent.match(/^#[^#].+$/m);

        if (firstHeadingMatch && firstHeadingMatch.index !== undefined) {
            const insertPos = firstHeadingMatch.index + firstHeadingMatch[0].length;
            newContent = existingContent.slice(0, insertPos) + '\n' + reference + existingContent.slice(insertPos);
        } else {
            newContent = reference + '\n' + existingContent;
        }

        await fs.promises.writeFile(claudePath, newContent, 'utf-8');
        vscode.window.showInformationMessage('Added Product Cockpit reference to CLAUDE.md.');
    }

    /**
     * Update COPILOT.md with current requirements index
     * Called when requirements change
     */
    async updateCopilotMd(features: Feature[]): Promise<void> {
        const copilotPath = path.join(this.shepherdDir, 'COPILOT.md');

        // Get all requirement files
        const requirementFiles = await this.getRequirementFiles();

        const content = this.generateCopilotContent(features, requirementFiles);
        await fs.promises.writeFile(copilotPath, content, 'utf-8');
    }

    /**
     * Get list of requirement files with their first line (title)
     */
    private async getRequirementFiles(): Promise<Array<{ name: string; title: string }>> {
        const files: Array<{ name: string; title: string }> = [];

        try {
            const entries = await fs.promises.readdir(this.requirementsDir);

            for (const entry of entries) {
                if (entry.endsWith('.md') && entry !== 'design.md') {
                    const filePath = path.join(this.requirementsDir, entry);
                    const content = await fs.promises.readFile(filePath, 'utf-8');
                    const firstLine = content.split('\n')[0] || '';
                    const title = firstLine.replace(/^#\s*/, '').trim() || entry;
                    files.push({ name: entry, title });
                }
            }
        } catch {
            // Directory might not exist yet
        }

        return files;
    }

    /**
     * Generate COPILOT.md content
     */
    private generateCopilotContent(features: Feature[], requirementFiles: Array<{ name: string; title: string }>): string {
        const timestamp = new Date().toISOString().split('T')[0];

        let requirementsIndex = '';
        if (requirementFiles.length > 0) {
            requirementsIndex = requirementFiles
                .map(f => `- [\`${f.name}\`](../docs/requirements/${f.name}) - ${f.title}`)
                .join('\n');
        } else {
            requirementsIndex = '_No requirements files yet._';
        }

        let featuresSection = '';
        if (features.length > 0) {
            featuresSection = features
                .map(f => `- **${f.title}**${f.requirement_path ? ` → [requirements](../${f.requirement_path})` : ''}`)
                .join('\n');
        } else {
            featuresSection = '_No features defined yet._';
        }

        return `# Product Cockpit Context
> Auto-generated on ${timestamp}. Edit design.md and requirements files directly.

## Design Guide
See [design.md](../docs/requirements/design.md) for global design patterns, colors, and UI conventions.

**Always check design.md before implementing UI changes.**

## Requirements Index
${requirementsIndex}

## Current Features
${featuresSection}

## How to Use This
1. **Before implementing:** Check design.md for global patterns
2. **For feature work:** Read the linked requirements file
3. **Design decisions:** If global, add to design.md. If feature-specific, add to that feature's requirements.
`;
    }

    /**
     * Get initial COPILOT.md template
     */
    private getCopilotTemplate(): string {
        return this.generateCopilotContent([], []);
    }

    /**
     * Get design.md template - starts empty so first edit shows real changes
     */
    private getDesignTemplate(): string {
        return '';
    }

    /**
     * Get CLAUDE.md template for new projects
     */
    private getClaudeTemplate(): string {
        return `# CLAUDE.md

## Product Cockpit Context
See [.shepherd/COPILOT.md](.shepherd/COPILOT.md) for requirements, design guide, and feature documentation managed by Shepherd.

## Development

<!-- Add your project-specific instructions here -->

## Build & Test

<!-- Add build/test commands here -->
`;
    }

    /**
     * Get the design.md file path
     */
    getDesignPath(): string {
        return path.join(this.requirementsDir, 'design.md');
    }

    /**
     * Open design.md in editor
     */
    async openDesignGuide(): Promise<void> {
        const designPath = this.getDesignPath();

        // Ensure it exists
        if (!fs.existsSync(designPath)) {
            await this.ensureDesignMd();
        }

        const doc = await vscode.workspace.openTextDocument(designPath);
        await vscode.window.showTextDocument(doc);
    }
}
