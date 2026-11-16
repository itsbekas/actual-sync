/**
 * Sends a notification to ntfy. Never throws: logs errors so an unreachable
 * ntfy server does not fail the sync job.
 */
export async function sendNtfyNotification({ url, topic, token, title, message, priority = "default", tags = [] }) {
    if (!url || !topic) {
        console.log("ntfy is not configured (NTFY_URL / NTFY_TOPIC missing); skipping notification.");
        return false;
    }

    const endpoint = `${url.replace(/\/+$/, "")}/${encodeURIComponent(topic)}`;
    const headers = {
        "Title": title,
        "Priority": priority
    };

    if (tags.length > 0) {
        headers["Tags"] = tags.join(",");
    }
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: message
        });

        if (!response.ok) {
            const body = await response.text().catch(() => "");
            console.error(`ntfy notification failed (${response.status} ${response.statusText}): ${body}`);
            return false;
        }

        console.log(`ntfy notification sent to ${endpoint}.`);
        return true;
    } catch (error) {
        console.error("Failed to send ntfy notification:", error.message || error);
        return false;
    }
}
