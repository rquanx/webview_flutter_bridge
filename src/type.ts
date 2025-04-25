// src/payload.ts
export interface Payload<T = any> {
  /** 动作标识 */
  action: string;
  /** 唯一请求/响应 ID */
  id: string;
  /** 携带的数据 */
  data?: T;
  /** 状态码 (例如 200 表示成功) */
  code?: number;
  /** 错误信息 */
  errorMessage?: string;
}


/**
 * 描述 Flutter 注入的原生 Bridge 对象结构
 */
export interface NativeBridge {
  postMessage: (message: string) => void;
}

/**
 * 存储待处理 Promise 的相关信息
 */
export interface PendingPromise<T = any> {
  resolve: (value: T | PromiseLike<T>) => void; // Promise 的 resolve 函数
  reject: (reason?: any) => void; // Promise 的 reject 函数
  timer: number; // Timeout 定时器的 ID
}


export interface Options {
  timeout: number; // 超时时间，单位为毫秒，默认为 10000ms
  innerChannel: string;
}

export type CallbackEvent<T = any, R = any> = (data: T) => Promise<R>;

