export const cachePromise = <T>(
    promiseCallback: () => Promise<T>,
    cacheDuration: number
): { exec: () => Promise<T>; reset: () => void; set: (value: Promise<T>) => Promise<T> } => {
    let promise: Promise<T> | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const reset = (): void => {
        promise = null;
    };

    const exec = async (): Promise<T> => {
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

    const set = (value: Promise<T>): Promise<T> => {
        promise = value;

        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => reset(), cacheDuration);

        return promise;
    };

    return { exec, reset, set };
};
