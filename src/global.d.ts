import { FlutterBridgeSDK } from './index'
declare global {
    interface Window {
        FlutterBridge: FlutterBridgeSDK;
    }
}
