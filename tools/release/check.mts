// Runs the two semantic-release steps that publish nothing (commit analysis and release notes) with the plugin
// options of .releaserc, from the repository root as release.yml does. The Release workflow runs only after a merge
// to main, so without this check a broken release tooling shows up only on the first real release.
// Usage, from the repository root: npx tsx tools/release/check.mts
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

type PluginOptions = Record<string, unknown>;
type Commit = { hash: string; message: string };
type Context = { cwd: string; commits: Commit[]; logger: Record<string, (...args: unknown[]) => void> };
type Analyzer = { analyzeCommits: (options: PluginOptions, context: Context) => Promise<string | null> };
type NotesContext = Context & {
    options: { repositoryUrl: string };
    lastRelease: { gitTag: string; version: string };
    nextRelease: { gitTag: string; version: string };
};
type Generator = { generateNotes: (options: PluginOptions, context: NotesContext) => Promise<string> };

const cwd = process.cwd();
const require = createRequire(new URL("./package.json", import.meta.url));
const releaserc = JSON.parse(readFileSync(".releaserc", "utf8")) as { plugins: (string | [string, PluginOptions])[] };
const logger = { log(): void {}, success(): void {}, warn: console.warn, error: console.error };

function optionsOf(name: string): PluginOptions {
    for (const plugin of releaserc.plugins) {
        if (Array.isArray(plugin) && plugin[0] === name) {
            return plugin[1];
        }
    }
    return {};
}

const analyzerName = "@semantic-release/commit-analyzer";
const generatorName = "@semantic-release/release-notes-generator";
const { analyzeCommits } = (await import(require.resolve(analyzerName))) as Analyzer;
const { generateNotes } = (await import(require.resolve(generatorName))) as Generator;

const expected: Record<string, string | null> = {
    "feat: check feature": "minor",
    "fix(deps): check fix": "patch",
    "chore(deps): check chore": null,
};
for (const [message, type] of Object.entries(expected)) {
    const commits = [{ hash: "0000000000", message }];
    const actual = await analyzeCommits(optionsOf(analyzerName), { cwd, commits, logger });
    if (actual !== type) {
        throw new Error(`"${message}" gives release type ${actual}, expected ${type}`);
    }
}

// The entries matter, not only the heading: a preset the writer cannot render can still print the heading alone.
const notes = await generateNotes(optionsOf(generatorName), {
    cwd,
    logger,
    options: { repositoryUrl: "https://github.com/termun/core-ts.git" },
    lastRelease: { gitTag: "v0.0.0", version: "0.0.0" },
    nextRelease: { gitTag: "v0.0.1", version: "0.0.1" },
    commits: [
        { hash: "1111111111", message: "feat: check feature" },
        { hash: "2222222222", message: "fix(deps): check fix" },
    ],
});
if (!notes.includes("0.0.1") || !notes.includes("check feature") || !notes.includes("check fix")) {
    throw new Error(`the release notes lack their entries:\n${notes}`);
}
console.log("Release tooling OK: commit analysis and release notes render with .releaserc.");
