export interface IMetaClass<T> {
    new(json?: any): T
}
export interface IObserver {
    readonly target: any
    readonly callback: Function
}
export class Network {
    /**
     * @override point you shoud overwrite this property and provide you custom headers
     * @example 
     * ``
     * protected get headers(): any {
     *     return {
     *         token:'yourtoken',
     *         account:'youraccount' 
     *     }
     * }
     * ``
     */
    protected get headers(): Record<string, string> {
        return {}
    }
    /**
     * @override point you shoud overwrite this property and provide you custom headers
     * @example 
     * ``
     * protected get method(): any {
     *     return 'POST'
     * }
     * ``
     */
    protected get method(): Network.Method {
        return 'POST'
    }
    /**
     * @description resove relative uri to full url
     * @param path the relative uri
     */
    protected url(path: string): string {
        throw new Error('Network.url(path:string) must be implement')
    }
    /**
     * @description you must provid an resover and return you business object
     * @param json the jsoned respons data
     */
    protected resolve(json: any): any | Promise<any> {
        throw new Error('Network.resolve must be implement')
    }
    public readonly upload = <T = any>(path: string, upload: Network.Upload) => {
        const data = new FormData()
        data.append(upload.name, upload.data)
        if (upload.params) {
            for (const key in upload.params) {
                data.append(upload.params[key], key)
            }
        }
        const headers = upload.opts && upload.opts.headers || this.headers
        headers['Content-Type'] = upload.type
        const options = Object.assign({ headers }, upload.opts)
        const values = Network.post(this.url(path), data, options)
        const promiss = values[0]
            .then(json => {
                const parser = options && options.parser || this.resolve.bind(this)
                const value: T = parser(json)
                return value
            })
        return new Network.UploadTask(promiss, values[1])
    }
    public readonly anyreq = <T>(req: Network.Request<T>) => {
        return this.anytask<T>(req.path, req.data, req.options)
    }
    public readonly objreq = <T>(req: Network.Request<T>) => {
        if (typeof req.meta !== 'function') throw new Error('the req of objreq must be Function')
        return this.objtask(req.meta as IMetaClass<T>, req.path, req.data, req.options)
    }
    public readonly aryreq = <T>(req: Network.Request<T>) => {
        if (typeof req.meta !== 'function') throw new Error('the req of aryreq must be Function')
        return this.arytask(req.meta as IMetaClass<T>, req.path, req.data, req.options)
    }
    public readonly anytask = <T = any>(path: string, data?: any, opts?: Network.Options) => {
        const options = Object.assign({ method: this.method, headers: this.headers }, opts)
        const values = Network.http(this.url(path), data, options)
        const promiss = values[0]
            .then(json => {
                const parser = options && options.parser || this.resolve.bind(this)
                const value: T = parser(json)
                return value
            })
        return new Network.DataTask(promiss, values[1])
    }
    public readonly objtask = <T>(meta: IMetaClass<T>, path: string, data?: any, opts?: Network.Options) => {
        const options = Object.assign({ method: this.method, headers: this.headers }, opts)
        const values = Network.http(this.url(path), data, options)
        const promiss = values[0]
            .then(json => {
                const parser = options && options.parser || this.resolve.bind(this)
                return parser(json)
            }).then(value => new meta(value))
        return new Network.DataTask(promiss, values[1])
    }
    public readonly arytask = <T>(meta: IMetaClass<T>, path: string, data?: any, opts?: Network.Options) => {
        const options = Object.assign({ method: this.method, headers: this.headers }, opts)
        const values = Network.http(this.url(path), data, options)
        const promiss = values[0]
            .then(json => {
                const parser = options && options.parser || this.resolve.bind(this)
                return parser(json)
            })
            .then(value => Array.isArray(value) ? value.map(ele => new meta(ele)) : [])
        return new Network.DataTask(promiss, values[1])
    }

}
export namespace Network {
    export type Method = 'POST' | 'GET'
    export type ErrorType = 'abort' | 'timeout' | 'service' | 'business'
    export interface Upload {
        readonly name: string
        readonly data: Blob
        readonly type: string
        readonly opts?: Pick<Options, 'headers' | 'parser' | 'timeout'>
        readonly params?: Record<string, any>
    }
    export interface Request<T = any> {
        readonly path: string
        readonly meta: IMetaClass<T> | T
        readonly data?: any
        readonly options?: Options
    }
    export interface Options {
        method?: Method//@default 'GET'
        headers?: Record<string, string>
        /** 
         * @description the response type for xhr.responseType
         * @default 'json'
         */
        readonly resptype?: 'json' | 'text'
        /** @default 10000 */
        readonly timeout?: number
        readonly parser?: (resp: any) => any
    }
    export class Error {
        readonly type: ErrorType
        readonly status: number
        readonly message: string
        private constructor(type: ErrorType, status: number, message: string) {
            this.type = type
            this.status = status
            this.message = message
        }
        static readonly abort = (status: number) => {
            return new Error('abort', status, 'The request has been abort!')
        }
        static readonly timeout = (status: number) => {
            return new Error('timeout', status, 'Request timeout!')
        }
        static readonly service = (status: number) => {
            return new Error('service', status, 'The game service unavailable!')
        }
    }
    export class DataTask<T> implements PromiseLike<T>{
        private readonly promiss: Promise<T>
        private readonly handler: XMLHttpRequest
        public readonly [Symbol.toStringTag]: 'Promise' = 'Promise'
        constructor(promiss: Promise<T>, handler: XMLHttpRequest) {
            this.promiss = promiss
            this.handler = handler
        }
        public readonly then = <TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2> => {
            return this.promiss.then(onfulfilled, onrejected)
        }
        public readonly catch = <TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult> => {
            return this.promiss.catch(onrejected)
        }
        public readonly abort = () => {
            this.handler.abort()
        }
        public readonly onProgress = (func: (evt: ProgressEvent) => void) => {
            this.handler.onprogress = func
        }
    }
    export class UploadTask<T> extends DataTask<T>{
        public readonly onProgress = (func: (evt: ProgressEvent) => void) => {
            this['handler'].upload.onprogress = func
        }
    }
    /**
     * @description create http request
     * @param url absolute url of request
     * @param data request data
     * @param opts request options
     */
    export const http = (url: string, data?: any, opts?: Network.Options) => {
        return (opts && opts.method) === 'POST' ? Network.post(url, data, opts) : Network.get(url, data, opts)
    }
    /**
     * @description create http request with method 'GET' 
     * @notice @param method in @param opts dos't effect
     * @param url absolute url of request
     * @param data request data
     * @param opts request options
     */
    export const get = (url: string, data?: any, opts?: Options): [Promise<any>, XMLHttpRequest] => {
        let handler: XMLHttpRequest
        const promiss = new Promise<any>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            handler = xhr
            xhr.onabort = () => reject(Network.Error.abort(xhr.status))
            xhr.ontimeout = () => reject(Network.Error.timeout(xhr.status))
            xhr.onerror = () => reject(Network.Error.service(xhr.status))
            xhr.onloadend = () => {
                sys.log('\nrequest:url=', url, 'request:data=', data, '\nresponse=', xhr.response)
                if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
                    resolve(xhr.responseType === 'json' ? xhr.response : xhr.responseText)
                } else {
                    reject(Error.service(xhr.status))
                }
            }
            const params = data || {}
            const keys = Object.keys(params)
            if (keys.length > 0) {
                url = url + '?' + keys[0] + "=" + params[keys[0]]
                for (let index = 1; index < keys.length; index++) {
                    const key = keys[index]
                    url = url + "&" + key + "=" + params[key]
                }
            }
            xhr.open('GET', url, true)
            xhr.timeout = opts && opts.timeout || 10000
            xhr.responseType = opts && opts.resptype || 'json'
            const headers = opts && opts.headers || {}
            for (const key in headers) {
                xhr.setRequestHeader(key, headers[key])
            }
            xhr.send()
        })
        return [promiss, handler]
    }
    /**
     * @description create http request with method 'GET' 
     * @notice @param method in @param opts dos't effect
     * @param url absolute url of request
     * @param data request data
     * @param opts request options
     */
    export const post = (url: string, data?: any, opts?: Options): [Promise<any>, XMLHttpRequest] => {
        let handler: XMLHttpRequest
        const promiss = new Promise<any>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            handler = xhr
            xhr.onabort = () => reject(Network.Error.abort(xhr.status))
            xhr.ontimeout = () => reject(Network.Error.timeout(xhr.status))
            xhr.onerror = () => reject(Network.Error.service(xhr.status))
            xhr.onloadend = () => {
                sys.log('\nrequest:url=', url, 'request:data=', data, '\nresponse=', xhr.response)
                if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
                    resolve(xhr.responseType === 'json' ? xhr.response : xhr.responseText)
                } else {
                    reject(Error.service(xhr.status))
                }
            }
            xhr.open('POST', url, true)
            xhr.timeout = opts && opts.timeout || 10000
            xhr.responseType = opts && opts.resptype || 'json'
            xhr.setRequestHeader('Content-Type', 'application/json')
            const headers = opts && opts.headers || {}
            for (const key in headers) {
                xhr.setRequestHeader(key, headers[key])
            }
            xhr.send(data && JSON.stringify(data))
        })
        return [promiss, handler]
    }
}
export class Socket {
    private ws: WebSocket
    private protocols: string | string[]
    private _retrying: boolean = false
    private readonly buildurl: () => string
    public retryable: boolean = false
    public binaryType: BinaryType
    public readonly retry: Socket.Retry
    public onopen: (evt: Event, isRetry: boolean) => void
    public onclose: (evt: CloseEvent, reason: Socket.Reason) => void
    public onerror: (evt: ErrorEvent) => void
    public onmessage: (evt: MessageEvent) => void
    constructor(builder: () => string, protocols?: string | string[]) {
        this.buildurl = builder
        this.protocols = protocols
        this.retry = new Socket.Retry(this.onRetryCallback.bind(this), this.onRetryFailed.bind(this))
    }
    private onRetryCallback() {
        this.open()
        this._retrying = true
    }
    private onRetryFailed(e: CloseEvent) {
        this._retrying = false
        if (typeof this.onclose === 'function') {
            this.onclose(e, 'retry')
        }
    }
    private onOpenCallback(e: Event) {
        if (typeof this.onopen === 'function') {
            this.onopen.call(null, e, this._retrying)
        }
        this._retrying = false
    }
    private onCloseCallback(e: CloseEvent) {
        if (this.retryable && e.code < 3000) {
            this.retry.attempt(e);
        } else if (typeof this.onclose === 'function') {
            this._retrying = false
            let reason: Socket.Reason = 'server'
            if (e.reason === 'ping' || e.reason === 'user') {
                reason = e.reason
            }
            this.onclose(e, reason)
        }
    }
    private onErrorCallback() {
        if (typeof this.onerror === 'function') {
            this.onerror.apply(null, arguments)
        }
    }
    private onMessageCallback() {
        if (typeof this.onmessage === 'function') {
            this.onmessage.apply(null, arguments)
        }
    }
    public readonly open = () => {
        if (this.readyState === Socket.CONNECTING ||
            this.readyState === Socket.OPEN ||
            typeof this.buildurl !== 'function') {
            return
        }
        if (this.ws) {
            this.ws.onopen = null
            this.ws.onclose = null
            this.ws.onerror = null
            this.ws.onmessage = null
        }
        this.ws = new WebSocket(this.buildurl(), this.protocols);
        this.ws.binaryType = this.binaryType
        this.ws.onclose = this.onCloseCallback.bind(this);
        this.ws.onerror = this.onErrorCallback.bind(this);
        this.ws.onmessage = this.onMessageCallback.bind(this);
        this.ws.onopen = this.onOpenCallback.bind(this);
        if (this.binaryType) {
            this.ws.binaryType = this.binaryType
        }
    }
    public readonly close = (code?: number, reason?: string) => {
        if (!this.ws) return
        if (this.ws.readyState === Socket.CLOSED || this.ws.readyState === Socket.CLOSING) return
        this.ws.close(code, reason);
    }
    public readonly send = (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
        this.ws && this.ws.send(data);
    }
    public get isRetrying() { return this._retrying }
    public get protocol() { return this.ws && this.ws.protocol; }
    public get extensions() { return this.ws && this.ws.extensions; }
    public get readyState() { return this.ws && this.ws.readyState || WebSocket.CLOSED; }
    public get bufferedAmount() { return this.ws && this.ws.bufferedAmount; }
}
export namespace Socket {
    export const OPEN: number = WebSocket.OPEN
    export const CLOSED: number = WebSocket.CLOSED
    export const CLOSING: number = WebSocket.CLOSING
    export const CONNECTING: number = WebSocket.CONNECTING
    export type Events = keyof Observers
    export type Reason = 'user' | 'ping' | 'retry' | 'server'
    export type Status = 'closed' | 'closing' | 'opened' | 'opening'
    export class Observers {
        readonly open: IObserver[] = []
        readonly error: IObserver[] = []
        readonly close: IObserver[] = []
        readonly message: IObserver[] = []
    }
    /**
    * @description A retry machine for web socket
    * @description You can use it in any place where need retry machine
    */
    export class Retry {
        /**
         * @description base attempt delay time @default 100 milliscond
         * @description the real delay time use a exponential random algorithm
         */
        public delay: number = 100
        /**
         * @description the max retry times when retrying @default 58
         */
        public times: number = 8
        private count: number = 0//已经尝试次数
        private readonly onAttempt: (evt: CloseEvent) => void
        private readonly onFailed: (evt: CloseEvent) => void
        constructor(attempt: (evt: CloseEvent) => void, failed: (evt: CloseEvent) => void) {
            this.onAttempt = attempt
            this.onFailed = failed
        }
        private random(attempt: number, delay: number) {
            return Math.floor((0.5 + Math.random() * 0.5) * Math.pow(2, attempt) * delay);
        }
        /**
         * @description reset retry times counter
         */
        public readonly reset = () => {
            this.count = 0
        }
        /**
         * @description use this method to trigger onAttempt action or onFailed action
         */
        public readonly attempt = (evt: CloseEvent) => {
            if (this.count < this.times) {
                setTimeout(() => this.onAttempt(evt), this.random(this.count++, this.delay));
            } else {
                this.onFailed(evt)
            }
        }
    }
    class Ping {
        private socket: Socket
        private timer: number = null
        private timeout: number = null
        private readonly allow: boolean
        /**
         * @description desc the time interval of ping @default 30s
         */
        public interval: number = 30
        constructor(socket: Socket, allow: boolean = true) {
            this.allow = allow
            this.socket = socket
        }
        private readonly send = () => {
            if (!this.allow || this.timeout) return
            if (this.socket.readyState !== Socket.OPEN) return
            const data = "{\"type\":\"PING\"}"
            this.socket.send(data)
            sys.log('发送 PONG:', data);
            this.timeout = setTimeout(() => {
                sys.log('PING 超时');
                this.timeout = null;
                this.socket.close(1006, 'ping')
            }, 3 * 1000);
        }
        public readonly receive = (msg: any) => {
            sys.log("收到 PONG", msg);
            if (!this.allow || !this.timeout) return
            clearTimeout(this.timeout)
            this.timeout = null
        }
        public readonly start = () => {
            if (!this.allow || this.timer) return;
            this.timer = setInterval(this.send.bind(this), this.interval * 1000);
        }
        public readonly stop = () => {
            if (!this.allow || !this.timer) return;
            clearInterval(this.timer)
            this.timer = null
        }
    }
    /**
     * @description socket client wrapped on Socket
     * @description you must inherit this class to implements your logic
     * @implements client PING heartbeat mechanis
     */
    export abstract class Client {
        /**
         * @description the ping mechanis
         * @ping  use socket.send("{\"type\":\"PING\"}")
         * @pong  receive message = "{\"type\":\"PONG\"}"
         */
        protected readonly ping: Ping
        protected readonly socket: Socket
        /**
         * @notice all the observers will not be trigger 
         * @notice you must trigger it yourself at overwrite point
         */
        protected readonly observers: Observers = new Observers()
        constructor() {
            this.socket = new Socket(() => this.buildurl())
            this.ping = new Ping(this.socket, this.allowPing)
            this.socket.onopen = (evt, isRetry) => {
                sys.log('Socket Client 连接已打开！', evt);
                this.onOpened(evt, isRetry)
            }
            this.socket.onerror = evt => {
                sys.warn('Socket Client 连接打开失败，请检查！', evt);
                this.onError(evt)
            }
            this.socket.onmessage = evt => {
                sys.log('Socket Client 收到消息：', evt);
                if (typeof evt.data !== "string") return
                const msg = JSON.parse(evt.data)
                if (msg.type == "PONG") {
                    this.ping.receive(msg)
                } else {
                    this.onMessage(msg)
                }
            }
            this.socket.onclose = evt => {
                sys.log('Socket Client  已关闭！', evt);
                this.ping.stop()
                this.onClosed(evt)
            }
        }
        /**
         * @override print debug info or not @default true
         */
        protected get isDebug(): boolean {
            return true
        }
        /**
         * @description Tell me your login status @default false
         * @description If false the start method will not work
         */
        protected get isLogin(): boolean {
            return false
        }
        /**
         * @description overwrite point set allow ping or not 
         */
        protected get allowPing(): boolean {
            return true
        }
        /**
         * @override point
         * @description overwrite this method to provide url for web socket
         */
        protected buildurl(): string { return '' }
        /** call when some error occur @override point */
        protected onError(res: ErrorEvent) { }
        /** call when socket closed . @override point */
        protected onOpened(res: any, isRetry: boolean) { }
        /** 
         * @override point
         * @description call when socket closed  
         * @notice onFailed and onClosed only trigger one
         */
        protected onClosed(res: CloseEvent) { }
        /** call when get some message @override point */
        protected onMessage(msg: any) { }
        public get isConnected(): boolean {
            return this.socket.readyState === OPEN
        }
        public readonly on = (evt: Events, target: any, callback: Function) => {
            const idx = this.observers[evt].findIndex(ele => ele.target === target)
            if (idx === -1) {
                this.observers[evt].push({ callback, target })
            }
        }
        public readonly off = (evt: Events, target: any) => {
            const idx = this.observers[evt].findIndex(ele => ele.target === target)
            if (idx !== -1) {
                this.observers[evt].splice(idx, 1)
            }
        }
        public readonly stop = () => {
            if (this.socket.readyState === CLOSED ||
                this.socket.readyState === CLOSING) {
                return
            }
            this.socket.retryable = false
            this.socket.close(1000, 'user')
            this.ping.stop()
        }
        public readonly start = () => {
            if (!this.isLogin ||
                this.socket.isRetrying ||
                this.socket.readyState === OPEN ||
                this.socket.readyState === CONNECTING) {
                return
            }
            this.socket.retry.reset()
            this.socket.retryable = true
            this.socket.open()
            this.ping.start()
        }
    }
}
export namespace sys {
    export let debug: boolean = true
    /**
     * @description print info message when debug allow
     */
    export const log: (msg: any, ...args: any[]) => void = function () {
        if (sys.debug) {
            console.info.apply(console, arguments)
        }
    }
    /**
     * @description print wining message when debug allow
     */
    export const warn: (msg: any, ...args: any[]) => void = function () {
        if (sys.debug) {
            console.warn.apply(console, arguments)
        }
    }
    /**
     * @description call func safely 
     * @usually  use for call callback function
     * @param func target function
     * @param args the @param func 's args
     * @notice thirArg of @param func is undefined
     */
    export const call = function (func: Function, ...args: any[]) {
        if (typeof func === 'function') {
            func.apply(undefined, args)
        }
    }
    /**
     * @description check an value is an available string
     * @usually  use for form field verify
     * @notice only @param value is number or not empty string can pass
     * @param value witch to be verify
     */
    export const okstr = (value: any) => {
        const type = typeof value
        switch (type) {
            case 'string': return value.length !== 0
            case 'number': return true
            default: return false
        }
    }
    /**
     * @description check an value is an available integer
     * @usually  use for form field verify
     * @notice only @param value is integer like can pass
     * @param value witch to be verify
     */
    export const okint = (value: any) => {
        const type = typeof value
        switch (type) {
            case 'string': return /^\d+$/.test(value)
            case 'number': return Number.isInteger(value)
            default: return false
        }
    }
    /**
     * @description check an value is an available number
     * @usually  use for form field verify
     * @notice only @param value is number like can pass
     * @param value witch to be verify
     */
    export const oknum = (value: any) => {
        const type = typeof value
        switch (type) {
            case 'string': return /^\d+(\.\d+)?$/.test(value)
            case 'number': return true
            default: return false
        }
    }
}
export namespace orm {
    const FIELD_KEY = '__orm_field'
    const CLASS_KEY = '__orm_class'
    const INDEX_KEY = '__orm_index'
    const stored: any = {}
    function awake<T>(cls: IMetaClass<T>, json: any) {
        if (!json) return undefined
        const obj = new cls()
        Object.assign(obj, json)
        const fields = cls[FIELD_KEY]
        if (fields) {
            for (const field in fields) {
                const subjson = obj[field]
                if (!subjson) continue
                if (Array.isArray(subjson)) {
                    obj[field] = (subjson as any[]).map(json => {
                        return awake(fields[field], json)
                    })
                } else {
                    obj[field] = awake(fields[field], subjson)
                }
            }
        }
        return obj
    }
    function getClskey(cls: Function): string {
        const clskey = cls && cls[CLASS_KEY]
        if (!clskey) {
            throw new Error(`The Class:${cls.name} did\'t  mark with decorate @store(clsname,primary)`)
        }
        return clskey
    }
    function getIdxkey(cls: Function): string {
        const idxkey = cls && cls[INDEX_KEY]
        if (!idxkey) {
            throw new Error(`The privkey:${idxkey} of ${cls.name} is invalid!`)
        }
        return idxkey
    }
    function getObjkey(clskey: string, id: string | number) {
        if (!clskey || !id) return null
        return `${clskey}.${id}`
    }
    function getItem(key: string) {
        const str = localStorage.getItem(key)
        return str && JSON.parse(str)
    }
    function setItem(key: string, value: any) {
        const str = value && JSON.stringify(value)
        localStorage.setItem(key, str)
    }
    function removeItem(key: string) {
        localStorage.removeItem(key)
    }
    /**
     * @description  A class decorate use to store class.
     * @param clsname the class name of your storage class
     * @param primary the primary key name of your storage class
     */
    export const store = (clskey: string, idxkey: string) => {
        if (!sys.okstr(clskey)) {
            throw new Error(`The clskey:${clskey} invalid!`)
        }
        if (!sys.okstr(idxkey)) {
            throw new Error(`The privkey:${idxkey} invalid!`)
        }
        if (stored[clskey]) {
            throw new Error(`The clskey:${clskey} already exist!!You can't mark different class with same name!!`)
        }
        stored[clskey] = true
        return <T>(target: IMetaClass<T>) => {
            target[CLASS_KEY] = clskey
            target[INDEX_KEY] = idxkey
        }
    }
    /**
     * @description  A property decorate to mark a field  also a store class.
     * @param cls the class of field.
     */
    export const field = <T>(cls: IMetaClass<T>) => {
        return (target: Object, field: string) => {
            const fields = target.constructor[FIELD_KEY] || (target.constructor[FIELD_KEY] = {})
            fields[field] = cls
        }
    }
    /**
     * @description save an storage able class.
     * @param model the model class must be mark with @storage(...)
     * @throws did't mark error
     */
    export const save = <T>(model: T) => {
        if (!model) return
        const clskey = getClskey(model.constructor)
        const idxkey = getIdxkey(model.constructor)
        const objkey = getObjkey(clskey, model[idxkey])
        const keys: any = getItem(clskey) || {}
        keys[objkey] = ''
        setItem(clskey, keys)
        setItem(objkey, model)
    }
    /**
     * @description find an storaged object whith id.
     * @param cls the storage class witch must be mark with @storage(...)
     * @param id the primary key of the cls
     * @throws did't mark error
     */
    export const find = <T>(cls: IMetaClass<T>, id: string | number): T | undefined => {
        const clskey = getClskey(cls)
        const objkey = getObjkey(clskey, id)
        return awake(cls, getItem(objkey))
    }
    /**
     * @description find all storaged object's primary key of cls.
     * @param cls the storage class witch must be mark with @storage(...)
     * @throws did't mark error
     */
    export const ids = <T>(cls: IMetaClass<T>): string[] => {
        const clskey = getClskey(cls)
        const keys = getItem(clskey)
        return keys ? Object.keys(keys) : []
    }
    /**
     * @description find all storaged object of cls.
     * @param cls the storage class witch must be mark with @storage(...)
     * @throws did't mark error
     */
    export const all = <T>(cls: IMetaClass<T>): T[] => {
        const keys = ids(cls)
        const result: T[] = []
        for (const key of keys) {
            const obj = awake(cls, getItem(key))
            if (obj) {
                result.push(obj)
            }
        }
        return result;
    }

    /**
     * @description get the count of all storaged object of cls.
     * @param cls the storage class witch must be mark with @storage(...)
     * @throws did't mark error
     */
    export const count = <T>(cls: IMetaClass<T>) => {
        return ids(cls).length
    }
    /**
     * @description remove all storaged object of cls.
     * @param cls the storage class witch must be mark with @storage(...)
     * @throws did't mark error
     */
    export const clear = <T>(cls: IMetaClass<T>) => {
        const clskey = getClskey(cls)
        const keys = getItem(clskey)
        if (keys) {
            for (const key in keys) {
                removeItem(key)
            }
        }
        removeItem(clskey)
    }
    /**
     * @description remove an special storaged object of cls.
     * @param cls the storage class witch must be mark with @storage(...)
     * @param id the primary key of the cls
     * @throws did't mark error
     */
    export const remove = <T>(cls: IMetaClass<T>, id: string | number) => {
        const clskey = getClskey(cls)
        const objkey = getObjkey(clskey, id)
        const keys = getItem(clskey)
        if (keys && keys[objkey]) {
            delete keys[objkey]
            removeItem(objkey)
            setItem(clskey, keys)
        }
    }
}