# actual-sync

Unified sync job for [Actual Budget](https://actualbudget.org/) that:
1. Imports transactions from MyEdenred Portugal (`actual-edenred`)
2. Imports transactions from Trading212 (`actual-t212`), tracking `lastSync` in `data/state.json`
3. Triggers Actual's built-in bank sync (`runBankSync()`) for linked bank accounts
4. Syncs the budget with the Actual server
5. Counts uncategorized transactions across open, on-budget accounts (excluding transfers and split parents) and reports the summary to [ntfy](https://ntfy.sh/)

## Development

`package.json` references `actual-edenred` and `actual-t212` from GitHub. Push those repositories before building the Docker image, or link them locally for development:

```bash
npm install
npm link ../actual-edenred-importer ../actual-t212-importer
npm start
```
