const cachePromise = (promiseCallback, cacheDuration) => {
    let promise;
    let timeoutId;

    const reset = () => {
        promise = null;
    };

    const exec = async () => {
        if (promise) {
            return promise;
        }

        try {
            return await set(promiseCallback());
        } catch (error) {
            // reset cache on error
            reset();

            throw error;
        }
    };

    const set = value => {
        promise = value;

        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => reset(), cacheDuration);

        return promise;
    };

    return { exec, reset, set };
};

module.exports = { cachePromise };
