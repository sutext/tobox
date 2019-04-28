#Start
```sh
    npm i tobox --save
```
#Netowrk
for netowrk.ts
```ts
import * as tobox from "tobox";
class Network extends tobox.Network {
    protected  method:'POST'|'GET' = 'POST'//config http method
    protected get headers() { //config http headers
        const header: any = {}
        if (session.isLogin) {
            header.token = session.token
        }
        return header
    }
    protected url(path: string) {//config url
        return "http://www.yourdom.com/xx/" + path
    }
    protected resolve(json: any) {//resolve response data
        console.log(json);

        if (!json.code) {
            throw new Error('服务异常')
        }
        if (json.code === Code.ok) {
            return json.data || null
        }
        if (json.code === Code.authFailed) {
            service.logout()
        }
        throw new Error(json.message || '系统错误')
    }
}
export const net = new Network()

```
for user.ts
```ts
import { net } from './network';
net.objtask(User, 'user/info', {id:'userid'})
    .then(user => {
        console.log(user)
    })
    .catch(e=>{
        console.log(e)
    })
```
#Socket
for socket.ts
```ts
import {Socket} from "tobox";
class Client extends Socket.Client {
    private observers: Set<{ (msg: any): void }> = new Set()
    protected pingInterval: number = 30//config heartbeat interval
    get url(): string {
        return "wss://" + env.host + "/socket/ws/customer?token=" + 'yourtoken'
    }
    get isDebug() {
        return env.isDebug
    }
    onError(e){

    }
    onClose(e){
        //TODO: your logic
    }
    onOpened(e){
        //TODO: your logic
    }
    onFailed(e){

    }
    onMessage(e){
        //TODO: your logic
        this.observers.forEach(ele=>ele.onMessage(e))
    }
}
```
for example.ts
```ts
    class App extends React.Component{
        public componentDidMount(){
            socket.start()
        }
        public onMessage(json: any, isOffline: boolean){
            console.log(json)
        }
    }
```

#storage
the storage apis is an simple orm implements by localstorage.
for model.ts
```ts
@orm.store('Asset', 'account')
export class Asset{
    public readonly account: string
    public readonly balance:number
    constructor(json?: any) {
        if (!json) {
            return
        }
        this.balance = json.balance || 0
    }
}
@orm.store('User', 'account')
export class User {
    public readonly account: string
    public readonly nickname: string
    public readonly avatar: string
    public readonly phone: string
    public readonly area: string
    @storage.field(Asset)
    public readonly asset: Asset
    constructor(json?: any) {
        if (!json) {
            return
        }
        Object.assign(this, json)
        this.asset = new Asset(json.asset)
    }
}
```
for other.ts
```ts
net.objtask(User, 'user/info', {account:'account'})
    .then(user => {
        storage.save(user)
    })
    .catch(e=>{
        console.log(e)
    })
const user = storage.find(User,'32132')
console.log(user)
const count = storage.count(User)
console.log(count)
const users = storage.all(User)
console.log(users)
```
