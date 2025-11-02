type QueueItem = {
    request: () => Promise<any>;
    resolve: (value: any | PromiseLike<any>) => void;
    reject: (reason?: any) => void;
    key?: string;
};

export class RequestQueue {
    private queue: QueueItem[];
    private maxConcurrent: number;
    private currentConcurrent: number;
    private inflightKeys: Set<string>;
    private queuedKeys: Set<string>;

    constructor(maxConcurrent = 12) {
        this.queue = [];
        this.maxConcurrent = maxConcurrent;
        this.currentConcurrent = 0;
        this.inflightKeys = new Set();
        this.queuedKeys = new Set();
    }

    async push(request: () => Promise<any>, key?: string): Promise<any> {
        if (key) {
            if (this.inflightKeys.has(key) || this.queuedKeys.has(key)) {
                return Promise.resolve(undefined);
            }
            this.queuedKeys.add(key);
        }
        return new Promise((resolve, reject) => {
            this.queue.push({
                request,
                resolve,
                reject,
                key,
            });
            this.checkQueue();
        });
    }

    private checkQueue(): void {
        if (this.queue.length === 0 || this.currentConcurrent >= this.maxConcurrent) return;

        const { request, resolve, reject, key } = this.queue.shift() as QueueItem;
        this.currentConcurrent++;
        if (key) {
            this.queuedKeys.delete(key);
            this.inflightKeys.add(key);
        }

        request()
            .then(resolve)
            .catch(reject)
            .finally(() => {
                this.currentConcurrent--;
                if (key) {
                    this.inflightKeys.delete(key);
                }
                this.checkQueue();
            });
    }
}
