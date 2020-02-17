function cachePromise(promiseCallback, cacheDuration) {
    let promise;

    const reset = () => {
        promise = null;
    };

    const exec = async () => {
        if (promise) {
            return promise;
        }

        try {
            promise = promiseCallback();

            setTimeout(() => reset(), cacheDuration);

            return await promise;
        } catch (error) {
            // reset cache on error
            reset();

            throw error;
        }
    };

    return { exec, reset };
}

module.exports = { cachePromise };
