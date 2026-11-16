export function getConfig() {
    const edenredCards = [];
    if (process.env.ACTUAL_ACCOUNT_REFEICAO) {
        edenredCards.push({
            name: "Edenred Refeição",
            cardId: process.env.EDENRED_CARD_ID_REFEICAO ? Number(process.env.EDENRED_CARD_ID_REFEICAO) : null,
            actualAccountId: process.env.ACTUAL_ACCOUNT_REFEICAO
        });
    }
    if (process.env.ACTUAL_ACCOUNT_FLEXIVEL) {
        edenredCards.push({
            name: "Edenred Flexível",
            cardId: process.env.EDENRED_CARD_ID_FLEXIVEL ? Number(process.env.EDENRED_CARD_ID_FLEXIVEL) : null,
            actualAccountId: process.env.ACTUAL_ACCOUNT_FLEXIVEL
        });
    }

    const t212AccountId = process.env.T212_ACTUAL_ACCOUNT_ID || process.env.ACTUAL_ACCOUNT_T212 || null;

    return {
        actual: {
            serverURL: process.env.ACTUAL_SERVER_URL,
            password: process.env.ACTUAL_PASSWORD,
            budgetId: process.env.ACTUAL_BUDGET_ID,
            dataDir: process.env.DATA_DIR || "./data",
            runBankSync: process.env.ACTUAL_RUN_BANK_SYNC !== "false" && process.env.ACTUAL_RUN_BANK_SYNC !== "0"
        },
        edenred: {
            enabled: Boolean(process.env.EDENRED_TOKEN && edenredCards.length > 0),
            token: process.env.EDENRED_TOKEN || null,
            cards: edenredCards
        },
        t212: {
            enabled: Boolean(process.env.T212_TOKEN && t212AccountId),
            token: process.env.T212_TOKEN || null,
            accountId: t212AccountId,
            initialFromDate: process.env.T212_INITIAL_FROM_DATE || null
        },
        ntfy: {
            url: process.env.NTFY_URL || null,
            topic: process.env.NTFY_TOPIC || null,
            token: process.env.NTFY_TOKEN || null
        }
    };
}
