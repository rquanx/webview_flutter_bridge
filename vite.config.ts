import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts"; // 引入 dts 插件

export default defineConfig({
  plugins: [
    dts({
      // 配置 dts 插件
      insertTypesEntry: true, // 在入口处插入类型定义
    }),
  ],
  build: {
    // sourcemap: true, // 可选：生成 sourcemap 便于调试，生产环境可关闭
    lib: {
      // 构建库的入口文件
      entry: resolve(__dirname, "src/index.ts"),
      // 暴露的全局变量名称 (当 format 为 'iife' 或 'umd' 时)
      name: "FlutterBridge", // **** 这里定义了全局变量名 window.FlutterBridge ****
      // 输出格式: 'es', 'cjs', 'umd', 'iife'
      // 'iife' 适用于 <script> 标签直接引入，会把所有代码包裹在一个立即执行函数中
      formats: ["iife"],
      // 输出的文件名 (不包含后缀)
      // format 参数是当前输出的格式 (例如 'iife')
      fileName: (format) => `flutter-bridge-sdk.${format}.js`,
    },
    rollupOptions: {
      // 我们不需要外部化任何依赖，因为要打成单文件
      external: [],
      output: {
        // 在 UMD 或 IIFE 构建模式下，为这些外部化的依赖提供一个全局变量（这里我们没有外部依赖）
        globals: {},
      },
    },
    // 输出目录 (相对于项目根目录)
    outDir: "dist",
  },
});
