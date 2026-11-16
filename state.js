import fs from "fs";
import path from "path";

function statePath(dataDir) {
    return path.join(dataDir, "state.json");
}

const EMPTY_STATE = {
    t212: {
        lastSync: null
    }
};

export function loadState(dataDir) {
    const file = statePath(dataDir);
    if (!fs.existsSync(file)) {
        return structuredClone(EMPTY_STATE);
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        return {
            t212: {
                ...EMPTY_STATE.t212,
                ...(parsed.t212 || {})
            }
        };
    } catch (error) {
        console.warn(`Could not read ${file}, starting from a clean state:`, error.message);
        return structuredClone(EMPTY_STATE);
    }
}

export function saveState(dataDir, state) {
    const file = statePath(dataDir);
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state, null, 2), "utf8");
}
