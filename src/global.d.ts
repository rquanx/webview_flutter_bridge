import { FlutterBridgeSDK } from './index'
declare global {
    interface Window {
        FlutterBridge: typeof FlutterBridgeSDK;
        flutterBridge: FlutterBridgeSDK;
    }
}

