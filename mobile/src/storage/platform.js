import { Capacitor, registerPlugin } from '@capacitor/core';
import { readNativeSession } from './readNativeSession.js';

const LocalSession = registerPlugin('LocalSession');

export async function createStorageBackend() {
    if (['android', 'ios'].includes(Capacitor.getPlatform())) {
        let saved = await readNativeSession(() => LocalSession.get());
        return {
            getItem: () => saved,
            async setItem(_, value) {
                // Both native backends acknowledge only after the write completes.
                await LocalSession.set({ value });
                saved = value;
            },
        };
    }
    return { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
}
