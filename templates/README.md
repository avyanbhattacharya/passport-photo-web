# Reusable project starters

## Local-first Web Starter

Start with [local-web-starter/README.md](local-web-starter/README.md). This is a standalone source project, not another deployed tool. It captures the Clean Local Tools stack, test budgets, Cloudflare Pages previews, privacy boundaries and hardware/browser lessons for future humans and AI agents.

Export to a new directory (including dotfiles and CI):

```sh
node templates/local-web-starter/scripts/export.cjs /absolute/path/new-project
```

Then initialize a new repository and follow the starter handbook. No credentials, Cloudflare project identity, source git history, dependencies or build output are carried over. A separate GitHub repository can later be designated a Template repository; this commit does not create one or change account settings.

The template has its own Starter verification workflow. Do not use the original product's green checks as a substitute.
