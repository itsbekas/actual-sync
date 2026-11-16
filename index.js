import fs from "fs";
import actualClient from "@actual-app/api";
import { getTransactions as getEdenredTransactions } from "actual-edenred";
import { getTransactions as getT212Transactions } from "actual-t212";
import dayjs from "dayjs";
import { getConfig } from "./config.js";
import { sendNtfyNotification } from "./ntfy.js";
import { loadState, saveState } from "./state.js";

function logImportResult(label, result) {
    console.log(`  ${label}: added ${result.added.length}, updated ${result.updated.length}`);
    for (const err of result.errors || []) {
        console.warn(`  Import warning (${label}): ${err.message}`);
    }
}

function countUncategorizedInTransactions(transactions) {
    let count = 0;
    for (const tx of transactions) {
        if (tx.transfer_id) {
            continue;
        }
        if (tx.is_parent && Array.isArray(tx.subtransactions)) {
            for (const sub of tx.subtransactions) {
                if (!sub.transfer_id && !sub.category) {
                    count++;
                }
            }
        } else if (!tx.category) {
            count++;
        }
    }
    return count;
}

async function countUncategorizedTransactions() {
    const accounts = await actualClient.getAccounts();
    const openBudgetAccounts = accounts.filter(a => !a.closed && !a.offbudget);
    const endDate = dayjs().format("YYYY-MM-DD");

    let total = 0;
    for (const account of openBudgetAccounts) {
        const txs = await actualClient.getTransactions(account.id, "1900-01-01", endDate);
        total += countUncategorizedInTransactions(txs);
    }
    return total;
}

async function syncEdenred(config) {
    console.log("Fetching Edenred transactions...");
    const { cards } = await getEdenredTransactions({
        token: config.edenred.token,
        cards: config.edenred.cards
    });

    let added = 0;
    for (const card of cards) {
        const result = await actualClient.importTransactions(card.actualAccountId, card.transactions);
        logImportResult(card.cardName, result);
        added += result.added.length;
    }
    return added;
}

async function syncTrading212(config, state) {
    const fromDate =
        state.t212.lastSync ||
        config.t212.initialFromDate ||
        dayjs().subtract(30, "day").toISOString();
    const toDate = new Date().toISOString();

    console.log(`Fetching Trading212 transactions (${fromDate} -> ${toDate})...`);
    const transactions = await getT212Transactions({
        token: config.t212.token,
        accountId: config.t212.accountId,
        fromDate,
        toDate
    });

    const result = await actualClient.importTransactions(config.t212.accountId, transactions);
    logImportResult("Trading212", result);

    state.t212.lastSync = toDate;
    saveState(config.actual.dataDir, state);

    return result.added.length;
}

async function run() {
    console.log(`\n=== Actual Sync started at ${new Date().toISOString()} ===\n`);
    const config = getConfig();

    if (!config.actual.serverURL || !config.actual.password || !config.actual.budgetId) {
        console.error("Missing Actual Budget configuration (ACTUAL_SERVER_URL, ACTUAL_PASSWORD, ACTUAL_BUDGET_ID).");
        return false;
    }

    if (!fs.existsSync(config.actual.dataDir)) {
        fs.mkdirSync(config.actual.dataDir, { recursive: true });
    }

    const state = loadState(config.actual.dataDir);
    const errors = [];
    const summaryLines = [];
    let actualInitialized = false;

    try {
        console.log(`Connecting to Actual Budget at ${config.actual.serverURL}...`);
        await actualClient.init({
            dataDir: config.actual.dataDir,
            serverURL: config.actual.serverURL,
            password: config.actual.password
        });
        actualInitialized = true;

        console.log(`Downloading budget ${config.actual.budgetId}...`);
        await actualClient.downloadBudget(config.actual.budgetId);

        if (config.edenred.enabled) {
            try {
                const added = await syncEdenred(config);
                summaryLines.push(`Edenred: +${added} new`);
            } catch (error) {
                const msg = `Edenred: ${error.message || error}`;
                console.error(`Error syncing ${msg}`);
                errors.push(msg);
            }
        } else {
            console.log("Edenred not configured; skipping.");
        }

        if (config.t212.enabled) {
            try {
                const added = await syncTrading212(config, state);
                summaryLines.push(`Trading212: +${added} new`);
            } catch (error) {
                const msg = `Trading212: ${error.message || error}`;
                console.error(`Error syncing ${msg}`);
                errors.push(msg);
            }
        } else {
            console.log("Trading212 not configured; skipping.");
        }

        if (config.actual.runBankSync) {
            try {
                console.log("Running Actual bank sync for linked accounts...");
                await actualClient.runBankSync();
                summaryLines.push("Bank sync: ok");
            } catch (error) {
                const msg = `Bank sync: ${error.message || error}`;
                console.error(`Error during ${msg}`);
                errors.push(msg);
            }
        }

        console.log("Syncing budget changes with Actual server...");
        await actualClient.sync();

        const uncategorizedCount = await countUncategorizedTransactions();
        console.log(`Uncategorized transactions (open on-budget accounts): ${uncategorizedCount}`);

        const messageParts = [
            `Uncategorized transactions: ${uncategorizedCount}`,
            ...summaryLines
        ];
        if (errors.length > 0) {
            messageParts.push("", "Errors:", ...errors.map(e => `- ${e}`));
        }

        const hasErrors = errors.length > 0;
        const title = hasErrors
            ? `Actual Sync: ${uncategorizedCount} uncategorized (with errors)`
            : `Actual Sync: ${uncategorizedCount} uncategorized`;

        await sendNtfyNotification({
            url: config.ntfy.url,
            topic: config.ntfy.topic,
            token: config.ntfy.token,
            title,
            message: messageParts.join("\n"),
            priority: hasErrors ? "high" : uncategorizedCount > 0 ? "default" : "low",
            tags: hasErrors ? ["warning"] : uncategorizedCount > 0 ? ["moneybag"] : ["white_check_mark"]
        });

        console.log(`\nSync finished at ${new Date().toISOString()} (${errors.length} error(s)).`);
        return errors.length === 0;
    } catch (error) {
        console.error("Fatal error during sync:", error.message || error);
        await sendNtfyNotification({
            url: config.ntfy.url,
            topic: config.ntfy.topic,
            token: config.ntfy.token,
            title: "Actual Sync failed",
            message: `Fatal error: ${error.message || error}`,
            priority: "high",
            tags: ["rotating_light"]
        });
        return false;
    } finally {
        if (actualInitialized) {
            try {
                await actualClient.shutdown();
            } catch {
                // Ignore cleanup error if already closed
            }
        }
    }
}

const ok = await run();
process.exit(ok ? 0 : 1);
