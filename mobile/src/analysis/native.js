import { Capacitor, registerPlugin } from '@capacitor/core';
const plugin = registerPlugin('Pikafish');

export function nativeAnalysis() {
    const available = ['android', 'ios'].includes(Capacitor.getPlatform());
    return {
        available,
        async listen(output, failure) {
            const handles = [];
            try {
                handles.push(await plugin.addListener('output', output));
                handles.push(await plugin.addListener('failure', failure));
                return async () => { for (const handle of handles) await handle.remove(); };
            } catch (error) { for (const handle of handles) await handle.remove(); throw error; }
        },
        analyze: request => plugin.analyze(request),
        stop: () => available ? plugin.stop() : Promise.resolve(),
        lookupBook: async fen => (await plugin.lookupBook({ fen })).rows,
    };
}
