import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installUiZh } from "./ui-zh";
import "./styles.css";

// 让控制中心里未接入 i18n 的硬编码英文也显示为中文。仅在界面语言为中文时生效，
// 切回其他语言会自动还原；详见 ./ui-zh.ts。
installUiZh();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
