export async function load({ locals }) {
    
    if(!locals.config) {
        throw new Error("No config has been set! Please contact an administrator.");
    }

    return {
        config: locals.config
    }
}