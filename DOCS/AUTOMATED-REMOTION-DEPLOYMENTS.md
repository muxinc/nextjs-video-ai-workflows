# Automated Remotion Deployments

This document explains how the GitHub Actions workflow automatically deploys Remotion to AWS Lambda when relevant changes are merged into `main`.

---

## Overview

The workflow lives at `.github/workflows/deploy-remotion.yml` and ensures that the Remotion Lambda function and site are kept in sync with the codebase—without triggering unnecessary deploys for unrelated changes.

---

## Trigger Conditions

The workflow triggers on **pushes to `main`** when any of these files change:

| Path                 | Description                          |
| -------------------- | ------------------------------------ |
| `remotion/**`        | Any file in the Remotion folder      |
| `remotion.config.ts` | Root Remotion configuration          |
| `package.json`       | May contain Remotion version updates |
| `package-lock.json`  | May contain Remotion version updates |

---

## Execution Flow

### 1. Checkout Repository

Clones the repository with full git history (`fetch-depth: 0`). This is required for comparing commits to determine what actually changed.

### 2. Determine If We Should Deploy

Compares the previous commit (`github.event.before`) to the current commit (`github.sha`) and sets `deploy=true` only if relevant changes are detected:

| Condition                                                                   | Triggers Deploy? |
| --------------------------------------------------------------------------- | ---------------- |
| Any file in `remotion/` changed                                             | ✅ Yes           |
| `remotion.config.ts` changed                                                | ✅ Yes           |
| `package.json` changed **and** a `@remotion/*` dependency was added/removed | ✅ Yes           |
| `package-lock.json` changed **and** includes `@remotion/` in the diff       | ✅ Yes           |
| `package.json` changed but no Remotion deps touched                         | ❌ No            |

This two-stage filter (paths trigger the workflow, then git diff decides) prevents unnecessary deploys when you only bump unrelated dependencies.

### 3. Stop If Nothing Relevant Changed

If `deploy=false`, the workflow logs a skip message and exits early. All subsequent steps are guarded by a conditional check.

### 4. Setup Node.js

Uses `.nvmrc` for the Node version and caches npm dependencies for faster subsequent runs.

### 5. Install Dependencies

Runs `npm ci` for a clean, reproducible install.

### 6. Deploy Remotion Site

Runs `npm run remotion:deploy` with AWS credentials from GitHub Secrets. This script:

1. **Deploys/updates the Lambda function** — creates or updates the Remotion render function with the configured RAM, disk, and timeout settings
2. **Ensures the S3 bucket exists** — creates the bucket if it doesn't exist
3. **Deploys the Remotion site bundle** — uploads the bundled Remotion code to S3 for Lambda to use during renders

---

## Required Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name                      | Description                                     |
| -------------------------------- | ----------------------------------------------- |
| `REMOTION_AWS_ACCESS_KEY_ID`     | AWS access key with Remotion Lambda permissions |
| `REMOTION_AWS_SECRET_ACCESS_KEY` | AWS secret key for the above access key         |

For setting up AWS credentials, see the [Remotion Lambda setup guide](https://www.remotion.dev/docs/lambda/setup).

---

## Configuration

The deployment uses settings from `remotion/config.mjs`:

| Setting     | Default                     | Description                             |
| ----------- | --------------------------- | --------------------------------------- |
| `REGION`    | `us-east-1`                 | AWS region for Lambda deployment        |
| `SITE_NAME` | `nextjs-video-ai-workflows` | Consistent name for site updates        |
| `RAM`       | `3009` MB                   | Lambda memory (higher = faster renders) |
| `DISK`      | `10240` MB                  | Ephemeral storage for video rendering   |
| `TIMEOUT`   | `240` seconds               | Max render time before Lambda times out |

---

## Manual Deployment

To deploy manually (e.g., during development or for debugging):

```bash
npm run remotion:deploy
```

Ensure you have `REMOTION_AWS_ACCESS_KEY_ID` and `REMOTION_AWS_SECRET_ACCESS_KEY` set in your environment.

---

## Troubleshooting

### Workflow runs but skips deployment

Check the "Determine if we should deploy" step output. If it says `deploy=false`, the changes didn't match the Remotion-specific patterns. This is expected behavior for unrelated `package.json` changes.

### AWS credentials not set

If you see "Lambda renders were not set up", ensure the GitHub Secrets are configured correctly and have the exact names specified above.

### Deployment fails with permissions error

Verify your AWS credentials have the necessary permissions. See the [Remotion Lambda permissions guide](https://www.remotion.dev/docs/lambda/permissions) for the required IAM policy.
