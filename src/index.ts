// src/main.ts
import { nanoid } from "nanoid";
import { CallbackEvent, NativeBridge, Options, Payload, PendingPromise } from "./type";

let instance: FlutterBridgeSDK | null = null; // 单例实例
export class FlutterBridgeSDK {
    private pendingPromises: Map<string, PendingPromise> = new Map();
    private eventListeners: Map<string, Set<CallbackEvent>> = new Map(); // 使用 Set 防止重复添加同一回调
    private options: Options = { timeout: 15000, innerChannel: 'native_to_client_channel' }; // 存储选项

    constructor(private channelName = 'client_to_native_channel', options?: Partial<Options>) {
        this.options = { ...this.options, ...options }; // 合并默认选项和传入选项，优先使用传入选项
    }

    public async waitForBridgeReady(): Promise<void> {
        return new Promise((resolve) => {
            const checkBridge = () => {
                const bridge = this.getBridge(this.channelName);
                const innerBridge = this.getBridge(this.options.innerChannel);
                const isBridgeReady = bridge && typeof bridge.postMessage === 'function';
                const isInnerBridgeReady = innerBridge && typeof innerBridge.postMessage === 'function';
                if (isBridgeReady && isInnerBridgeReady) {
                    resolve(); // 当 bridge 可用时，resolve 这个 Promise
                } else {
                    setTimeout(checkBridge, 100); // 每隔 100ms 检查一次
                }
            }
            checkBridge();
        })
    }

    private getBridge(channelName: string): NativeBridge {
        return (window as any)?.[channelName] as NativeBridge;
    }

    /**
     * 处理从 Flutter 通过全局函数接收到的消息,并且当函数执行完成后，通过 innerChannel 通知 flutter 客户端处理完成
     * @param messageJson - Flutter 传来的 JSON 字符串
     */
    public async dispatch(messageJson: string) {
        console.log(
            `FlutterBridgeSDK: Received message from Flutter: ${messageJson}`
        );
        let payload: Payload;
        try {
            payload = JSON.parse(messageJson);
            if (!payload || typeof payload.id !== "string") {
                // 对于响应类型消息，id 是必须的
                if (this.pendingPromises.has(payload?.id)) {
                    console.error(
                        "FlutterBridgeSDK: Received message is missing a valid ID.",
                        payload
                    );
                    // 如果能找到对应的 promise，则 reject 它
                    this.rejectPendingPromise(
                        payload.id,
                        new Error("Received response from Flutter is missing a valid ID.")
                    );
                } else if (payload?.action && this.eventListeners.has(payload.action)) {
                    // 事件类型消息 id 不是必须的，但 action 是
                    console.warn(
                        "FlutterBridgeSDK: Received event message might be malformed (missing id?), proceeding with action:",
                        payload.action
                    );
                } else {
                    console.error(
                        "FlutterBridgeSDK: Received malformed message from Flutter.",
                        messageJson
                    );
                    return; // 无法处理，直接返回
                }
            }
        } catch (error) {
            console.error(
                "FlutterBridgeSDK: Failed to parse message from Flutter:",
                error,
                messageJson
            );
            return undefined;
        }

        // 检查是否是某个 postMessage 请求的响应
        if (this.pendingPromises.has(payload.id)) {
            const promiseCallbacks = this.pendingPromises.get(payload.id)!;
            clearTimeout(promiseCallbacks.timer); // 清除超时定时器

            // 判断是成功还是失败的响应
            // Flutter 应该设置 code (例如 200) 或 errorMessage
            // 我们也兼容 code 和 errorMessage 都为 null/undefined 的情况作为成功
            if (
                (payload.code != null && payload.code >= 200 && payload.code < 300) ||
                (payload.code == null && payload.errorMessage == null)
            ) {
                promiseCallbacks.resolve(payload.data); // 成功，解析数据
            } else {
                // 失败，拒绝 Promise
                const error = new Error(
                    payload.errorMessage ||
                    `Flutter request failed with code ${payload.code || "unknown"}`
                );
                (error as any).code = payload.code; // 可以将 code 附加到错误对象上
                promiseCallbacks.reject(error);
            }
            this.pendingPromises.delete(payload.id); // 处理完毕，从 Map 中移除
        }
        // 检查是否是 Flutter 主动推送的事件
        else if (payload.action && this.eventListeners.has(payload.action)) {
            const listeners = this.eventListeners.get(payload.action)!;
            const innerBridge = this.getBridge(this.options.innerChannel); // 获取 innerChannel 实例，用于发送响应
            if(!innerBridge){
                await this.waitForBridgeReady(); // 等待 bridge 准备就绪
            }

            // 使用 try...catch 包裹每个回调，防止一个回调出错影响其他回调
            listeners.forEach(async (callback) => {
                try {
                    const result = await callback(payload.data); // 将数据传递给监听器
                    innerBridge?.postMessage(JSON.stringify({
                        action: payload.action, // 确保返回的消息包含相同的 action
                        data: result, // 返回结果
                        id: payload.id, // 保留 id，以便 Flutter 知道这是响应
                        code: 200
                    }));
                } catch (error) {
                    innerBridge?.postMessage(JSON.stringify({
                        action: payload.action, // 确保返回的消息包含相同的 action
                        id: payload.id, // 保留 id，以便 Flutter 知道这是响应
                        code: 500
                    }));
                    console.error(
                        `FlutterBridgeSDK: Error in event listener for action "${payload.action}":`,
                        error
                    );
                }
            });
        } else {
            // 既不是响应也不是监听的事件
            console.warn(
                `FlutterBridgeSDK: Received message with unhandled action or ID: Action=${payload.action}, ID=${payload.id}`
            );
        }
    }

    /**
     * 拒绝一个等待中的 Promise
     * @param id Promise ID
     * @param reason 拒绝的原因
     */
    private rejectPendingPromise(id: string, reason: any) {
        if (this.pendingPromises.has(id)) {
            const promiseCallbacks = this.pendingPromises.get(id)!;
            clearTimeout(promiseCallbacks.timer);
            promiseCallbacks.reject(reason);
            this.pendingPromises.delete(id);
        }
    }

    // --- 公共 API 方法 ---

    /**
     * 向 Flutter 发送消息，并返回一个 Promise 等待响应。
     * @param action - 动作标识符 (例如 'getUserInfo', 'performPayment').
     * @param data - (可选) 要发送的数据.
     * @param timeout - (可选) 超时时间 (毫秒). 默认 15 秒.
     * @returns 一个 Promise，成功时解析为 Flutter 返回的数据，失败时拒绝并带有错误信息或超时错误.
     */
    public async postMessage<TResponse = any, TRequest = any>(
        action: string,
        data?: TRequest,
        timeout: number = this.options.timeout!
    ): Promise<TResponse> {
        const nativeBridge = this.getBridge(this.channelName);
        if (!nativeBridge) {
            await this.waitForBridgeReady(); // 等待 bridge 准备就绪
        }

        const id = nanoid(); // 生成唯一 ID
        const payload: Payload<TRequest> = { action, id, data };

        return new Promise<TResponse>((resolve, reject) => {
            // 设置超时定时器
            const timer = window.setTimeout(() => {
                // 超时后，从 Map 中移除并拒绝 Promise
                if (this.pendingPromises.has(id)) {
                    this.pendingPromises.delete(id);
                    reject(
                        new Error(
                            `FlutterBridgeSDK: Request timed out for action "${action}" (id: ${id}) after ${timeout}ms`
                        )
                    );
                }
            }, timeout);

            // 将 resolve, reject 和 timer 存入 Map
            this.pendingPromises.set(id, { resolve, reject, timer });

            try {
                const messageJson = JSON.stringify(payload);
                console.log(
                    `FlutterBridgeSDK: Sending message to Flutter (id: ${id}): ${messageJson}`
                );
                // 调用 Flutter 注入的 postMessage 方法
                nativeBridge!.postMessage(messageJson);
            } catch (error) {
                console.error(
                    `FlutterBridgeSDK: Error sending message (id: ${id}):`,
                    error
                );
                // 如果发送本身就失败了，立即清理并拒绝 Promise
                clearTimeout(timer);
                this.pendingPromises.delete(id);
                reject(error);
            }
        });
    }

    /**
     * 注册一个监听器，用于接收 Flutter 主动推送的特定事件。
     * @param action - 要监听的事件动作标识符 (例如 'userDidLogin', 'networkStatusChanged').
     * @param callback - 当事件发生时执行的回调函数，接收事件数据作为参数.
     * @returns 一个函数，调用该函数可以取消本次监听.
     */
    public listenMessage<T = any>(
        action: string,
        callback: CallbackEvent<T>
    ): () => void {
        if (!this.eventListeners.has(action)) {
            this.eventListeners.set(action, new Set());
        }
        const listeners = this.eventListeners.get(action)!;

        const cancel = () => {
            if (this.eventListeners.has(action)) {
                const currentListeners = this.eventListeners.get(action)!;
                currentListeners.clear();
                this.eventListeners.delete(action);
                console.log(`FlutterBridgeSDK: No more listeners for action "${action}", removing entry.`);
            }
        };
        if (listeners.has(callback)) {
            console.warn(
                `FlutterBridgeSDK: Listener already registered for action "${action}" with the same callback.`
            );
            return cancel
        }
        if (listeners.size > 0) {
            listeners.clear();
            console.warn(
                `FlutterBridgeSDK: Listener already exists,the old one will be replaced with the new one.`
            );
        }
        listeners.add(callback);
        console.log(`FlutterBridgeSDK: Listener registered for action "${action}"`);
        return cancel
    }
}


// --- 实例化并暴露到全局 ---
// Vite 打包配置中的 `lib.name` 决定了这里的全局变量名
// 我们在 vite.config.ts 中设置了 name: 'FlutterBridge'
// 所以这里不需要显式挂载，Vite 的 IIFE 包裹器会自动完成
// new FlutterBridgeSDK(); // Vite IIFE 会处理实例化和暴露

// 为了在非模块化环境或调试时更明确，可以显式挂载（但这会覆盖 Vite 的自动挂载）
// 如果 vite.config.ts 中没有设置 lib.name，则需要下面这行
if (typeof window === 'undefined') {
    console.warn(
        "FlutterBridgeSDK: window is undefined. unknown env."
    )
}
else if (!window.flutterBridge) {
    instance = new FlutterBridgeSDK()
    window.flutterBridge = instance;
    console.log(
        "FlutterBridgeSDK: Instance explicitly mounted to window.FlutterBridge."
    );
} else {
    console.log("FlutterBridgeSDK: Instance was automatically mounted by Vite.");
}

export default instance; 
