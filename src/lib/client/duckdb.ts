import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: eh_worker,
    },
};

let instance: duckdb.AsyncDuckDB | null = null;
let initPromise: Promise<duckdb.AsyncDuckDB> | null = null;

export async function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
    if (instance) return instance;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
        const worker = new Worker(bundle.mainWorker!);
        const logger = new duckdb.ConsoleLogger();
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        instance = db;
        return db;
    })();

    return initPromise;
}

export async function terminateDuckDB(): Promise<void> {
    if (instance) {
        await instance.terminate();
        instance = null;
        initPromise = null;
    }
}

