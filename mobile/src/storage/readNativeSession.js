// Read-only retry: a WebView reload can lose the first bridge reply. Never use
// this helper to retry writes or substitute an empty session after a read error.
export async function readNativeSession(get, timeoutMs = 2000) {
    let failure;
    for (let attempt = 0; attempt < 2; attempt++) {
        let timer;
        try {
            const result = await Promise.race([Promise.resolve().then(get), new Promise((_, reject) => {
                timer = setTimeout(() => reject(Error('Native session read timed out')), timeoutMs);
            })]);
            if (!result || !(result.value === null || typeof result.value === 'string')) throw Error('Invalid native session response');
            return result.value;
        } catch (error) { failure = error; }
        finally { clearTimeout(timer); }
    }
    throw failure;
}
