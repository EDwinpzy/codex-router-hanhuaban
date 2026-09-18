// 简体中文界面覆盖层。
//
// 背景：控制中心的大部分页面把英文文案直接写在 JSX 里，没有接入 `i18n.ts`
// 的 key 体系；网页面板（apps/panel）也有同样的情况。要把这些文案换成中文，
// 有两条路：
//
//   1. 把每一处硬编码改成 t("key") 调用——需要给几十个嵌套组件逐个注入翻译
//      函数，改动面极大，且每次上游仓库更新都会冲突；
//   2. 在渲染结果上做一层中文覆盖——不动任何组件代码。
//
// 这里采用第 2 条：一个精确匹配的英汉词典 + 一个 MutationObserver。
//
// 为什么是安全的：
//   * 只做「整个文本节点完全相等」的替换，绝不做子串替换，因此不会误伤模型名、
//     服务商名或用户数据；
//   * 写回之后再次扫描时，中文文本不会再命中词典，所以是幂等的，不会自我循环；
//   * 只在本机界面语言为 zh 时生效；切回其他语言会恢复原始英文；
//   * 原始文本保存在 WeakMap 里，可无损回滚。
//
// 专有名词（Codex Router、Ollama、LM Studio、DeepSeek Harness、Tokenizer、
// API、token、CLI 等）按约定保留原文。

type Rule = { pattern: RegExp; replace: (match: RegExpMatchArray) => string };

const D1: Record<string, string> = {
  "· measured here": "· 本地实测",
  "· subagent": "· 子代理",
  "A Codex terminal resume can keep the saved model or start the next turn with another enabled model.":
    "Codex 终端恢复会话时，可沿用已保存的模型，也可改用另一个已启用的模型开始下一轮。",
  "A local dependency needs attention.": "有本地依赖需要注意。",
  "A metered routed reply will establish the first model row.": "一次计费的已路由回复将建立首条模型记录。",
  "A provider is the account the router calls on your behalf. Connect one and its models appear here, ready to switch on.":
    "服务商是路由器代表你调用的账户。连接一个，它的模型就会出现在这里，可随时启用。",
  "A request has entered the router and is waiting for route metadata.": "有请求已进入路由器，正在等待路由元数据。",
  "A separate Apple-silicon runtime served through LM Studio and wired into the Codex proxy.":
    "通过 LM Studio 提供的独立 Apple 芯片运行时，已接入 Codex 代理。",
  "A successful metered reply with output tokens and duration will establish observed speed.":
    "一次带输出 token 数与耗时的计费成功回复，即可建立实测速度。",
  "A vision engine reads pasted images and returns quoted text.": "视觉引擎读取粘贴的图片，并返回引述文字。",
  "A vision engine reads pasted images and returns quoted text to models that cannot see.":
    "视觉引擎读取粘贴的图片，并把引述文字交给看不到图像的模型。",
  "Account 1/2": "账户 1/2",
  "Account activity": "账户活动",
  "Account graph": "账户图表",
  "Account history": "账户历史",
  "Account label (optional)": "账户名称（可选）",
  "Account lifetime": "账户累计",
  "Account meter": "账户计量",
  "Account switch pending": "账户切换待生效",
  "Account total": "账户总量",
  "Account usage is unavailable. Sign in again if the session expired.":
    "无法读取账户用量。若会话已过期，请重新登录。",
  "Account-reported · excluded from router total": "账户上报 · 不计入路由器总量",
  "Account-reported usage": "账户上报用量",
  "Accounts and allowances": "账户与配额",
  "Accumulated cached input tokens saved across the last 24 hours, 7 days, and 30 days.":
    "过去 24 小时、7 天与 30 天累计节省的缓存输入 token。",
  "across all retained events": "覆盖全部保留事件",
  "Across indexed sessions": "全部已索引会话",
  "Active context unreported": "活跃上下文未上报",
  "Activity pill": "活动胶囊",
  "Add a login to create its isolated account profile.": "添加一个登录，即可创建其独立账户配置。",
  "Add account": "添加账户",
  "Add API key": "添加 API 密钥",
  "Add ChatGPT subscription account": "添加 ChatGPT 订阅账户",
  "Add key": "添加密钥",
  "Add models": "添加模型",
  "Add models from a connected provider to fill this list.": "从已连接的服务商添加模型以填充此列表。",
  "Adding to Codex": "正在添加到 Codex",
  "Adding…": "添加中…",
  "After a metered reply": "计费回复之后",
  "Agents, speed, savings, requests": "代理、速度、节省、请求",
  "All clear": "一切正常",
  "All data": "全部数据",
  "all fit this machine": "均可在此机器运行",
  "All models": "全部模型",
  "All proven models": "全部已验证模型",
  "All providers": "全部服务商",
  "all retained": "全部保留",
  "All retained · router": "全部保留 · 路由器",
  "Allow a model larger than the router recommends for this machine": "允许使用超出本机推荐规格的模型",
  "Allowance and traffic": "配额与流量",
  "an API key": "一个 API 密钥",
  "Another local model operation is already in progress.": "另一个本地模型操作正在进行中。",
  "Another local-model change is running": "另一个本地模型变更正在运行",
  "API forwarder": "API 转发器",
  "API key": "API 密钥",
  "Appears after a metered reply": "计费回复后显示",
  "Apple silicon required": "需要 Apple 芯片",
  "Asking providers": "正在查询服务商",
  "At a glance": "一览",
  "Available to installed clients": "已安装客户端可使用",
  "Balances and local traffic do not imply a reset schedule.": "余额与本地流量不代表重置时间表。",
  "Breakdowns appear with the provider usage snapshot.": "明细会随服务商用量快照一同出现。",
  "Bridge disabled": "桥接已禁用",
  "Bridge enabled": "桥接已启用",
  "Bulk model actions": "批量模型操作",
  "By continuing, you consent to the runtime installation, model download, and local proxy publication.":
    "继续即表示你同意安装运行时、下载模型并发布本地代理。",
  "by requests": "按请求数",
  "by tokens": "按 token 数",
  "Cached context": "缓存上下文",
  "cached input": "缓存输入",
  "Cached input": "缓存输入",
  "Cached input divided by input tokens": "缓存输入 ÷ 输入 token",
  "Cached input is a subset of input, so it is shown as its own color and is not added a second time.":
    "缓存输入是输入的子集，因此单独用颜色标示，不重复计入。",
  "Cached input, recent 24h": "缓存输入，近 24 小时",
  "Cached tokens saved": "已节省缓存 token",
  "Cancel Qwen MLX installation": "取消 Qwen MLX 安装",
  "Catalogs could not be loaded": "无法加载目录",
  "Certification candidate": "认证候选",
  "Change image reader": "更改图片读取器",
  "Change image-reader effort": "更改图片读取器推理强度",
  "Change native result compaction": "更改原生结果压缩",
  "Change presence mode": "更改驻留模式",
  "Change retention window": "更改保留时长",
  "Change signed routing": "更改登录态路由",
  "Change Token maxxing": "更改 Token maxxing",
  "Change vision bridge": "更改视觉桥接",
  "Change vision effort": "更改视觉推理强度",
  "Change vision engine": "更改视觉引擎",
  "ChatGPT · measured by this router": "ChatGPT · 由本路由器实测",
  "ChatGPT account": "ChatGPT 账户",
  "ChatGPT account · reported by OpenAI": "ChatGPT 账户 · 由 OpenAI 上报",
  "ChatGPT account limit": "ChatGPT 账户上限",
  "ChatGPT account state unavailable": "无法读取 ChatGPT 账户状态",
  "ChatGPT accounts": "ChatGPT 账户",
  "ChatGPT has not published a daily bucket": "ChatGPT 未发布该日数据桶",
  "ChatGPT has not reported token usage for these dates.": "ChatGPT 未上报这些日期的 token 用量。",
  "ChatGPT login did not complete": "ChatGPT 登录未完成",
  "ChatGPT plan": "ChatGPT 方案",
  "ChatGPT session": "ChatGPT 会话",
  "check failed": "检查失败",
  "Checked but not currently served": "已勾选但当前未提供",
  "Checking router…": "正在检查路由器…",
  "Choose how text-only models read pasted images. Local readers stay on this machine.":
    "选择纯文本模型如何读取粘贴的图片。本地读取器只在本机运行。",
  "Choose which models your installed clients can use, and connect the accounts that serve them.":
    "选择已安装客户端可用的模型，并连接提供这些模型的服务账户。",
  "Clear a filter or include archived tasks.": "清除筛选条件，或包含已归档任务。",
  "Clear search": "清除搜索",
  "Clear the search or the filters, or add models from a connected provider.":
    "清除搜索或筛选条件，或从已连接的服务商添加模型。",
  "CLI detected": "已检测到 CLI",
  "Click Connect Cursor once, then authorize a domain in the browser. Setup resumes here automatically.":
    "点一次「连接 Cursor」，然后在浏览器中授权域名。设置会自动在这里继续。",
  "Client detection failed.": "客户端检测失败。",
  "Client detection is incomplete": "客户端检测未完成",
  "Client not detected": "未检测到客户端",
  "Close Codex completely. The selected login will be activated before the next launch.":
    "请完全关闭 Codex。所选登录将在下次启动前生效。",
  "Close dialog": "关闭对话框",
  "Close window": "关闭窗口",
  "cloud only": "仅云端",
  "Cloud only": "仅云端",
  "Codex can spawn subagents on this route.": "Codex 可在此路由上派生子代理。",
  "Codex login did not complete. Try again.": "Codex 登录未完成，请重试。",
  "Codex Router sidebar": "Codex Router 侧边栏",
  "Codex terminal model": "Codex 终端模型",
  "Codex, DeepSeek Harness, and Cursor continue to own their files, permissions, compaction, and credentials.":
    "Codex、DeepSeek Harness 与 Cursor 仍各自管理自己的文件、权限、压缩与凭据。",
  "Coding clients": "编码客户端",
  "Compaction savings date range": "压缩节省日期范围",
  "Compaction savings will appear after the router records its first eligible result.":
    "路由器记录首条符合条件的压缩结果后，节省量会显示在这里。",
  "Concurrent router work": "并发的路由器任务",
  "Configure Cursor": "配置 Cursor",
  "configured runtime": "已配置运行时",
  "Connect a provider": "连接服务商",
  "Connect a provider or sign in to ChatGPT, then refresh usage.":
    "连接一个服务商或登录 ChatGPT，然后刷新用量。",
  "Connect a provider that publishes a model catalog, then reload.":
    "连接一个提供模型目录的服务商，然后重新加载。",
  "Connect a provider to get started": "连接一个服务商即可开始",
  "Connect a provider to make a route available here.": "连接服务商后，这里才会出现可用路由。",
  "Connect a vision provider or download a local image reader.": "连接视觉服务商，或下载本地图片读取器。",
  "Connect Cursor": "连接 Cursor",
  "Connect provider": "连接服务商",
  "Connected provider": "已连接的服务商",
  "Connected providers": "已连接的服务商",
  "Connected providers have not served a metered request in the rolling window.":
    "在滚动时间窗内，已连接的服务商尚未处理过计费请求。",
  "Contacting the local health endpoint": "正在访问本地健康端点",
  "Context efficiency": "上下文效率",
  "Context reused": "上下文复用",
  "Context unreported": "上下文未上报",
  "Continuity keeps ownership intact": "连续性不改变归属",
  "Control center sections": "控制中心分区",
  "Credential ready. You can take it away from your clients without disconnecting the account.":
    "凭据已就绪。你可以在不断开账户的情况下从客户端收回它。",
  "Cross-harness history": "跨工具链历史",
  "Current streak": "当前连续天数",
  "Cursor public edge": "Cursor 公共边缘节点",
  "Cursor setup progress": "Cursor 设置进度",
  "Daily account": "每日账户",
  "Daily account tokens": "每日账户 token",
  "Daily bars use the retained provider ledger when available.":
    "每日柱状图在有数据时使用保留的服务商账本。",
  "daily limit": "每日上限",
  "Daily limit": "每日上限",
  "Daily local buckets from the retained router ledger. This is observed traffic, not provider billing.":
    "来自保留的路由器账本的每日本机数据桶。这是实测流量，并非服务商账单。",
  "Daily router": "每日路由器",
  "Daily router traffic": "每日路由器流量",
  "Dashboard traffic range": "总览流量范围",
  "Desktop app detected": "已检测到桌面应用",
  "Desktop bridge unavailable": "桌面桥接不可用",
  "Detecting coding clients": "正在检测编码客户端",
  "Disable desktop tray": "禁用桌面托盘",
  "Disable image transcription": "关闭图片转述",
  "Disconnect provider": "断开服务商",
  "Disconnect required": "需要断开连接",
  "Disconnect the incompatible router record before signing in again.":
    "请先断开不兼容的路由记录，再重新登录。",
  "Downloaded files are kept so a retry can resume without starting over.":
    "已下载的文件会保留，重试可从断点继续。",
  "Downloading 4-bit weights": "正在下载 4-bit 权重",
  "Downloading local reader": "正在下载本地读取器",
  "empty reply": "空回复",
  "Enable desktop tray": "启用桌面托盘",
  "Enable image transcription": "开启图片转述",
  "Enable or disable validated provider routes. Changes are saved atomically and shared with the tray.":
    "启用或禁用已验证的服务商路由。改动会原子保存并与托盘共享。",
  "Enable vision bridge": "启用视觉桥接",
  "Enabled models appear in Codex after the picker catalog refreshes.":
    "已启用的模型会在选择器目录刷新后出现在 Codex 中。",
  "Enter an Ollama tag or an HTTPS ollama.com model page. The runtime is installed only after this explicit action.":
    "输入 Ollama 标签或 HTTPS 的 ollama.com 模型页地址。只有执行此明确操作后才会安装运行时。",
  "Enter an Ollama tag or model-page URL.": "输入 Ollama 标签或模型页 URL。",
  "Enter credential": "输入凭据",
  "estimated input": "估算输入",
  "Expand sidebar": "展开侧边栏",
  "Expose every verified v2 model as a Codex subagent": "把所有已验证的 v2 模型暴露为 Codex 子代理",
  "External forwarders": "外部转发器",
  "External requests use the router while native ChatGPT task history stays available.":
    "外部请求走路由器，同时原生 ChatGPT 任务历史仍然可用。",
  "External runtime": "外部运行时",
  "Fastest observed output rates from successful requests, not synthetic benchmarks.":
    "成功请求中的最快实测输出速率，而非合成基准。",
  "fastest sample": "最快样本",
  "Filter models": "筛选模型",
  "Filter models by provider": "按服务商筛选模型",
  "Filter sessions by harness": "按工具链筛选会话",
  "Find and resume Codex, DeepSeek Harness, and Cursor sessions from one continuity view.":
    "在一个连续性视图中查找并恢复 Codex、DeepSeek Harness 与 Cursor 会话。",
  "fit unknown": "适配情况未知",
  "Fits this machine": "适配本机",
  "Fully quit and reopen Codex to refresh its model picker, then choose":
    "完全退出并重新打开 Codex 以刷新模型选择器，然后选择",
  "GitHub token": "GitHub 令牌",
  "Go back": "后退",
  "Go forward": "前进",
  "guard released": "保护已释放",
  "Health endpoint unavailable": "健康端点不可用",
  "Hide all": "全部隐藏",
  "Hide all router models": "隐藏全部路由器模型",
  "Hide tag guide": "隐藏标签说明",
  "Hourly bars use the router's full 24-hour rollup.": "每小时柱状图使用路由器完整的 24 小时汇总。",
  "Hourly local buckets from router request telemetry. This is observed traffic, not provider billing.":
    "来自路由器请求遥测的每小时本机数据桶。这是实测流量，并非服务商账单。",
  "If a credential also exists in the environment or Keychain, the router will still report it as connected.":
    "如果环境变量或 Keychain 中也存在凭据，路由器仍会将其报告为已连接。",
  "Image reader": "图片读取器",
  "Image reading": "图片读取",
  "In Codex": "已在 Codex 中",
  "In picker": "在选择器中",
  "In the picker": "在选择器中",
  "In use": "使用中",
  "Indexed metadata": "已索引元数据",
  "Input and output details were not reported for this day.": "该日期未上报输入与输出明细。",
  "Input and output details were not reported for this hour.": "该小时未上报输入与输出明细。",
  "Input observed": "已观测输入",
  "Input/cache split is not reported by every provider yet.": "目前并非所有服务商都上报输入／缓存拆分。",
  "Install a model": "安装模型",
  "Install an Ollama model below. Progress remains visible while the download runs.":
    "在下方安装一个 Ollama 模型。下载期间进度会持续显示。",
  "Install and add to Codex": "安装并添加到 Codex",
  "Install Cloudflare connector": "安装 Cloudflare 连接器",
  "Installed models": "已安装模型",
  "Installing local model": "正在安装本地模型",
  "it failed": "失败",
  "Keep native ChatGPT transport and task history": "保留原生 ChatGPT 传输与任务历史",
  "keep retained originals forever": "永久保留原始结果",
  "Keep session model": "保持会话模型",
  "Keep the native ChatGPT transport in place.": "保留原生 ChatGPT 传输方式不变。",
  "Keep the Windows tray visible": "保持 Windows 托盘可见",
  "Key or sign-in": "密钥或登录",
  "Last 24 hours": "过去 24 小时",
  "Last 24 hours · router": "过去 24 小时 · 路由器",
  "last 24h": "近 24 小时",
  "Last 7 days": "过去 7 天",
  "Last 7 days · OpenAI": "过去 7 天 · OpenAI",
  "Last reported day": "最近上报日期",
  "Lifetime usage unreported": "累计用量未上报",
  "Live now": "正在运行",
  "Live operations": "实时操作",
  "Live requests": "实时请求",
  "Live router": "实时路由器",
  "Live router requests": "实时路由器请求",
  "Live test required": "需要实时测试",
  "Live work from the local health endpoint, grouped by chat and named agent.":
    "来自本地健康端点的实时任务，按会话与命名代理分组。",
  "Load local sessions and publish the same routed model catalog into each coding client.":
    "加载本地会话，并把同一份已路由模型目录发布到各编码客户端。",
  "Loading account allowances": "正在加载账户配额",
  "Loading account and router usage": "正在加载账户与路由器用量",
  "Loading catalogs": "正在加载目录",
  "Loading content": "正在加载内容",
  "Loading context efficiency": "正在加载上下文效率",
  "Loading into MLX": "正在载入 MLX",
  "Loading live router activity": "正在加载实时路由器活动",
  "Loading local model runtime": "正在加载本地模型运行时",
  "Loading local models": "正在加载本地模型",
  "Loading model routes": "正在加载模型路由",
  "Loading model speed": "正在加载模型速度",
  "Loading model usage": "正在加载模型用量",
  "Loading models": "正在加载模型",
  "Loading provider and model usage": "正在加载服务商与模型用量",
  "Loading provider catalog": "正在加载服务商目录",
  "Loading provider catalogs": "正在加载服务商目录",
  "Loading provider connections": "正在加载服务商连接",
  "Loading provider routes": "正在加载服务商路由",
  "Loading quota resets": "正在加载配额重置",
  "Loading recent router activity": "正在加载最近的路由器活动",
  "Loading retained token activity": "正在加载保留的 token 活动",
  "Loading router data": "正在加载路由器数据",
  "Loading router traffic": "正在加载路由器流量",
  "Loading service health": "正在加载服务健康",
  "Loading task history": "正在加载任务历史",
  "Local health endpoint": "本地健康端点",
  "Local LLMs": "本地大模型",
  "Local model": "本地模型",
  "Local model download cancelled": "已取消本地模型下载",
  "Local model for pasted-image transcription.": "用于粘贴图片转写的本地模型。",
  "Local model removal cancelled": "已取消本地模型删除",
  "Local model removal failed": "本地模型删除失败",
  "Local model removed": "已删除本地模型",
  "Local project roots": "本地项目根目录",
  "Local router totals and account-reported history are shown separately.":
    "本地路由器总量与账户上报历史分开显示。",
  "Local runtime": "本地运行时",
  "Local runtime unavailable": "本地运行时不可用",
  "Local server running · models are managed in LM Studio": "本地服务运行中 · 模型由 LM Studio 管理",
  "Local traffic remains available without estimating a quota.": "无需估算配额即可查看本地流量。",
  "Local vision model selected.": "已选择本地视觉模型。",
  "Location managed by Ollama": "位置由 Ollama 管理",
  "Loopback only": "仅环回",
  "Lowest allowance": "最低配额",
};

const D2: Record<string, string> = {
  "Machine capacity has not been measured yet.": "尚未测量本机性能上限。",
  "Maintenance failed": "维护失败",
  "Manage models": "管理模型",
  "Managed by the environment": "由环境变量管理",
  "Managed catalog": "托管目录",
  "Maximize or restore window": "最大化或还原窗口",
  "Memory tight": "内存紧张",
  "Minimize window": "最小化窗口",
  "MLX installation cancelled": "已取消 MLX 安装",
  "MLX installation stopped": "MLX 安装已停止",
  "MLX prerequisites": "MLX 前置条件",
  "MLX setup": "MLX 设置",
  "Model breakdown": "模型明细",
  "Model id": "模型 ID",
  "Model not indexed": "模型未索引",
  "Model picker": "模型选择器",
  "Model provider": "模型服务商",
  "Model speed": "模型速度",
  "Model storage": "模型存储",
  "Model tag or Ollama URL": "模型标签或 Ollama URL",
  "Model usage": "模型用量",
  "Models hidden here stay connected but are not offered by Codex.":
    "在此隐藏的模型仍保持连接，但不会在 Codex 中提供。",
  "Models path": "模型路径",
  "Models used": "已使用模型",
  "Models, 90-day ledger": "模型，90 天账本",
  "Models, last 24 hours": "模型，过去 24 小时",
  "More model actions": "更多模型操作",
  "Named subagents currently in flight": "当前进行中的命名子代理",
  "Native GPT plus external models · task history preserved": "原生 GPT 加外部模型 · 保留任务历史",
  "Needs a provider": "需要服务商",
  "Needs attention": "需要注意",
  "Needs the Command Code Provider plan": "需要 Command Code Provider 方案",
  "New account": "新账户",
  "New ChatGPT account label": "新 ChatGPT 账户名称",
  "Next quota reset": "下次配额重置",
  "No account meter available": "无可用账户计量",
  "No API key is required. Make it available before routed prompts or catalog loading can use its endpoint.":
    "无需 API 密钥。请先使其可用，路由提示与目录加载才能使用其端点。",
  "No cache detail": "无缓存明细",
  "No catalog model matches this search.": "没有匹配此搜索的目录模型。",
  "No catalogs available": "无可用目录",
  "No connected account exposed a reset timestamp": "没有已连接账户提供重置时间",
  "No connected account reports a remaining share": "没有已连接账户上报剩余配额",
  "No context reuse telemetry": "无上下文复用遥测",
  "No data": "无数据",
  "No duration": "无耗时",
  "no engine": "无引擎",
  "No external forwarders enabled": "未启用外部转发器",
  "No key needed": "无需密钥",
  "No local image readers listed": "未列出本地图片读取器",
  "No local model operation is running.": "没有正在运行的本地模型操作。",
  "No local models installed": "未安装本地模型",
  "no local variant fits": "无适配的本地变体",
  "No matching sections": "无匹配分区",
  "No measured activity yet": "尚无实测活动",
  "No metered provider traffic": "无计费服务商流量",
  "No model observed": "未观测到模型",
  "No model traffic": "无模型流量",
  "No model traffic available": "无可用模型流量",
  "No model usage yet": "尚无模型用量",
  "No models match": "无匹配模型",
  "No Ollama tags match": "无匹配的 Ollama 标签",
  "No provider or event reports a rolling 24-hour window": "没有服务商或事件上报滚动 24 小时窗口",
  "No provider routes": "无服务商路由",
  "No reader available": "无可用读取器",
  "No recent router traffic": "最近无路由器流量",
  "No reset reported": "未上报重置时间",
  "No reset times reported": "未上报重置时间",
  "No reset timestamp exposed": "未提供重置时间",
  "no retention": "不保留",
  "No saved ChatGPT accounts": "没有已保存的 ChatGPT 账户",
  "No sessions match": "无匹配会话",
  "No speed samples yet": "尚无速度样本",
  "no status": "无状态",
  "No status": "无状态",
  "No token usage reported": "未上报 token 用量",
  "No token usage was observed by the local router for these dates.":
    "本地路由器在这些日期未观测到 token 用量。",
  "no traffic": "无流量",
  "No traffic in this range": "该范围内无流量",
  "No usage sources available": "无可用用量来源",
  "Not detected": "未检测到",
  "Not enabled": "未启用",
  "Not installed": "未安装",
  "Not measured": "未测量",
  "Not published": "未发布",
  "Not reported": "未上报",
  "not running": "未运行",
  "Not running · start LM Studio's local server to list its models":
    "未运行 · 启动 LM Studio 的本地服务以列出其模型",
  "not started": "未启动",
  "Not yet supported": "暂不支持",
  "OAuth forwarder": "OAuth 转发器",
  "Observed traffic, token mix, and output speed across connected providers.":
    "跨已连接服务商的实测流量、token 构成与输出速度。",
  "Off · text-only models refuse pasted images": "关闭 · 纯文本模型会拒绝粘贴的图片",
  "Official quota windows and balances for every connected account.": "每个已连接账户的官方配额窗口与余额。",
  "Official-client agent": "官方客户端代理",
  "Ollama default": "Ollama 默认",
  "Ollama is not running": "Ollama 未运行",
  "Ollama is ready": "Ollama 已就绪",
  "Ollama updated. Its headless server will be reused for local models.":
    "Ollama 已更新。其无头服务将被本地模型复用。",
  "On-device inference": "本机推理",
  "One index, separate stores": "统一索引，各自存储",
  "Only connected providers appear in Usage.": "只有已连接的服务商才会出现在用量中。",
  "Open app": "打开应用",
  "Open sign-in": "打开登录",
  "Open Status": "打开状态",
  "Open the provider CLI in your own terminal on Windows or Linux.":
    "在 Windows 或 Linux 上，请在你自己的终端中打开服务商 CLI。",
  "Open this session in its owning Cursor app first.": "请先在所属的 Cursor 应用中打开此会话。",
  "Open this window through the Codex Router desktop app to read live router data.":
    "请通过 Codex Router 桌面应用打开此窗口，以读取实时路由器数据。",
  "Open Usage": "打开用量",
  "OpenAI native": "OpenAI 原生",
  "Optional delegated runs use the official client's own login and never add subscription models to the router catalog.":
    "可选的委派运行使用官方客户端自己的登录，绝不会把订阅模型加入路由器目录。",
  "Optional. Leave blank to create one under the domain you authorize.":
    "可选。留空将在你授权的域名下创建一个。",
  "Paste credential": "粘贴凭据",
  "Peak day": "峰值日",
  "Preparing Cursor setup…": "正在准备 Cursor 设置…",
  "Preparing download": "正在准备下载",
  "primary limit": "主要上限",
  "Primary limit": "主要上限",
  "Privacy-safe events from the recent 24-hour telemetry window.": "来自最近 24 小时遥测窗口的隐私安全事件。",
  "Provider and model mix": "服务商与模型构成",
  "Provider catalog could not be loaded.": "无法加载服务商目录。",
  "Provider catalog models": "服务商目录模型",
  "Provider connections": "服务商连接",
  "Provider routes": "服务商路由",
  "Provider usage unavailable": "服务商用量不可用",
  "Providers you can connect": "可连接的服务商",
  "Quick picks": "快捷选择",
  "Quota reset": "配额重置",
  "Quota resets": "配额重置",
  "Read pasted images": "读取粘贴的图片",
  "Read-only facts reported by the router and Ollama.": "路由器与 Ollama 上报的只读信息。",
  "Reader default": "读取器默认",
  "Reader resolved": "读取器已解析",
  "Reading providers": "正在读取服务商",
  "Reading router telemetry": "正在读取路由器遥测",
  "Reading the retained router ledger": "正在读取保留的路由器账本",
  "Ready after setup": "设置完成后就绪",
  "Ready for routed requests": "已就绪，可处理路由请求",
  "Ready in Codex": "已在 Codex 中就绪",
  "Reasoning effort": "推理强度",
  "Recent activity": "最近活动",
  "Recent requests appear once the router snapshot loads.": "路由器快照加载后，最近请求会显示在这里。",
  "Recent routed events have not reported cached input tokens.": "最近的路由事件未上报缓存输入 token。",
  "Recent router activity": "最近的路由器活动",
  "Refresh after Ollama and the local vision catalog are available.": "待 Ollama 与本地视觉目录可用后刷新。",
  "Refresh after the provider usage snapshot becomes available.": "待服务商用量快照可用后刷新。",
  "Refresh all data": "刷新全部数据",
  "refresh due": "需要刷新",
  "Refresh due": "需要刷新",
  "Refreshing Cursor setup…": "正在刷新 Cursor 设置…",
  "regular input": "常规输入",
  "Regular input": "常规输入",
  "Removal failed": "删除失败",
  "Remove account": "移除账户",
  "Remove API key": "移除 API 密钥",
  "Remove ChatGPT subscription account": "移除 ChatGPT 订阅账户",
  "Remove ChatGPT subscription account?": "移除 ChatGPT 订阅账户？",
  "Remove connection": "移除连接",
  "Remove key": "移除密钥",
  "Remove local model": "删除本地模型",
  "Repair and reconnect": "修复并重新连接",
  "Repair completed and the installation was verified.": "修复完成，安装已通过验证。",
  "Repair finished with failing checks.": "修复已执行，但仍有检查未通过。",
  "Repair installation": "修复安装",
  "Repair needed": "需要修复",
  "Replace key": "更换密钥",
  "Reported by OpenAI": "由 OpenAI 上报",
  "Reported prefix-cache reuse, summed across routed requests.": "已上报的前缀缓存复用，按路由请求汇总。",
  "Request is starting": "请求正在开始",
  "Request metadata only. Prompts and responses are never shown here.":
    "仅请求元数据。提示与回复绝不在此显示。",
  "Request volume": "请求量",
  "Requires an active ClinePass subscription": "需要有效的 ClinePass 订阅",
  "Requires Copilot access": "需要 Copilot 访问权限",
  "Reset timestamps from ChatGPT and connected provider account APIs.":
    "来自 ChatGPT 与已连接服务商账户 API 的重置时间。",
  "Restart desktop tray": "重启桌面托盘",
  "Resume behavior": "恢复行为",
  "retried empty": "重试仍为空",
  "Retry install": "重试安装",
  "Reuse share": "复用占比",
  "rolling 24h": "滚动 24 小时",
  "Rolling router window unavailable": "滚动路由器窗口不可用",
  "Route disabled": "路由已禁用",
  "Route enabled": "路由已启用",
  "Routed models": "已路由模型",
  "Routed request": "已路由请求",
  "Router activity": "路由器活动",
  "Router and local dependencies.": "路由器与本地依赖。",
  "Router health check failed": "路由器健康检查失败",
  "Router health has not been read": "尚未读取路由器健康状态",
  "Router is idle": "路由器空闲",
  "Router managed": "由路由器管理",
  "Router offline": "路由器离线",
  "Router online": "路由器在线",
  "Router ready": "路由器就绪",
  "Router service health": "路由器服务健康",
  "Router snapshot unavailable": "路由器快照不可用",
  "Router state": "路由器状态",
  "Router summary": "路由器摘要",
  "Router telemetry unavailable": "路由器遥测不可用",
  "Router traffic for the last 24 hours: not measured.": "过去 24 小时的路由器流量：未测量。",
  "Router unavailable": "路由器不可用",
  "Run live test": "运行实时测试",
  "Run models locally through Ollama. Installed models remain on this machine.":
    "通过 Ollama 在本机运行模型。已安装模型保留在此机器上。",
  "Run the official provider sign-in command in your own terminal, then refresh this page.":
    "请在你自己的终端中运行官方的服务商登录命令，然后刷新此页面。",
  "Run, install, measure, and expose Ollama and curated MLX models without leaving the control center.":
    "无需离开控制中心，即可运行、安装、测量并公开 Ollama 与精选 MLX 模型。",
  "Running agents": "运行中的代理",
  "Running chats": "运行中的会话",
  "Running chats and named subagents will appear here as they route work.":
    "运行中的会话与命名子代理在路由任务时会显示在这里。",
  "Running chats, agents, model throughput, context reuse, request activity, and quota timing.":
    "运行中的会话与代理、模型吞吐、上下文复用、请求活动与配额时序。",
  "Runs on this machine": "在此机器上运行",
  "Runtime details": "运行时详情",
};

// 常用短标签。这些词在多个页面以纯文本节点出现，且应用自身没有接入 i18n。
const D3: Record<string, string> = {
  "Add": "添加",
  "All": "全部",
  "Always": "始终运行",
  "Anyway": "仍然继续",
  "Apply": "应用",
  "Auto": "自动",
  "Auto-retry": "自动重试",
  "Back": "返回",
  "Checking": "检查中",
  "Clear": "清除",
  "Close": "关闭",
  "Connections": "连接",
  "Copy": "复制",
  "Dashboard": "总览",
  "Delete": "删除",
  "Disable": "禁用",
  "Disabled": "已禁用",
  "Disconnect": "断开",
  "Done": "完成",
  "Download": "下载",
  "Downloading": "下载中",
  "Enabled": "已启用",
  "Experimental": "实验性",
  "Harness": "工具链",
  "Idle": "空闲",
  "In use": "使用中",
  "Install": "安装",
  "Installing": "安装中",
  "Language": "语言",
  "Light": "浅色",
  "Loading": "加载中",
  "Local": "本地",
  "Next": "下一步",
  "None": "无",
  "Off": "关闭",
  "On": "开启",
  "Open": "打开",
  "Refresh": "刷新",
  "Remove": "移除",
  "Restart": "重启",
  "Retry": "重试",
  "Save": "保存",
  "Save key": "保存密钥",
  "Search": "搜索",
  "Settings": "设置",
  "Start": "启动",
  "Status": "状态",
  "Stop": "停止",
  "Today": "今天",
  "Toggle": "切换",
  "Unavailable": "不可用",
  "Uninstall": "卸载",
  "Update": "更新",
  "Updating": "更新中",
  "Usage": "用量",
  "Use image": "使用图像",
  "Verified": "已验证",
  "Verifying": "校验中",
  "Waiting": "等待中",
  "Text + image": "文本 + 图像",
  "s used": "秒已用",
  "Timeout": "超时",
  "Unknown": "未知",
  "Yes": "是",
  "No": "否",
  "The electron bridge is unavailable. Open this UI through the Codex Router desktop app.":
    "Electron 桥接不可用。请通过 Codex Router 桌面应用打开此界面。",
  "The account usage report failed.": "账户用量读取失败。",
  "The aggregate is not reported because at least one provider is missing a counter.":
    "由于至少有一个服务商缺少计数器，无法上报汇总值。",
  "The chart will fill as a request passes through the local router.":
    "当请求经过本地路由器时，图表会逐渐填充。",
  "The credential is sent directly to the local router over standard input. It is never shown again.":
    "凭据通过标准输入直接发送给本地路由器，之后不会再显示。",
  "The Electron bridge is unavailable. Open this UI through the Codex Router desktop app.":
    "Electron 桥接不可用。请通过 Codex Router 桌面应用打开此界面。",
  "The index reads bounded metadata only. Conversation messages stay inside each coding client.":
    "索引只读取限定范围的元数据。对话消息保留在各编码客户端内部。",
  "The installer reported an unknown error. Retry or review the prerequisite hints above.":
    "安装程序报告了未知错误。请重试或查看上方的前置条件提示。",
  "the last 24 hours": "过去 24 小时",
  "The last few routed requests from the rolling 24-hour telemetry window, with output speed and token mix when reported.":
    "滚动 24 小时遥测窗口中的最近几条路由请求，并附上报的输出速度与 token 构成。",
  "the local day of the same name": "同名的本地日期",
  "The local health endpoint did not answer": "本地健康端点无响应",
  "The local model tag is missing. Refresh the panel and try again.": "缺少本地模型标签。请刷新面板后重试。",
  "The official CLI will be installed, then sign-in will open in your system terminal.":
    "将先安装官方 CLI，然后在系统终端中打开登录。",
  "The provider is withdrawn from installed clients before its managed credential is deleted.":
    "在删除受管凭据之前，会先把该服务商从已安装客户端中撤下。",
  "The router operation did not finish.": "路由器操作未完成。",
  "The same model reaches you through more than one account. Each one has its own credential, quota, and pricing.":
    "同一个模型可通过多个账户访问。每个账户都有自己的凭据、配额与价格。",
  "The secret is sent once to the router's hidden standard-input prompt. It is never added to a command.":
    "密钥只发送一次到路由器隐藏的标准输入提示符，绝不会写入命令行。",
  "The selected reader runs only when the target model cannot accept images.":
    "只有当目标模型无法接受图像时，才会使用所选的读取器。",
  "The stored key is deleted from this Mac and the provider is hidden from Codex. You can add a new key at any time.":
    "已存储的密钥将从本机删除，该服务商也会在 Codex 中隐藏。你可随时添加新密钥。",
  "The upstream response did not include token counts.": "上游响应未包含 token 计数。",
  "The value is not placed in logs, command arguments, localStorage, or saved renderer state.":
    "该值不会写入日志、命令行参数、localStorage 或已保存的渲染层状态。",
  "The vision model download failed.": "视觉模型下载失败。",
  "This affects terminal resumes only. Desktop tasks keep their own model state.":
    "这仅影响终端会话恢复。桌面任务保留各自的模型状态。",
  "This deletes the model weights from this machine.": "这将从此机器删除模型权重。",
  "This install's router is not reporting a rolling 24-hour window, so the figure is missing rather than zero.":
    "本次安装的路由器未上报滚动 24 小时窗口，因此数值缺失而非为零。",
  "This is live local Codex traffic and is separate from ChatGPT's calendar-day account rollup.":
    "这是实时的本地 Codex 流量，与 ChatGPT 按自然日的账户汇总相互独立。",
  "This list fills after a request passes through the local router.": "当请求经过本地路由器后，此列表会填充。",
  "This MLX model can only be installed on a supported Apple-silicon Mac.":
    "此 MLX 模型只能安装在受支持的 Apple 芯片 Mac 上。",
  "This provider catalog is managed by the router and has no separate credential action here.":
    "此服务商目录由路由器管理，此处没有单独的凭据操作。",
  "This revokes the pool entry and deletes its isolated Codex login profile.":
    "这将撤销该池条目并删除其独立的 Codex 登录配置。",
  "This router · all providers": "本路由器 · 全部服务商",
  "This router build does not report live activity": "此路由器版本不上报实时活动",
  "This router snapshot did not report an input/cache/output split for the selected range.":
    "此路由器快照未上报所选范围内的输入／缓存／输出拆分。",
  "This router total": "本路由器总量",
  "This router total is the sum of every measured provider row.": "本路由器总量为所有已测量服务商行之和。",
  "time unavailable": "时间不可用",
  "Time unavailable": "时间不可用",
  "Titles and timestamps come from bounded client indexes. Conversation messages are never returned to this view.":
    "标题与时间戳来自限定范围的客户端索引。对话消息绝不返回给此视图。",
  "to Codex.": "至 Codex。",
  "Toggle Token maxxing for external models": "为外部模型切换 Token maxxing",
  "Token activity": "Token 活动",
  "Token activity display": "Token 活动显示",
  "Token activity intensity from less to more": "Token 活动强度，由低到高",
  "Token count not reported": "未上报 token 计数",
  "Token count not reported.": "未上报 token 计数。",
  "Token history appears after the router reports usage": "路由器上报用量后，token 历史会显示",
  "Token key": "Token 密钥",
  "Tokens removed from old tool results before the next upstream request.":
    "在下次上游请求前，从旧工具结果中移除的 token。",
  "Tokens, last 24h": "Token，近 24 小时",
  "Too large": "过大",
  "Tool-result compaction savings": "工具结果压缩节省",
  "Top-center live activity": "顶部中央实时活动",
  "Traffic appears once the router snapshot loads.": "路由器快照加载后，流量会显示在这里。",
  "Tray will follow Codex presence.": "托盘将跟随 Codex 的存在状态。",
  "Tray will stay visible.": "托盘将保持可见。",
  "Try a family name, size, or exact tag.": "试试系列名、规格或精确标签。",
  "Try a model name, slug, or provider.": "试试模型名、标识或服务商。",
  "Try a section name or what you want to manage.": "试试分区名称，或你想管理的内容。",
  "Turn all off": "全部关闭",
  "Turn all on": "全部开启",
  "unattributed tokens": "未归属 token",
  "Uninstalling local model": "正在删除本地模型",
  "Unique active sessions": "唯一活跃会话",
  "Unknown model": "未知模型",
  "Unselect all": "全部取消勾选",
  "Unsupported host": "不支持的主机",
  "Update installed clients": "更新已安装客户端",
  "Update local runtime": "更新本地运行时",
  "Update Ollama": "更新 Ollama",
  "Update the checkout and verify its installation.": "更新代码检出并验证其安装。",
  "Updated and verified.": "已更新并验证。",
  "Updated and verified. Restart Codex to load the refreshed catalog.":
    "已更新并验证。重启 Codex 以加载刷新后的目录。",
  "Usage date range": "用量日期范围",
  "Usage limit": "用量上限",
  "Usage overview": "用量概览",
  "Usage range": "用量范围",
  "Usage source": "用量来源",
  "Usage sources": "用量来源",
  "Usage unavailable": "用量不可用",
  "Use all proven v2 models as subagents": "使用全部已验证的 v2 模型作为子代理",
  "Use an existing Cloudflare hostname": "使用现有的 Cloudflare 主机名",
  "Use Codex without OpenAI login": "无需 OpenAI 登录即可使用 Codex",
  "Use connected external models in new Codex sessions": "在新的 Codex 会话中使用已连接的外部模型",
  "Use reader": "使用读取器",
  "Using image": "正在使用图像",
  "Uses the signed-in ChatGPT session available to this Codex installation.":
    "使用此 Codex 安装可用的已登录 ChatGPT 会话。",
  "Using this router": "正在使用本路由器",
  "v1 only": "仅 v1",
  "Verifying model": "正在校验模型",
  "Vision bridge": "视觉桥接",
  "Vision bridge disabled.": "视觉桥接已禁用。",
  "Vision bridge enabled for pasted images.": "已为粘贴的图片启用视觉桥接。",
  "Vision effort": "视觉推理强度",
  "Vision effort reset to model default.": "视觉推理强度已重置为模型默认。",
  "Vision engine": "视觉引擎",
  "Vision engine selected.": "已选择视觉引擎。",
  "Wait for the Ollama download or removal to finish before starting MLX setup.":
    "请先等待 Ollama 下载或删除完成，再开始 MLX 设置。",
  "Waiting for a cache window": "正在等待缓存窗口",
  "Waiting for account and provider usage": "正在等待账户与服务商用量",
  "Waiting for activity.": "正在等待活动。",
  "Waiting for health report": "正在等待健康报告",
  "Waiting for router usage telemetry": "正在等待路由器用量遥测",
  "Waiting for setup": "正在等待设置",
  "Waiting for the first health response": "正在等待首次健康响应",
  "weekly limit": "每周上限",
  "Weekly limit": "每周上限",
  "What do these tags mean?": "这些标签是什么意思？",
  "won’t fit": "不适配",
  "Working in the background": "正在后台运行",
  "Workspace not indexed": "工作区未索引",
};

// 实测面板与页面后补上的一批（含 index.html 里没有 data-i18n 的静态节点）。
const D4: Record<string, string> = {
  "Account-reported": "账户上报",
  "Available": "可用",
  "Connect a provider to add models": "连接服务商以添加模型",
  "Context Manager": "上下文管理",
  "Discover Ollama": "发现 Ollama",
  "Effort": "推理强度",
  "Engine": "引擎",
  "Experimental features": "实验性功能",
  "Fix": "修复",
  "Interface language": "界面语言",
  "Keys are not interchangeable with the global platform: create this one at platform.moonshot.cn.":
    "密钥与全球平台不通用：请在 platform.moonshot.cn 创建这一把。",
  "Last 7 days · OpenAI": "过去 7 天 · OpenAI",
  "Loading…": "加载中…",
  "Local image readers": "本地图片读取器",
  "Model default": "模型默认",
  "Nothing in flight.": "没有进行中的请求。",
  "On-device": "本机",
  "Optional": "可选",
  "Prerequisites": "前置条件",
  "Providers, credentials, and catalog": "服务商、凭据与目录",
  "Quotas, balance, traffic": "配额、余额、流量",
  "Read images for text-only models": "为纯文本模型读取图片",
  "Required": "必需",
  "Router at a glance": "路由器一览",
  "Last": "最近",
  "Ready": "就绪",
  "Reachable": "可连接",
  "Speed": "速度",
  "Standby": "待机",
  "cloud": "云端",
  "none": "无",
  "tokens": "token",
  "Unknown": "未知",
  "Total": "合计",
  "Routing and desktop": "路由与桌面",
  "Runtime and on-device models": "运行时与本机模型",
  "Service health": "服务健康",
  "Serving locally": "本地提供中",
  "Sessions across harnesses": "跨工具链会话",
  "Show tray": "显示托盘",
  "today": "今天",
  "Unreachable": "无法连接",
  "Update the checkout and verify its installation": "更新代码检出并验证其安装",
  "Use Router with ChatGPT": "在 ChatGPT 下使用路由器",
  "weekly": "本周",
  "With Codex": "跟随 Codex",
  "— tok/s": "— tok/s",
};

// 应用自身 i18n 拼出来的「中文紧贴拉丁字母」串，只补空格，不改语义。
const D5: Record<string, string> = {
  "已连接API 密钥": "已连接 API 密钥",
  "已连接Per-model endpoints": "已连接 Per-model endpoints",
  "已连接无需 API 密钥": "已连接 · 无需 API 密钥",
  "未连接API 密钥": "未连接 API 密钥",
  "未连接GitHub 令牌": "未连接 GitHub 令牌",
  "未连接OAuth": "未连接 OAuth",
  "未连接Per-model endpoints": "未连接 Per-model endpoints",
  "替换 Per-model endpoints": "替换 Per-model endpoints",
  "已连接OAuth": "已连接 OAuth",
  "已连接GitHub 令牌": "已连接 GitHub 令牌",
};

// 实测各页面后补的短标签与整句说明。
const D6: Record<string, string> = {
  "A model appears after it serves a request with usage metadata.":
    "模型在完成一次带用量元数据的请求后才会出现。",
  "Actions": "操作",
  "Anthropic's coding agent using every model selected in this router.":
    "Anthropic 的编码代理，使用本路由器中选定的全部模型。",
  "API traffic measured by this router": "由本路由器实测的 API 流量",
  "Automatic": "自动",
  "Client": "客户端",
  "Clients": "客户端",
  "Command Code's CLI as a BYOK client of this router's Anthropic surface.":
    "Command Code 的 CLI，作为本路由器 Anthropic 接口的 BYOK 客户端。",
  "Configured": "已配置",
  "Cumulative": "累计",
  "Daily": "每日",
  "Details": "详情",
  "Enable": "启用",
  "Grok OAuth forwarder": "Grok OAuth 转发器",
  "Last 90 days · router": "过去 90 天 · 路由器",
  "Last 90 days · router · cache excluded": "过去 90 天 · 路由器 · 不含缓存",
  "Last 90 days · router · included in input": "过去 90 天 · 路由器 · 已计入输入",
  "Last 90 days · router · not this range": "过去 90 天 · 路由器 · 不在本范围",
  "Less": "更少",
  "live": "实时",
  "Models": "模型",
  "More": "更多",
  "No compactions in this window.": "此窗口内无压缩记录。",
  "No requests in the last 24 hours": "过去 24 小时无请求",
  "Online": "在线",
  "Output": "输出",
  "Overview": "概览",
  "Plus plan": "Plus 方案",
  "Plus plan · account-level usage as OpenAI reports it; this view is not added to the all-router total":
    "Plus 方案 · 账户级用量，以 OpenAI 上报为准；此视图不计入全路由器总量",
  "Provider": "服务商",
  "Providers": "服务商",
  "reachable": "可连接",
  "Requests": "请求",
  "Rolling": "滚动",
  "Rolling provider totals and the busiest models on this router; model rows include 24-hour input, cache, output, and speed.":
    "滚动统计的各服务商总量与本路由器最繁忙的模型；模型行包含 24 小时输入、缓存、输出与速度。",
  "Same subscription OpenAI reports below, counted here across 90-day router events; the two totals are not comparable":
    "与下方 OpenAI 上报的同一订阅，此处按 90 天路由器事件统计；两个总量不可直接比较",
  "Show": "显示",
  "Successful": "成功",
  "Sum of every provider measured by this router over its local ledger; excludes account usage reported by providers":
    "本路由器基于本地账本统计的所有服务商之和；不含服务商上报的账户用量",
  "Sum of every provider row · Last 90 days · router": "所有服务商行之和 · 过去 90 天 · 路由器",
  "The router returned an empty the last 24 hours telemetry window; this is different from a failed health check.":
    "路由器返回了空的「过去 24 小时」遥测窗口；这与健康检查失败不同。",
  "This router · all providers, shown over the selected local date range. Router bars split regular input, cached input, and output.":
    "本路由器 · 全部服务商，显示所选本地日期范围。路由器柱状图拆分常规输入、缓存输入与输出。",
  "Traffic, the last 24 hours": "流量，过去 24 小时",
  "Unmeasured": "未测量",
  "Version 0.5.1": "版本 0.5.1",
  "View": "查看",
  "Weekly": "每周",
  "connected": "已连接",
  "5-hour limit": "5 小时上限",
  "Account": "账户",
  "Balance": "余额",
  "Reset": "重置",
  "Resets": "重置时间",
  "Shortcuts": "快捷方式",
  "Toggle sidebar": "切换侧边栏",
  "Toggle theme": "切换主题",
  "Back to top": "回到顶部",
  "Copy command": "复制命令",
  "Copied": "已复制",
  // 模型卡片上的模态/计费短标签与筛选行
  "Text": "文本",
  "Free": "免费",
  "Cancel": "取消",
  "Running": "运行中",
  "Stopped": "已停止",
  "Installed": "已安装",
  "Managed by Codex": "由 Codex 托管",
  "No reset times are available.": "暂无重置时间。",
  // 服务/运行时状态词
  "Offline": "离线",
  "Busy": "忙碌中",
  "Checking": "检查中",
  "Ready": "就绪",
  "Degraded": "降级",
  "Runtime": "运行时",
};

// 页面级说明句：整段渲染，必须整句入表。
const D7: Record<string, string> = {
  "Opening a task resumes its original transcript in its owning harness. The control center does not copy or migrate conversation data between harnesses.":
    "打开任务会在其所属工具链中恢复原始会话记录。控制中心不会在各工具链之间复制或迁移会话数据。",
  "Choices here decide what Codex can spawn as a subagent. They do not hide anything from Codex's model picker — use Model picker below for that.":
    "这里的选择决定 Codex 能把哪些模型作为子代理启动。它们不会隐藏 Codex 模型选择器里的任何内容——那要用下面的「模型选择器」。",
  "This removes only the router-owned OAuth client, session, and live proof. Official Antigravity or agy credentials are never read or changed.":
    "这只会删除本路由器自有的 OAuth 客户端、会话与在线凭证。官方的 Antigravity 或 agy 凭据不会被读取或修改。",
  "One guided setup installs the connector, opens Cloudflare authorization, publishes every selected model, verifies it, and reopens Cursor.":
    "一次引导式配置会安装连接器、打开 Cloudflare 授权、发布全部已选模型、验证通过后重新打开 Cursor。",
  "Click Connect Cursor. The app chooses a private connector hostname, publishes every selected model, verifies it, and reopens Cursor.":
    "点击「连接 Cursor」。应用会选一个私有连接器主机名、发布全部已选模型、验证通过后重新打开 Cursor。",
  "Router health, live work, recent traffic, and the accounts closest to running out. Every tile opens the page that owns the detail.":
    "路由器健康度、进行中的任务、近期流量，以及最接近用尽额度的账户。每个卡片都会打开负责该细节的页面。",
  "Save multiple ChatGPT logins and choose which one native Codex chats use. Provider routes keep their own credentials.":
    "保存多个 ChatGPT 登录账号，并选择原生 Codex 会话使用哪一个。各服务商路由保留各自的凭据。",
  "Switch on to let Codex spawn subagents on this route. Verify it with an agent check before relying on it.":
    "开启后 Codex 可在此路由上启动子代理。正式依赖前请先做一次代理检查来验证。",
  "Sign in through the official provider CLI in your system terminal, then refresh.":
    "请在系统终端中通过服务商官方 CLI 登录，然后刷新。",
  "Start a task in Codex, DeepSeek Harness, or Cursor, then refresh this view.":
    "先在 Codex、DeepSeek Harness 或 Cursor 中开始一个任务，然后刷新此视图。",
  "Start the router or refresh after setup completes.": "请启动路由器，或等配置完成后再刷新。",
  "Some session history is unavailable": "部分会话历史不可用",
  "Some router data could not load": "部分路由器数据加载失败",
  "Session indexes could not be read.": "无法读取会话索引。",
  "Search sessions, models, or workspaces": "搜索会话、模型或工作区",
  "Search control center": "搜索控制中心",
  "Search control center sections": "搜索控制中心各板块",
  "Search every connected provider": "搜索所有已连接的服务商",
  "Search Ollama families or tags": "搜索 Ollama 系列或标签",
  "Search all Ollama tags": "搜索全部 Ollama 标签",
  "Search enabled models": "搜索已启用的模型",
  "Session metadata only": "仅会话元数据",
  "Shared routed catalog": "共享路由目录",
  "Supported clients": "支持的客户端",
  "Session ownership": "会话归属",
  "Sign in to Cloudflare Tunnel": "登录 Cloudflare Tunnel",
  "Sample count unavailable": "样本数量不可用",
  "Show all router models": "显示全部路由器模型",
  "Switch ChatGPT account": "切换 ChatGPT 账号",
  "Start Qwen MLX installation": "开始安装 Qwen MLX",
  "Shortlist for this machine": "适配本机的候选清单",
  "Starting loopback server": "正在启动本地回环服务",
  "Start local runtime": "启动本地运行时",
  "Start router service": "启动路由器服务",
  "Served · unchecked": "已服务 · 未勾选",
  "Show activity pill": "显示活动指示",
  "Show while Codex or ChatGPT is running": "Codex 或 ChatGPT 运行时显示",
  "Use without OpenAI login": "不登录 OpenAI 也可使用",
  "All clear": "一切正常",
  "Quota resets": "配额重置",
  "Service health": "服务健康",
  "No sessions yet": "暂无会话",
  "Signed routing enabled. Restart Codex to apply the native-plus-router transport.":
    "已启用签名路由。重启 Codex 以应用「原生 + 路由器」传输方式。",
  "Signed routing disabled. Restart Codex to restore the native transport.":
    "已停用签名路由。重启 Codex 以恢复原生传输方式。",
  "Ollama is not installed. Installing a model can set it up with explicit consent.":
    "未安装 Ollama。安装模型时可在明确同意的前提下顺带完成安装。",
};

// 图表坐标轴、汇总行里反复出现的孤立词与月份。
const D8: Record<string, string> = {
  Jan: "1月", Feb: "2月", Mar: "3月", Apr: "4月", May: "5月", Jun: "6月",
  Jul: "7月", Aug: "8月", Sep: "9月", Oct: "10月", Nov: "11月", Dec: "12月",
  "Speed leaders": "速度榜",
  Router: "路由器",
  router: "路由器",
  Gateway: "网关",
  gateway: "网关",
  providers: "服务商",
  provider: "服务商",
  models: "模型",
  model: "模型",
  "Custom": "自定义",
  Plus: "Plus 版",
  "sum of provider rows": "各服务商行合计",
  "Last 90 days": "过去 90 天",
  "Last 30 days": "过去 30 天",
  "Last 24 hours": "过去 24 小时",
  "last year": "过去一年",
  "selected range": "所选范围",
  // 「数字 + 名词」规则拆出来的词
  input: "输入",
  output: "输出",
  cache: "缓存",
  cached: "已缓存",
  context: "上下文",
  active: "活跃",
  cloud: "云端",
  request: "请求",
  requests: "请求",
  // 「{a} of {b} <名词>」在 JSX 里会拆成「a」「 of 」「b」「 名词」四个相邻文本节点，
  // 所以这里是**夹在两个数字之间**的那个 of：译成「占」会读成「5 占 41 已连接」（不通），
  // 译成斜杠才通用 —— 「5 / 41 已连接」「Top 3 / 12」「N / M 已渲染」都成立。
  of: "/",
  connected: "已连接",
  rendered: "已渲染",
};

// 逐页面实测后补齐的标签、状态与说明句。
const D9: Record<string, string> = {
  // 总览
  "controlTray started": "控制托盘已启动",

  // 本地
  "installed during setup": "配置时安装",
  "Hugging Face downloader": "Hugging Face 下载器",
  "Reduced guardrails; local access only": "限制已放宽；仅限本机访问",
  "Speed unmeasured": "速度未测量",
  Measure: "测量",
  State: "状态",
  Version: "版本",
  Managed: "托管方式",
  fits: "可运行",
  tight: "偏紧",
  tags: "标签",
  Reader: "读取器",
  accurate: "准确",
  Recommended: "推荐",
  "Reads codes, numbers, and dates exactly. The default choice.":
    "精确识别编码、数字与日期。默认选择。",
  "Reference score": "基准得分",
  untested: "未测试",
  "Larger sibling of the 3B. Not benchmarked here yet.": "3B 的更大版本。此处尚未做基准测试。",
  "Strongest reasoning of the set. Not benchmarked here yet.":
    "本组中推理能力最强。此处尚未做基准测试。",
  "captions-only": "仅字幕",
  "Tiny and quick, but transcribed none of the test text.":
    "体积小、速度快，但未能转述任何测试文本。",
  "Scored zero on the benchmark and is the slowest. Avoid for text.":
    "基准测试得分为零，且速度最慢。不建议用于文本。",
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "极高",
  max: "最高",

  // 工具链
  Sessions: "会话",
  "Shared picker": "共享选择器",
  indexed: "已索引",
  "Set up": "配置",
  delegated: "已委托",
  runs: "运行中",
  Inactive: "未启用",
  Isolated: "已隔离",
  "Model routes and provider credentials are shared; sessions and client-owned settings remain separate.":
    "模型路由与服务商凭据是共享的；会话与客户端自有设置各自独立。",
  "OpenClaw's current agent runtime using every model selected in this router.":
    "OpenClaw 当前的代理运行时，使用本路由器中选定的全部模型。",
  "Setup installs openclaw@latest and publishes every routed model in one action.":
    "配置过程会安装 openclaw@latest，并一次性发布全部已路由模型。",
  "Cursor Agent and Cursor App using the router's separate authenticated adapters.":
    "Cursor Agent 与 Cursor App，使用本路由器各自独立的认证适配器。",
  "Install Cursor App or Cursor Agent first.": "请先安装 Cursor App 或 Cursor Agent。",
  "Install the official Claude Code CLI first.": "请先安装官方 Claude Code CLI。",
  "Google's terminal coding agent using the shared routed model catalog.":
    "Google 的终端编码代理，使用共享的路由模型目录。",
  "Install the official Gemini CLI first.": "请先安装官方 Gemini CLI。",
  "DeepSeek's coding harness, sharing this router's model catalog and credentials.":
    "DeepSeek 的编码工具链，共享本路由器的模型目录与凭据。",
  "Setup installs @deepseek-ai/dsh when it is missing and publishes the shared route.":
    "缺失时配置过程会安装 @deepseek-ai/dsh，并发布共享路由。",
  "OpenAI's desktop and terminal coding harness.": "OpenAI 的桌面与终端编码工具链。",
  "The opencode terminal agent, using every model selected in this router.":
    "opencode 终端代理，使用本路由器中选定的全部模型。",
  "Setup installs opencode-ai when it is missing and publishes every routed model.":
    "缺失时配置过程会安装 opencode-ai，并发布全部已路由模型。",
  "Mario Zechner's pi coding agent, using every model selected in this router.":
    "Mario Zechner 的 pi 编码代理，使用本路由器中选定的全部模型。",
  "Setup installs @earendil-works/pi-coding-agent when it is missing and publishes every routed model.":
    "缺失时配置过程会安装 @earendil-works/pi-coding-agent，并发布全部已路由模型。",
  "The omp (oh-my-pi) terminal agent, using every model selected in this router.":
    "omp（oh-my-pi）终端代理，使用本路由器中选定的全部模型。",
  "Install omp from omp.sh first; setup then publishes every routed model into ~/.omp/agent/models.yml.":
    "请先从 omp.sh 安装 omp；随后配置过程会把全部已路由模型发布到 ~/.omp/agent/models.yml。",
  "Setup installs command-code 1.30.0 or later (the first release that reads providers.json) and publishes every routed model as a BYOK provider.":
    "配置过程会安装 command-code 1.30.0 或更高版本（首个支持读取 providers.json 的版本），并把全部已路由模型发布为 BYOK 服务商。",
  "Nous Research's Hermes Agent as a named custom provider on this router.":
    "把 Nous Research 的 Hermes Agent 作为具名自定义服务商接入本路由器。",
  "Install the official Hermes Agent first; setup then publishes every routed model into its config.yaml.":
    "请先安装官方 Hermes Agent；随后配置过程会把全部已路由模型发布到它的 config.yaml。",
  "Cursor App reaches only the separately keyed app edge; the main loopback capability stays private.":
    "Cursor App 只能访问单独持密钥的应用边缘；主回环能力保持私有。",

  // 上下文管理
  Workspaces: "工作区",
  "Show archived": "显示已归档",
  Saved: "已保存",
  Resume: "恢复",
  shown: "已显示",
  matches: "个匹配",
  // 本地页「N families · M tags」的碎片：React 把它拆成 "21" / " famil" / "ies"
  // 三个相邻文本节点，只能分别改写。合并渲染时由上面的 ^(\d+)\s*famil$ 兜底。
  famil: "个系列",
  ies: "",
  y: "",

  // 模型能力标签，以及网页面板里的统计行
  vision: "视觉",
  tools: "工具",
  thinking: "思考",
  audio: "音频",
  families: "系列",
  local: "本地",
  available: "可用",

  // 设置
  "ChatGPT accounts": "ChatGPT 账户",
  "Token maxxing": "Token 最大化",
  "Enable Token maxxing": "启用 Token 最大化",
};

// 动态文案：只匹配整段字符串，且模式尽量收紧，避免误伤模型名或数值。
// #region zh-shared-helpers
const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;

// 标题栏的进行中提示来自 Electron 主进程，文案是 IPC 处理器名（camelCase），
// 例如「saveProviderCredential started」。这里把它映射成中文动作名。
const OPERATION_ZH: Record<string, string> = {
  openExternal: "打开外部链接",
  repairInstall: "修复安装",
  setProviderEnabled: "更改服务商启用状态",
  addProviderModels: "添加服务商模型",
  connectProvider: "连接服务商",
  saveProviderCredential: "保存服务商凭据",
  removeProviderCredential: "移除服务商凭据",
  setSubagentMode: "更改子代理模式",
  setSubagentModel: "更改子代理模型",
  certifySubagentModels: "认证子代理模型",
  setSubagentEffort: "更改子代理推理强度",
  setSubagentSelection: "更改子代理选择",
  setPickerModel: "更改选择器模型",
  setPickerModels: "批量更改选择器模型",
  installLocalModel: "安装本地模型",
  installLocalMlx: "安装 MLX 运行时",
  cancelLocalMlx: "取消 MLX 安装",
  uninstallLocalModel: "移除本地模型",
  setLocalModelEnabled: "更改本地模型启用状态",
  benchmarkLocalModel: "基准测试本地模型",
  controlLocalRuntime: "控制本地运行时",
  setVisionBridgeEnabled: "更改视觉桥接",
  setVisionBridgeEngine: "更改视觉引擎",
  setVisionBridgeEffort: "更改视觉推理强度",
  downloadVisionModel: "下载视觉模型",
  useLocalVisionModel: "使用本地视觉模型",
  benchmarkVisionModel: "基准测试视觉模型",
  setToolResultAging: "更改结果压缩",
  setNativeToolResultAging: "更改原生结果压缩",
  setToolResultRetentionTtl: "更改结果保留时长",
  setDefaultModel: "设置默认模型",
  setRouterDefault: "设置路由器默认模型",
  clearRouterDefault: "清除路由器默认模型",
  setSignedRouting: "更改登录态路由",
  setChatGptSessionSharing: "更改 ChatGPT 会话共享",
  addChatGptSubscriptionAccount: "添加 ChatGPT 订阅账户",
  loginChatGptSubscriptionAccount: "登录 ChatGPT 订阅账户",
  removeChatGptSubscriptionAccount: "移除 ChatGPT 订阅账户",
  setChatGptAccountSelection: "切换 ChatGPT 账户",
  setPresence: "更改驻留模式",
  controlService: "控制后台服务",
  controlTray: "控制桌面托盘",
  launchHarness: "启动工具链",
  probeAgentBridge: "探测代理桥接",
  loginAgentBridge: "登录代理桥接",
  setupHarness: "配置工具链",
  updateHarness: "更新工具链",
  prepareCursorTunnel: "准备 Cursor 隧道",
  connectCursor: "连接 Cursor",
  openHarnessSession: "打开工具链会话",
};

// 把一段文案里嵌着的英文日期/时间本地化。界面上大量使用 Intl("en-US") 直接
// 输出，形如 "Sep 14, 9:54 PM"，这类片段会跟着别的字串一起渲染成一个文本节点，
// 用整段精确匹配是抓不完的，所以统一在这里先做一遍替换。
const EN_MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};
const EN_MONTH_RE = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";

function toChineseDate(month: string, day: string, year?: string): string {
  const m = EN_MONTHS[month];
  const d = Number(day);
  return year ? `${year}年${m}月${d}日` : `${m}月${d}日`;
}

function to24Hour(hour: string, minute: string, period: string): string {
  let h = Number(hour) % 12;
  if (period.toUpperCase() === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function localizeDateText(input: string): string {
  let out = input;
  out = out.replace(
    new RegExp(`\\b(${EN_MONTH_RE})\\s+(\\d{1,2}),\\s*(\\d{4})\\b`, "g"),
    (_m, mon: string, day: string, year: string) => toChineseDate(mon, day, year),
  );
  out = out.replace(
    new RegExp(`\\b(${EN_MONTH_RE})\\s+(\\d{1,2})\\b`, "g"),
    (_m, mon: string, day: string) => toChineseDate(mon, day),
  );
  out = out.replace(
    new RegExp(`\\b(${EN_MONTH_RE})\\s+(\\d{4})\\b`, "g"),
    (_m, mon: string, year: string) => `${year}年${EN_MONTHS[mon]}月`,
  );
  out = out.replace(
    /\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi,
    (_m, hour: string, minute: string, period: string) => to24Hour(hour, minute, period),
  );
  out = out.replace(
    /\b(\d{1,2})\s*(AM|PM)\b/gi,
    (_m, hour: string, period: string) => to24Hour(hour, "00", period),
  );
  // 「Sep 14, 9:54 PM」本地化后会留下一个英文逗号，一并收掉。
  out = out.replace(/(\d+月\d+日),\s*(\d{2}:\d{2})/g, "$1 $2");
  return out;
}

// 组合句里拆出来的片段，回头查一次表/规则，避免「Plus plan」这类残留在中文句子里。
// 「A · B · C」这种多段拼接串会逐段递归，任一段命中就整体重写。
function pickZh(segment: string): string {
  const key = segment.trim();
  if (!key) return key;
  const direct = ZH_EXACT[key];
  if (direct !== undefined) return direct;
  for (const rule of ZH_RULES) {
    const match = key.match(rule.pattern);
    if (match) return rule.replace(match);
  }
  return expandZhList(key) ?? key;
}

// 用「 · 」分隔的整行摘要，逐段翻译；一段都没命中就返回 null，避免无意义改写。
function expandZhList(value: string): string | null {
  const parts = value.split(/\s+·\s+/);
  if (parts.length < 2) return null;
  const mapped = parts.map((part) => pickZh(part));
  if (mapped.every((part, index) => part === parts[index])) return null;
  return mapped.join(" · ");
}

export function translateZhText(raw: string): string | null {
  if (!raw) return null;
  const lead = /^\s*/.exec(raw)?.[0] ?? "";
  const tail = /\s*$/.exec(raw)?.[0] ?? "";
  const core = raw.slice(lead.length, raw.length - tail.length);
  if (!core) return null;
  // 精确表先查：D5 里放的是「中文紧贴拉丁字母」的混排修正，本来就有中文，
  // 必须在 CJK 早退之前处理。
  const direct = ZH_EXACT[core];
  if (direct !== undefined) return lead + direct + tail;
  // 先本地化日期/时间，再走精确表与规则；否则「Resets Sep 14, 9:54 PM (in 5h 0m)」
  // 这种句子永远匹配不上。
  const dated = localizeDateText(core);
  if (dated !== core) {
    const afterDate = ZH_EXACT[dated];
    if (afterDate !== undefined) return lead + afterDate + tail;
    for (const rule of ZH_RULES) {
      const match = dated.match(rule.pattern);
      if (match) return lead + rule.replace(match) + tail;
    }
    const expandedDated = expandZhList(dated);
    if (expandedDated !== null) return lead + expandedDated + tail;
    if (CJK.test(core)) return null;
    return lead + dated + tail;
  }
  // 规则要先于 CJK 早退跑一次：日期本地化会留下「0 tokens on 2025年10月10日」
  // 这类「句子还是英文、但已经含中文」的串，若先做 CJK 判断就再也修不回来了。
  for (const rule of ZH_RULES) {
    const match = core.match(rule.pattern);
    if (match) return lead + rule.replace(match) + tail;
  }
  if (CJK.test(core)) return null;
  // 最后兜底：整行由「 · 」拼起来的情况，逐段翻译。
  const expanded = expandZhList(core);
  if (expanded !== null) return lead + expanded + tail;
  return null;
}
// #endregion zh-shared-helpers

const ZH_RULES: Rule[] = [
  { pattern: /^([\d.,]+[kmb]?%?)\s*left$/, replace: (m) => `${m[1]} 剩余` },
  { pattern: /^,\s*([\d.,]+[kmb]?%?)\s*left$/, replace: (m) => `，${m[1]} 剩余` },
  { pattern: /^([\d.,]+[kmb]?)\s*tokens?$/i, replace: (m) => `${m[1]} token` },
  { pattern: /^([\d.,]+[kmb]?)\s*tok$/, replace: (m) => `${m[1]} token` },
  { pattern: /^([\d.,]+[kmb]?%?)\s*reused tokens$/, replace: (m) => `${m[1]} 个复用 token` },
  { pattern: /^([\d.,]+[kmb]?)\s*total tokens$/, replace: (m) => `${m[1]} 个 token（合计）` },
  { pattern: /^([\d.,]+[kmb]?)\s*router tokens?$/, replace: (m) => `${m[1]} 路由器 token` },
  { pattern: /^Router traffic for the last 24 hours: (.+) tokens$/, replace: (m) => `过去 24 小时的路由器流量：${m[1]} token` },
  { pattern: /^([\d.,]+[kmb]?)\s*(input|output|cache|cached|context|active|cloud|requests?)(\.?)$/,
    replace: (m) => `${m[1]} ${pickZh(m[2])}${m[3]}` },
  { pattern: /^read (.+)$/, replace: (m) => `读取于 ${m[1]}` },
  { pattern: /^% of$/, replace: () => "% 占" },
  { pattern: /^([\d.,]+[kmb]?)\s*metered$/, replace: (m) => `${m[1]} 已计量` },
  { pattern: /^(\d+)\s*published$/, replace: (m) => `已发布 ${m[1]}` },
  { pattern: /^(\d+)\s*shown$/, replace: (m) => `已显示 ${m[1]}` },
  { pattern: /^One router plane, (\d+) client stores$/, replace: (m) => `一个路由器平面，${m[1]} 个客户端存储` },
  { pattern: /^(\d+)\s*selected models are republished into every configured client\.$/,
    replace: (m) => `已选中的 ${m[1]} 个模型会重新发布到每个已配置客户端。` },
  { pattern: /^selected models are republished into every configured client\.$/,
    replace: () => "已选中的模型会重新发布到每个已配置客户端。" },
  { pattern: /^tags ·$/, replace: () => "标签 ·" },
  // 本地页的「N families · M tags」被 React 拆成多个文本节点，
  // 只能对拆出来的碎片分别改写：数字段 -> 「N 个」，词尾 -> 「系列」。
  { pattern: /^(\d+)\s*famil$/, replace: (m) => `${m[1]} 个` },
  // 网页面板的统计行：「227 tags · 21 families」「49 tags · 36 local · 2 cloud」
  { pattern: /^(\d+)\s*tags?\s*·\s*(.+)$/, replace: (m) => `${m[1]} 个标签 · ${pickZh(m[2])}` },
  { pattern: /^(\d+)\s*tags?$/, replace: (m) => `${m[1]} 个标签` },
  { pattern: /^(\d+)\s*(families|local|available)$/, replace: (m) => `${m[1]} 个${pickZh(m[2])}` },
  { pattern: /^Models: (.+)$/, replace: (m) => `模型：${m[1]}` },
  { pattern: /^Show (\d+) more quick picks$/, replace: (m) => `再显示 ${m[1]} 个快捷选择` },
  { pattern: /^([\d.,]+[kmb]?)\s*measured tokens across the last year$/,
    replace: (m) => `${m[1]} 个实测 token（过去一年）` },
  { pattern: /^([\d.,]+[kmb]?)\s*tokens? in last (\d+) days$/,
    replace: (m) => `${m[1]} 个 token（过去 ${m[2]} 天）` },
  { pattern: /^Last (\d+) days$/, replace: (m) => `过去 ${m[1]} 天` },
  { pattern: /^(\d+)\s*chats?$/, replace: (m) => `${m[1]} 个会话` },
  { pattern: /^(\d+)\s*subagents?$/, replace: (m) => `${m[1]} 个子代理` },
  { pattern: /^(\d+)\s*provider routes$/, replace: (m) => `${m[1]} 条服务商路由` },
  { pattern: /^(\d+)\s*fit$/, replace: (m) => `${m[1]} 个可用` },
  { pattern: /^(\d[\d.,]*)\s*of\s*(\d[\d.,]*)\s*models?(?: · (.+))?$/,
    replace: (m) => `${m[2]} 个模型中的 ${m[1]} 个${m[3] ? ` · ${pickZh(m[3])}` : ""}` },
  { pattern: /^Connect (.+?) to use this route\.$/, replace: (m) => `连接 ${pickZh(m[1])} 即可使用此路由。` },
  // 模型页「测试连接」：未连接的行禁用按钮，提示要先连上账户；
  // 原生路由由 Codex 自己的会话提供，不属于本路由器的任何账户。
  { pattern: /^Connect (.+?) to test this route\.$/, replace: (m) => `连接 ${pickZh(m[1])} 后可测试此路由。` },
  { pattern: /^(.+?) is served by your Codex session, not by an account in this router\.$/,
    replace: (m) => `${pickZh(m[1])} 由你的 Codex 会话提供，不是本路由器中的账户。` },
  { pattern: /^Test (.+?) through (.+)$/, replace: (m) => `测试 ${pickZh(m[1])}（经 ${pickZh(m[2])}）` },
  { pattern: /^Connect (.+)$/, replace: (m) => `连接 ${pickZh(m[1])}` },
  { pattern: /^Replace (.+?) credential$/, replace: (m) => `替换 ${pickZh(m[1])} 凭据` },
  { pattern: /^Save (.+?) credential$/, replace: (m) => `保存 ${pickZh(m[1])} 凭据` },
  { pattern: /^([\d.,]+)\s*GB RAM$/, replace: (m) => `${m[1]} GB 内存` },
  { pattern: /^([\d.,]+)\s*GB GPU memory$/, replace: (m) => `${m[1]} GB 显存` },
  { pattern: /^([\d.,]+)\s*GB free disk$/, replace: (m) => `${m[1]} GB 可用磁盘` },
  { pattern: /^(\d+)\s+in ([A-Za-z][\w ./-]*)$/, replace: (m) => `${m[2]} 中 ${m[1]} 个` },
  { pattern: /^(\d[\d.,]*)\s+(?!GB$|MB$|KB$|TB$)([A-Z][\w.-]*)$/, replace: (m) => `${m[2]} ${m[1]}` },
  { pattern: /^router = (.+?) \+ (.+)$/, replace: (m) => `路由器 = ${pickZh(m[1])} + ${pickZh(m[2])}` },
  { pattern: /^Input is split into (.+?) regular and (.+?) cached; cached input is a subset of input, not an extra total\.$/,
    replace: (m) => `输入拆分为 ${m[1]} 常规与 ${m[2]} 缓存；缓存输入是输入的子集，不计入额外总量。` },
  // —— 运行时实际拼出来的组合句：整段匹配，拆出来的片段再查一次表 ——
  { pattern: /^(.+),\s*5-hour limit\s*·\s*(.+)$/, replace: (m) => `${pickZh(m[1])}，5 小时上限 · ${pickZh(m[2])}` },
  { pattern: /^(.+),\s*7-day limit\s*·\s*(.+)$/, replace: (m) => `${pickZh(m[1])}，7 天上限 · ${pickZh(m[2])}` },
  { pattern: /^(.+),\s*weekly limit\s*·\s*(.+)$/, replace: (m) => `${pickZh(m[1])}，每周上限 · ${pickZh(m[2])}` },
  { pattern: /^(.+),\s*5-hour limit$/, replace: (m) => `${pickZh(m[1])}，5 小时上限` },
  { pattern: /^(.+),\s*weekly limit$/, replace: (m) => `${pickZh(m[1])}，每周上限` },
  { pattern: /^(\d+)\s*requests?\s+in flight$/, replace: (m) => `${m[1]} 个进行中请求` },
  { pattern: /^(An?|\d+)\s+dependenc(?:y|ies)\s+need(?:s)?\s+attention$/, replace: () => "有依赖需要注意" },
  { pattern: /^(.+)\s+needs attention$/, replace: (m) => `${pickZh(m[1])} 需要注意` },
  { pattern: /^(.+)\s+needs attention\.$/, replace: (m) => `${pickZh(m[1])} 需要注意。` },
  { pattern: /^Local · (.+)$/, replace: (m) => `本地 · ${pickZh(m[1])}` },
  { pattern: /^Auto · (.+)$/, replace: (m) => `自动 · ${pickZh(m[1])}` },
  { pattern: /^(.+) will transcribe images\.$/, replace: (m) => `${pickZh(m[1])} 将转述图片。` },
  { pattern: /^(.+) token activity for the last year$/, replace: (m) => `${pickZh(m[1])} 的全年 token 活动` },
  { pattern: /^· (.+)h token$/, replace: (m) => `· ${m[1]} 小时 token` },
  { pattern: /^([\d.]+)\s*sec$/, replace: (m) => `${m[1]} 秒` },
  { pattern: /^(\d+)\s*days?$/, replace: (m) => `${m[1]} 天` },
  { pattern: /^(\d+)\s*hours?$/, replace: (m) => `${m[1]} 小时` },
  { pattern: /^(\d+)\s*[Hh]$/, replace: (m) => `${m[1]} 小时` },
  { pattern: /^(\d+)\s*[Dd]$/, replace: (m) => `${m[1]} 天` },
  { pattern: /^(\d+)\s*s$/, replace: (m) => `${m[1]} 秒` },
  // —— 运行时实际拼出来的组合句：整段匹配，拆出来的片段再查一次表 ——
  { pattern: /^(.+),\s*5-hour limit\s*·\s*(.+)$/, replace: (m) => `${pickZh(m[1])}，5 小时上限 · ${pickZh(m[2])}` },
  { pattern: /^(.+),\s*7-day limit\s*·\s*(.+)$/, replace: (m) => `${pickZh(m[1])}，7 天上限 · ${pickZh(m[2])}` },
  { pattern: /^Resets (.+) \(in (.+)\)$/, replace: (m) => `重置于 ${m[1]}（${pickZh(m[2])}后）` },
  { pattern: /^Resets (.+)$/, replace: (m) => `重置于 ${m[1]}` },
  { pattern: /^No reset reported$/, replace: () => "未上报重置时间" },
  { pattern: /^(\d+)\s*providers?\s*·\s*(.+?)\s*tokens?\s*·\s*(.+?)\s*·\s*(.+)$/,
    replace: (m) => `${m[1]} 个服务商 · ${m[2]} token · ${pickZh(m[3])} · ${pickZh(m[4])}` },
  { pattern: /^(\d+)\s*providers?$/, replace: (m) => `${m[1]} 个服务商` },
  { pattern: /^(\d+)\s*routes?$/, replace: (m) => `${m[1]} 条路由` },
  { pattern: /^(\d+)\s*clients?$/, replace: (m) => `${m[1]} 个客户端` },
  { pattern: /^(\d+)\s*models?$/, replace: (m) => `${m[1]} 个模型` },
  { pattern: /^(Idle|Running|Busy|Offline|Online)\s*·\s*version (.+)$/,
    replace: (m) => `${pickZh(m[1])} · 版本 ${m[2]}` },
  { pattern: /^in (\d+)m$/, replace: (m) => `${m[1]} 分钟后` },
  { pattern: /^in (\d+)h (\d+)m$/, replace: (m) => `${m[1]} 小时 ${m[2]} 分钟后` },
  { pattern: /^in (\d+)d (\d+)h$/, replace: (m) => `${m[1]} 天 ${m[2]} 小时后` },
  { pattern: /^(\d+)h (\d+)m$/, replace: (m) => `${m[1]} 小时 ${m[2]} 分钟` },
  { pattern: /^(\d+)d (\d+)h$/, replace: (m) => `${m[1]} 天 ${m[2]} 小时` },
  { pattern: /^(\d+)m$/, replace: (m) => `${m[1]} 分钟` },
  { pattern: /^time unavailable$/, replace: () => "时间不可用" },
  { pattern: /^refresh due$/, replace: () => "该刷新了" },
  { pattern: /^Account limits and balances stay separate from traffic measured by this router\. Snapshot fetched (.+)\.$/,
    replace: (m) => `账户限额与余额和本路由器实测的流量分开统计。快照获取于 ${m[1]}。` },
  { pattern: /^Account limits and balances stay separate from traffic measured by this router\.?$/,
    replace: () => "账户限额与余额和本路由器实测的流量分开统计。" },

  // —— 图表/看板 tooltip：这批是 role=tooltip 与同源 aria-label，平时 CSS 隐藏，
  //    只有悬停或读屏才出现，之前的可见性过滤扫描整个漏掉了。 ——
  { pattern: /^(.+?)\s+cumulative tokens? through (.+)$/, replace: (m) => `截至 ${m[2]} 累计 ${m[1]} token` },
  { pattern: /^(.+?)\s+tokens? from (.+?) to (.+)$/, replace: (m) => `${m[2]} 至 ${m[3]} 消耗 ${m[1]} token` },
  { pattern: /^(.+?)\s+tokens? on (.+)$/, replace: (m) => `${m[2]} 消耗 ${m[1]} token` },
  { pattern: /^Total: (.+?) tokens\.$/, replace: (m) => `合计：${m[1]} token。` },
  { pattern: /^(.+?)\s+total tokens$/, replace: (m) => `${m[1]} token 合计` },
  { pattern: /^(.+?)\s+tok$/, replace: (m) => `${m[1]} token` },
  { pattern: /^(.+?)\. Token count not reported\. Requests: (.+?)\.?$/,
    replace: (m) => `${m[1]}。未上报 token 计数。请求数：${m[2]}。` },
  { pattern: /^(\d[\d.,]*)\s+requests observed in (.+?), but token counts were not reported by the upstream responses\.$/,
    replace: (m) => `在${pickZh(m[2])}内观测到 ${m[1]} 次请求，但上游响应未上报 token 计数。` },
  { pattern: /^version (.+)$/, replace: (m) => `版本 ${m[1]}` },
  { pattern: /^(每日|每周|累计) 的全年 token 活动$/, replace: (m) => `${m[1]} token 活动（过去一年）` },

  // —— 看板卡片 / 配额 的 aria-label ——
  { pattern: /^(.+?): (\d+) percent remaining$/, replace: (m) => `${pickZh(m[1])}：剩余 ${m[2]}%` },
  { pattern: /^(.+?) tokens compared with the busiest model in this view$/,
    replace: (m) => `与当前视图中最忙的模型相比为 ${m[1]} token` },
  { pattern: /^Token mix for (.+)$/, replace: (m) => `token 构成 · ${pickZh(m[1])}` },
  { pattern: /^(.+?) usage breakdown$/, replace: (m) => `${pickZh(m[1])} 用量明细` },
  { pattern: /^(Hourly|Daily) router traffic for (.+?)(?: by tokens| by requests| split into regular input, cached input, and output)?$/,
    replace: (m) => `${m[1] === "Hourly" ? "每小时" : "每日"}路由流量 · ${pickZh(m[2])}` },
  { pattern: /^(.+?): (.+?)\. (.+?)\. Open (Status|Usage|Models|Local|Harness|Context Manager|Settings|Dashboard)\.$/,
    replace: (m) => `${pickZh(m[1])}：${pickZh(m[2])}。${pickZh(m[3])}。打开${pickZh(m[4])}。` },
  { pattern: /^Sum of every provider row · (.+)$/, replace: (m) => `各服务商行合计 · ${pickZh(m[1])}` },
  { pattern: /^Selected (.+)-day range$/, replace: (m) => `所选 ${m[1]} 天范围` },
  { pattern: /^([\d.]+) sec$/, replace: (m) => `${m[1]} 秒` },
  { pattern: /^(\d+) req(?:uests)?$/, replace: (m) => `${m[1]} 次请求` },

  // —— 模型页 / 设置页 的动作按钮提示 ——
  { pattern: /^(Enable|Disable) (.+)$/, replace: (m) => `${m[1] === "Enable" ? "启用" : "停用"} ${pickZh(m[2])}` },
  { pattern: /^Refresh (Dashboard|Usage|Status|Models|Local|Harness|Context Manager|Settings)$/,
    replace: (m) => `刷新${pickZh(m[1])}` },
  { pattern: /^Switch to (dark|light) theme$/, replace: (m) => `切换到${m[1] === "dark" ? "深色" : "浅色"}主题` },
  { pattern: /^(Collapse|Expand) sidebar$/, replace: (m) => `${m[1] === "Collapse" ? "收起" : "展开"}侧边栏` },
  { pattern: /^Open (Status|Usage|Models|Local|Harness|Context Manager|Settings|Dashboard|Codex)$/,
    replace: (m) => `打开${pickZh(m[1])}` },
  { pattern: /^Show (\d+) more$/, replace: (m) => `再显示 ${m[1]} 项` },
  { pattern: /^(\d+) more models$/, replace: (m) => `还有 ${m[1]} 个模型` },
  { pattern: /^Use (.+?) in Codex$/, replace: (m) => `在 Codex 中使用 ${m[1]}` },
  { pattern: /^Use (.+?) through (.+?) as a subagent$/, replace: (m) => `把 ${m[1]} 经 ${pickZh(m[2])} 用作子代理` },
  { pattern: /^Show (.+?) through (.+?) in the picker$/, replace: (m) => `在选择器中显示 ${m[1]}（经 ${pickZh(m[2])}）` },
  { pattern: /^One click installs any missing official local-runtime prerequisites, downloads about ([\d.]+) GB of weights, starts the loopback server, verifies the model, and publishes$/,
    replace: (m) => `一键装齐缺失的官方本地运行时依赖、下载约 ${m[1]} GB 权重、启动回环服务器、校验模型，然后把` },

  // ---- D11 补充规则（第三轮实测残留；都放在最后，避免抢在既有更具体的规则前面）----
  // 「· 未上报 token」这类以「· 」开头的独占文本节点，expandZhList 的 /\s+·\s+/ 切不开
  { pattern: /^·\s*(.+)$/, replace: (m) => `· ${pickZh(m[1])}` },
  // 额度条：Paid x · Granted y
  { pattern: /^Paid (.+?) · Granted (.+)$/, replace: (m) => `付费 ${m[1]} · 赠送 ${m[2]}` },
  // 「<来源> traffic measured by this router [across all retained events]」
  { pattern: /^(.+?) traffic measured by this router across all retained events$/,
    replace: (m) => `${pickZh(m[1])} 流量（本路由器实测，覆盖全部保留事件）` },
  { pattern: /^(.+?) traffic measured by this router$/,
    replace: (m) => `${pickZh(m[1])} 流量（本路由器实测）` },
  // 用量合计整句：N tokens in <范围> [since 日期] [= X input + Y output].
  { pattern: /^([\d.,km]+) tokens in (.+?) since (\d{4}-\d{2}-\d{2}) = ([\d.,km]+) input \+ ([\d.,km]+) output\.$/,
    replace: (m) => `${m[1]} token，统计范围 ${pickZh(m[2])}，自 ${m[3]} 起 = ${m[4]} 输入 + ${m[5]} 输出。` },
  { pattern: /^([\d.,km]+) tokens in (.+?) = ([\d.,km]+) input \+ ([\d.,km]+) output\.$/,
    replace: (m) => `${m[1]} token，统计范围 ${pickZh(m[2])} = ${m[3]} 输入 + ${m[4]} 输出。` },
  { pattern: /^([\d.,km]+) tokens in (.+?) since (\d{4}-\d{2}-\d{2})\.$/,
    replace: (m) => `${m[1]} token，统计范围 ${pickZh(m[2])}，自 ${m[3]} 起。` },
  { pattern: /^([\d.,km]+) tokens in (.+?)\.$/,
    replace: (m) => `${m[1]} token，统计范围 ${pickZh(m[2])}。` },
  // 模型页空态：见上方 Connect 规则（必须排在通用 Connect 之前）
  // aria-label：「<模型> routes」。
  // ⚠️ 必须排除「 · 」拼接行，否则会把「2 个服务商 · … · 2 routes」整句当成
  // 「<前缀> routes」吞掉，输出「… · 2 路由」；数字版规则在更前面，本规则只兜
  // 「Muse Spark 1.2 routes」这类短名称。
  { pattern: /^(?!.* · )(.{1,40}?) routes$/, replace: (m) => `${pickZh(m[1])} 路由` },
  { pattern: /^Remove (.+)$/, replace: (m) => `移除 ${m[1]}` },
  // 健康状态：「Gateway: Reachable」「Router: Serving locally」
  { pattern: /^Gateway:\s*(.+)$/, replace: (m) => `网关：${pickZh(m[1])}` },
  { pattern: /^Router:\s*(.+)$/, replace: (m) => `路由器：${pickZh(m[1])}` },
  // 「Refresh 设置」是应用自带 i18n 的半翻译结果，整句再刷一遍
  { pattern: /^Refresh (.+)$/, replace: (m) => `刷新${pickZh(m[1])}` },
  // 「启用 X for Codex」同样是半翻译（i18n 翻了动词、没翻尾巴）
  { pattern: /^(Enable|Disable|启用|停用) (.+?) for Codex$/,
    replace: (m) => `在 Codex 中${m[1] === "Enable" || m[1] === "启用" ? "启用" : "停用"} ${m[2]}` },

  // ---- D12：第四轮实测残留 ----
  // 这一批是「整句由路由服务/配置数据拼出来」的文案。键值本身就是英文，而且
  // 长度和逗号数量和上一批不同，只能按真实渲染出来的整句来匹配。
  // 额度行「状态 · 窗口」的组合句（服务端只给英文短语，这里逐段再查一次表）
  { pattern: /^(.+?),\s*(.+? limit)\s*·\s*(.+)$/,
    replace: (m) => `${pickZh(m[1])}，${pickZh(m[2])} · ${pickZh(m[3])}` },
  { pattern: /^(.+?),\s*(.+? limit)$/, replace: (m) => `${pickZh(m[1])}，${pickZh(m[2])}` },
  // 额度卡片的 aria-label：「<来源>, <窗口>, 100% left. No reset reported」
  { pattern: /^(.+?),\s*(.+? limit),\s*(.+? left)\.\s*(No reset reported|Resets .+)$/,
    replace: (m) => `${pickZh(m[1])}，${pickZh(m[2])}，${pickZh(m[3])}。${pickZh(m[4])}` },
  { pattern: /^(.+?),\s*(Extra credits),\s*(.+?)\.\s*(No reset reported|Resets .+)$/,
    replace: (m) => `${pickZh(m[1])}，${pickZh(m[2])}，${pickZh(m[3])}。${pickZh(m[4])}` },
  // 服务商归属 tooltip：「<服务商> — <流量口径> — 74% left · Rolling limit」
  { pattern: /^(.+?)\s+—\s+(.+?)\s+—\s+(.+)$/,
    replace: (m) => `${pickZh(m[1])} — ${pickZh(m[2])} — ${pickZh(m[3])}` },
  // 总览 · 流量说明整句
  { pattern: /^([\d.,]+[kmb]?) measured tokens across ([\d.,]+) requests in (.+?)\.\s*(.+)$/,
    replace: (m) => `${m[1]} 个实测 token，覆盖${pickZh(m[3])}内的 ${m[2]} 次请求。${pickZh(m[4])}` },
  { pattern: /^(\d+) active days?$/, replace: (m) => `${m[1]} 个活动日` },
  { pattern: /^Top (\d+) of (\d+)$/, replace: (m) => `前 ${m[1]} / ${m[2]}` },
  // 状态 · 上下文效率 与速度榜
  { pattern: /^([\d.,]+) tokens saved$/, replace: (m) => `${m[1]} 个已节省 token` },
  { pattern: /^([\d.,]+) tokens reused$/, replace: (m) => `${m[1]} 个复用 token` },
  { pattern: /^Across ([\d.,]+) recent events$/, replace: (m) => `覆盖最近 ${m[1]} 个事件` },
  { pattern: /^Showing ([\d.,]+) of ([\d.,]+) models$/, replace: (m) => `显示 ${m[1]} / ${m[2]} 个模型` },
  { pattern: /^([\d.,]+) speed samples$/, replace: (m) => `${m[1]} 个速度样本` },
  { pattern: /^([\d.,]+) tokens saved · ([\d.,]+) requests$/,
    replace: (m) => `${m[1]} 个已节省 token · ${m[2]} 次请求` },
  { pattern: /^Peak (.+?)\/(.+)$/, replace: (m) => `峰值 ${m[1]}/${pickZh(m[2])}` },
  { pattern: /^([\d.,]+) tokens saved across ([\d.,]+) compacted requests in the last (.+?), with a peak of ([\d.,]+) tokens per (.+)$/,
    replace: (m) => `最近${pickZh(m[3])}节省了 ${m[1]} 个 token，压缩 ${m[2]} 次请求，峰值每${pickZh(m[5])} ${m[4]} 个 token` },
  { pattern: /^([\d.,]+) events? used estimated input tokens?\.$/,
    replace: (m) => `${m[1]} 个事件使用了估算输入 token。` },
  // 模型页 · 连接菜单与模型行的 aria-label
  { pattern: /^(.{1,40}?) connection$/, replace: (m) => `${pickZh(m[1])} 连接` },
  { pattern: /^Make (.+?) available to installed clients$/,
    replace: (m) => `让 ${pickZh(m[1])} 可用于已安装客户端` },
  { pattern: /^(.+?) is managed by Codex$/, replace: (m) => `${m[1]} 由 Codex 管理` },
  { pattern: /^(.+?) (.+?) subagent thinking effort$/,
    replace: (m) => `${m[1]}（经 ${pickZh(m[2])}）的子代理推理强度` },
  // 用量页 · 服务商控制台链接与额度明细
  { pattern: /^(.+?) dashboard$/, replace: (m) => `${pickZh(m[1])} 控制台` },
  { pattern: /^Plan ([\d.,]+)$/, replace: (m) => `套餐 ${m[1]}` },
  { pattern: /^Purchased ([\d.,]+)$/, replace: (m) => `已购 ${m[1]}` },
  { pattern: /^Free ([\d.,]+)$/, replace: (m) => `赠送 ${m[1]}` },
  { pattern: /^([\d.,]+) credits$/, replace: (m) => `${m[1]} 个额度` },
  { pattern: /^The account API supplied the input\/cache\/output split for this (\d+)-day range\.$/,
    replace: (m) => `账户 API 提供了这 ${m[1]} 天范围的输入、缓存与输出拆分。` },
  // 服务健康 chip 的 title：「OAuth forwarder: Not enabled」
  { pattern: /^((?:OAuth|API|Grok OAuth) forwarder|Router|Gateway|External forwarders): (.+)$/,
    replace: (m) => `${pickZh(m[1])}：${pickZh(m[2])}` },
  // 服务商连接菜单的「N requests so far」尾段（前面的 requests 已单独翻译）
  { pattern: /^so far$/, replace: () => "（累计）" },
  // 状态页 · 上下文效率：有估算事件时会在同一文本节点里再追加一句
  { pattern: /^(.+?)\.\s*([\d.,]+) events? used estimated input tokens?\.$/,
    replace: (m) => `${pickZh(m[1])}。${m[2]} 个事件使用了估算输入 token。` },
  // 模型行 · 子代理推理强度（aria-label）：`<模型名> <服务商> subagent thinking effort`
  { pattern: /^(.+?) (Anthropic API|Cerebras|Chutes|ClinePass|Command Code Messages|Command Code|Custom|DeepSeek API|Devin CLI \(Cascade\)|Fireworks AI|GitHub Copilot|Google Antigravity OAuth|Google Gemini API|Groq|Hugging Face Router|Kilo Free|Kimi Code OAuth|Kimi Platform API \(China\)|Kimi Platform API \(Global\)|LM Studio \(Local\)|Local \(Ollama\)|Meta API|MiniMax Token Plan|Mistral AI|NVIDIA NIM|NanoGPT|Nous Research \(Hermes\)|Ollama Cloud|OpenAI native|OpenCode Free Responses|OpenCode Free|OpenRouter|OrcaRouter|Qwen \(Alibaba Plan\)|SiliconFlow|Together AI|Venice|Z\.ai API|Z\.ai GLM Coding Plan|opencode Go\/Zen|opencode Messages|opencode Responses|opencode Zen|xAI Grok API|xAI Grok OAuth) subagent thinking effort$/,
    replace: (m) => `${m[1]}（经 ${pickZh(m[2])}）的子代理推理强度` },
  // 带变量运行的错误文案（IPC / 命令运行器抛出的那些）
  { pattern: /^(.+?) is not installed or configured\.$/, replace: (m) => `${pickZh(m[1])} 未安装或未配置。` },
  { pattern: /^(.+?) does not accept an API credential\.$/, replace: (m) => `${m[1]} 不接受 API 凭据。` },
  { pattern: /^(.+?) does not support CLI sign-in\.$/, replace: (m) => `${m[1]} 不支持 CLI 登录。` },
  { pattern: /^(.+?) has no router-managed credential to remove\.$/, replace: (m) => `${m[1]} 没有由路由器管理的凭据可移除。` },
  { pattern: /^Interactive sign-in is not available for (.+?)\.$/, replace: (m) => `${m[1]} 不支持交互式登录。` },
  { pattern: /^(.+?) sessions resume in an interactive terminal\.$/,
    replace: (m) => `${pickZh(m[1])} 会话需在交互式终端中恢复。` },
  { pattern: /^Retention TTL must be between (\d+) and (\d+) days\.$/,
    replace: (m) => `保留时长必须在 ${m[1]} 到 ${m[2]} 天之间。` },
  { pattern: /^The official (.+?) CLI was not found after installation\.$/,
    replace: (m) => `安装后仍未找到官方 ${m[1]} CLI。` },
  { pattern: /^Could not open the default browser:\s*(.+)$/, replace: (m) => `无法打开默认浏览器：${pickZh(m[1])}` },
  { pattern: /^Unknown model:\s*(.+)$/, replace: (m) => `未知模型：${m[1]}` },
  { pattern: /^Unknown provider catalog:\s*(.+)$/, replace: (m) => `未知服务商目录：${m[1]}` },
  { pattern: /^Unknown provider:\s*(.+)$/, replace: (m) => `未知服务商：${m[1]}` },
  { pattern: /^Vision engine is not currently available:\s*(.+?)\.$/,
    replace: (m) => `视觉引擎当前不可用：${pickZh(m[1])}。` },
  { pattern: /^(.+?) must be one of:\s*(.+)$/, replace: (m) => `${m[1]} 必须是以下之一：${m[2]}` },
  // 用量页 · 配额事实里的百分比（服务端 unit 就是 "percent"）
  { pattern: /^([\d.,]+) percent$/, replace: (m) => `${m[1]}%` },
  // 用量页 · 图表 aria-label：「Daily router token usage ...」
  { pattern: /^(Hourly|Daily) router token usage(.+)$/,
    replace: (m) => `${m[1] === "Hourly" ? "每小时" : "每日"}路由器 token 用量${pickZh(m[2])}` },
  // 用量页 · 来源卡片的 title：「ChatGPT · measured by this router — ...」
  { pattern: /^(.+?) · measured by this router — (.+)$/,
    replace: (m) => `${pickZh(m[1])} · 由本路由器实测 — ${pickZh(m[2])}` },
  { pattern: /^(.+?) · measured by this router$/, replace: (m) => `${pickZh(m[1])} · 由本路由器实测` },
  // 用量页 · 图表分段的日期范围说明（小写 selected）
  { pattern: /^selected (\d+)-day range$/, replace: (m) => `所选 ${m[1]} 天范围` },
  // 操作完成/失败的 toast：「<动作> completed.」
  { pattern: /^(.+?) completed\.$/, replace: (m) => `${pickZh(m[1])} 已完成。` },
  { pattern: /^(.+?) failed\.$/, replace: (m) => `${pickZh(m[1])} 失败。` },
  // 这些动作名会先拼进 toast，再整句落到界面上
  { pattern: /^Install (.+)$/, replace: (m) => `安装 ${m[1]}` },
  { pattern: /^Download (.+)$/, replace: (m) => `下载 ${m[1]}` },
  { pattern: /^Measure (.+)$/, replace: (m) => `测量 ${m[1]}` },
  { pattern: /^Benchmark (.+)$/, replace: (m) => `基准测试 ${m[1]}` },
  { pattern: /^Use (.+?) as image reader$/, replace: (m) => `把 ${m[1]} 用作图片读取器` },
  { pattern: /^Update (.+)$/, replace: (m) => `更新 ${pickZh(m[1])}` },
  { pattern: /^Login (.+)$/, replace: (m) => `登录 ${pickZh(m[1])}` },
  { pattern: /^Open (.+)$/, replace: (m) => `打开 ${pickZh(m[1])}` },
  // 标题栏「进行中」提示：主进程发来的是 IPC 处理器名
  { pattern: /^([a-z][A-Za-z0-9]*) (?:started|is running)$/,
    replace: (m) => `${OPERATION_ZH[m[1]] ?? m[1]}…` },
  { pattern: /^([a-z][A-Za-z0-9]*) (completed|failed)$/,
    replace: (m) => `${OPERATION_ZH[m[1]] ?? m[1]}${m[2] === "completed" ? "已完成" : "失败"}` },
  // 速度榜的成功样本数
  { pattern: /^([\d.,]+) successful samples$/, replace: (m) => `${m[1]} 个成功样本` },
  // 订阅账户选择器的 aria-label
  { pattern: /^Select ChatGPT account:\s*(.+)$/, replace: (m) => `选择 ChatGPT 账户：${m[1]}` },
  { pattern: /^Selected ChatGPT account:\s*(.+)$/, replace: (m) => `已选择 ChatGPT 账户：${m[1]}` },
  { pattern: /^Using (.+?) for Cursor's private connector\.$/,
    replace: (m) => `Cursor 私有连接器将使用 ${m[1]}。` },
  // Electron 会把 IPC 失败包成「Error invoking remote method 'router-control:x': Error: …」。
  // 这层前缀对用户没有意义，直接换成内层消息。
  { pattern: /^Error invoking remote method '[^']*':\s*(?:Error:\s*)?(.+)$/,
    replace: (m) => `${pickZh(m[1])}` },
];

// D10：第二轮补漏。这一批来自「包含隐藏节点与 title/aria-label 属性」的深扫，
// 主要是悬停才出现的 tooltip、看板卡片的读屏串、以及模型页的动作提示。
const D10: Record<string, string> = {
  // 总览 · 图表与看板
  "Router state": "路由器状态",
  "Next quota reset": "下次配额重置",
  "Lowest allowance": "最低配额",
  "tokens not reported": "未上报 token",
  "Token count not reported": "未上报 token 计数",
  "Token count not reported.": "未上报 token 计数。",
  "The upstream response did not include token counts.": "上游响应未包含 token 计数。",
  "Providers usage breakdown": "各服务商用量明细",
  "Not measured": "未测量",
  "Not reported": "未上报",
  "sum of provider rows": "各服务商行合计",
  "sum of recent event details": "近期事件明细合计",

  // 用量
  "All retained": "全部保留",
  "All retained · router": "全部保留 · 路由器",
  "cache excluded": "不含缓存",
  "included in input": "计入输入",
  "not this range": "不在当前范围",
  "Sum of every provider row": "各服务商行合计",
  "Same subscription OpenAI reports below, counted here across all retained router events; the two totals are not comparable":
    "与下方 OpenAI 上报的是同一订阅，但此处统计全部保留的路由事件；两个总量不可直接比较",
  Quota: "配额",

  // 状态
  Unmetered: "未计量",
  Showing: "显示",

  // 模型
  Route: "路由",
  Default: "默认",
  Input: "输入",
  Context: "上下文",
  Thinking: "思考",
  Subagents: "子代理",
  Connect: "连接",
  "Native Codex route": "Codex 原生路由",
  "Provider API route": "服务商 API 路由",
  "Messages API route": "Messages API 路由",
  "Free provider route": "免费服务商路由",
  "Search models": "搜索模型",

  // 设置
  "Collapse sidebar": "收起侧边栏",
  "Expand sidebar": "展开侧边栏",
  "Switch to dark theme": "切换到深色主题",
  "Switch to light theme": "切换到浅色主题",
  "Refresh Settings": "刷新设置",
  "Open Codex": "打开 Codex",

  // 本地
  "This uncensored checkpoint intentionally weakens model safeguards. The router binds it to loopback only; treat its output and any generated tool arguments as untrusted.":
    "该未审查权重有意削弱了模型安全防护。路由器只把它绑定到回环地址；其输出和它生成的任何工具参数都应视为不可信。",
};

// D11：第三轮补漏。这一批来自「静态收割全部 TSX 文案」，专门补**弹窗 / 抽屉 / 搜索面板 /
// 角标**里的漏网 —— 这些只在点击后才出现，之前按页面扫运行时 DOM 时永远看不到。
const D11: Record<string, string> = {
  // 凭据弹窗
  "Save credential": "保存凭据",
  // 页头动作角标
  "Working…": "处理中…",
  Adding: "添加中",
  Added: "已添加",
  Active: "活跃中",
  Current: "当前",
  "Window controls": "窗口控制",
  // 账户与登录状态
  Login: "登录",
  "Sign in again": "重新登录",
  "Sign-in required": "需要登录",
  "Session expired": "会话已过期",
  "Saving account": "正在保存账户",
  "Signed in": "已登录",
  "Signed-in account": "已登录账户",
  // 用量口径
  Used: "已用",
  Remaining: "剩余",
  Limit: "限额",
  "Secondary limit": "次级限额",
  // 本地与 Harness
  "Size unknown": "大小未知",
  Hostname: "主机名",
  // 搜索面板
  "Search sections": "搜索板块",
  Navigate: "导航",
  // 提示消息
  Error: "错误",
  Started: "已启动",
  // 用量口径（服务端返回的运行时文案）
  "API balance": "API 余额",
  "Plus plan": "Plus 方案",
  // 状态与路由
  "OAuth route": "OAuth 路由",
  "Open Codex or its official site": "打开 Codex 或其官网",
  "This router · all providers — Sum of every provider measured by this router over its local ledger; excludes account usage reported by providers":
    "本路由器 · 全部服务商 — 各服务商在本路由器本地账本上的实测合计；不含服务商上报的账户用量",
};

// D12：第四轮补漏。这一批有两个来源：
//   1. 路由服务与 config/*.json 直接输出的英文数据（服务商 planNote / anonymousNote、
//      配额窗口与额度名称）——它们不在 TSX 里，只能按渲染出来的整句匹配；
//   2. JSX 文本子节点与弹窗正文的静态收割结果 —— 其中若干句会被通用规则
//      （如 ^Remove (.+)$）拆成半中半英，所以整句译文必须放进精确表，精确表先于规则命中。
const D12: Record<string, string> = {
  // —— 服务商 planNote / anonymousNote（config/*/*.json）——
  "Every Command Code plan except Go includes Provider API access; GOAT, Pro, Max, Team, and Provider accounts use this API and meter against their own credits.":
    "除 Go 之外的 Command Code 方案都包含 Provider API 访问权限；GOAT、Pro、Max、Team 与 Provider 账户使用该 API，并从各自额度中计量。",
  "Requires Copilot access. After connecting, run ./bin/curate-models github-copilot.":
    "需要 Copilot 访问权限。连接后请运行 ./bin/curate-models github-copilot。",
  "Requires an active ClinePass subscription.": "需要有效的 ClinePass 订阅。",
  "Runs on this machine. Start Ollama before using these models.":
    "在本机运行。使用这些模型前请先启动 Ollama。",
  "Runs on this machine. Start the LM Studio local server before using these models.":
    "在本机运行。使用这些模型前请先启动 LM Studio 本地服务器。",
  "Keys are not interchangeable with the global platform: create this one at platform.moonshot.cn.":
    "密钥与全球平台不通用：这一个要在 platform.moonshot.cn 创建。",
  "The pay-per-token platform key is a different credential from the GLM Coding Plan key; a Coding Plan key is not billable on this endpoint.":
    "按量计费平台密钥与 GLM 编程套餐密钥是两个不同的凭据；编程套餐密钥无法在此端点计费。",
  "Venice API access needs a Pro account (the low-rate-limit Explorer tier), a USD balance, or staked VVV that grants VCU; a free Venice account has no API entitlement.":
    "Venice API 访问需要 Pro 账户（限额较低的 Explorer 档）、美元余额，或可换取 VCU 的 VVV 质押；免费的 Venice 账户没有任何 API 权益。",
  "Each model here names its own endpoint. Enabling the provider costs nothing; a model that needs a key says so on its own row.":
    "这里的每个模型都指向自己的端点。启用该服务商本身不产生费用；需要密钥的模型会在各自的行上说明。",
  "Reuses the session `devin auth login` stores in the official Devin CLI and spends that account's ACU credits. Which models the account may run is decided server-side, so this provider ships no preselected models: run `bin/curate-models devin-cli` after signing in. Cognition publishes no model API, so the transport is unversioned and can change without notice.":
    "复用官方 Devin CLI 中 `devin auth login` 保存的会话，并消耗该账户的 ACU 额度。账户可以运行哪些模型由服务端决定，因此本服务商不预置模型：登录后请运行 `bin/curate-models devin-cli`。Cognition 未发布模型 API，传输方式没有版本号，可能随时变化。",
  "No API key is needed for Kilo :free models. Use at your own risk: anonymous access is limited per IP, shared by everyone behind it, and can be narrowed or withdrawn without notice. The free catalog can change.":
    "Kilo :free 模型无需 API 密钥。请自行承担风险：匿名访问按 IP 限流、同一 IP 后所有人共享，且可能在不通知的情况下收紧或取消。免费目录也可能变化。",
  "No API key is needed for OpenCode Zen free models. Use at your own risk: access is a published exception, not an entitlement, and the free catalog and limits can change without notice.":
    "OpenCode Zen 免费模型无需 API 密钥。请自行承担风险：该访问是公开的例外而非法定权益，免费目录与限额可能随时变化。",
  "No API key is needed for Muse Spark contributor free models. This internal Responses route accepts only documented free models. Use at your own risk: access is a published exception, not an entitlement, and limits can change without notice.":
    "Muse Spark 贡献者免费模型无需 API 密钥。这条内部 Responses 路由只接受文档中列出的免费模型。请自行承担风险：该访问是公开的例外而非法定权益，限额可能随时变化。",

  // —— 路由服务返回的配额窗口与额度名称（src/provider-account-usage.mjs）——
  // 三个窗口统一叫法：5 小时 / 每周 / 每月，排序也按这个顺序。
  "Monthly limit": "每月上限",
  "Daily limit": "每日上限",
  "Extra credits": "额外额度",
  "Credit balance": "额度余额",
  "Prepaid credits": "预付额度",
  "Pay-as-you-go": "按量计费",
  Balance: "余额",
  "Usage limit": "用量上限",
  Historical: "历史",
  "Command Code dashboard": "Command Code 控制台",

  // —— 弹窗正文与整句文案 ——
  "Remove local model": "移除本地模型",
  "This deletes the model weights from this machine.": "这会从本机删除该模型的权重。",
  "You can download it again later.": "之后可以重新下载。",
  "Remove ChatGPT subscription account?": "移除 ChatGPT 订阅账户？",
  "This revokes the pool entry and deletes its isolated Codex login profile.":
    "这会撤销账户池中的该条目，并删除它独立的 Codex 登录配置。",
  "The account's local OAuth profile will be removed. If it is active, close Codex first; another saved account must be activated before removal.":
    "该账户的本地 OAuth 配置会被删除。如果它当前处于活动状态，请先关闭 Codex；删除前必须先激活另一个已保存的账户。",
  "Remove account": "移除账户",
  Select: "选择",
  Selected: "已选择",
  "Show more": "显示更多",
  "Show fewer": "显示更少",
  "Everything your connected providers offer. Adding a model makes it available to the router; use the picker switch to show it in your clients.":
    "这里列出已连接服务商提供的全部模型。添加后即可供路由器使用；再用选择器开关把它显示到你的客户端里。",
  "Run the explicit live compatibility test; it sends a small prompt and uses provider quota.":
    "运行一次显式的实时兼容性测试；它会发送一小段提示词并消耗服务商配额。",
  "Account-level usage as OpenAI reports it; this view is not added to the all-router total":
    "OpenAI 上报的账户级用量；此视图不计入全路由器总量",
  "Recent event telemetry; retained daily totals are unavailable":
    "近期事件遥测；没有可用的按日累计总量",
  "OpenAI supplies daily account totals only here; use “This router · all providers” for regular input, cached input, and output.":
    "OpenAI 只在这里提供按日账户总量；常规输入、缓存输入与输出请查看“本路由器 · 全部服务商”。",
  "The account API reports a daily total for this day; input, cached input, and output are not available.":
    "账户 API 只上报该日期的每日总量；输入、缓存输入与输出不可用。",
  "90-day ledger": "90 天账本",
  "Hourly bars use the latest 1,000 event details; this router does not publish an hourly rollup.":
    "每小时柱状图使用最新 1,000 条事件明细；本路由器未发布每小时汇总。",
  "The detailed event view is capped at 1,000 routed events; the windows above use accumulated cache buckets.":
    "详细事件视图最多显示 1,000 条路由事件；上方的窗口使用累计缓存数据桶。",
  // 运行时被拆成多个文本节点的片段（React 会把 {表达式} 与字面量分成相邻节点）
  dashboard: "控制台",
  "total tokens": "token 合计",
  Across: "覆盖",
  "recent events": "个近期事件",
  "Sign-in": "登录",
  "Per-model endpoints": "按模型指定端点",
  "ChatGPT (native)": "ChatGPT（原生）",
  // 会先拼进「<动作> completed.」toast 的动作名
  "Add ChatGPT subscription account": "添加 ChatGPT 订阅账户",
  "Remove ChatGPT subscription account": "移除 ChatGPT 订阅账户",
  "Switch ChatGPT account": "切换 ChatGPT 账户",
  "Start local runtime": "启动本地运行时",
  "Update local runtime": "更新本地运行时",
  "Start Qwen MLX installation": "开始 Qwen MLX 安装",
  "to use this route.": "即可使用此路由。",
  // Cursor/Cloudflare 配置过程中的进度句（主进程 progress() 上报）
  "Cloudflare connector installed. Refreshing Cursor setup…":
    "Cloudflare 连接器已安装，正在刷新 Cursor 配置…",
  "Cloudflare authorization complete. Refreshing Cursor setup…":
    "Cloudflare 授权已完成，正在刷新 Cursor 配置…",
  "Cloudflare connector installed.": "Cloudflare 连接器已安装。",
  "Cloudflare authorization complete.": "Cloudflare 授权已完成。",
  "Fully quit Cursor. Setup will resume here automatically…":
    "请完全退出 Cursor。配置会自动在这里继续…",
  "Creating the isolated Cursor connector and publishing routed models…":
    "正在创建独立的 Cursor 连接器并发布已路由模型…",
  "Cursor routing verified. Opening Cursor…": "Cursor 路由已验证，正在打开 Cursor…",
  // 添加模型抽屉里的尾部说明（数字两侧分成两个文本节点）
  Reload: "重新加载",
  "Lists are stored locally and re-read in the background once a day. Up to":
    "列表会保存在本地，并在后台每天重新读取一次，每次最多",
  "at a time.": "个。",
  "The router operation did not finish.": "路由器操作未完成。",
  // 服务商模型发现（模型目录）被安全策略拒绝时的提示
  "Provider host resolution returned no valid addresses.": "服务商域名解析未返回有效地址。",
  "Provider host could not be resolved.": "无法解析服务商域名。",
  "Model discovery endpoint must be an absolute HTTP(S) URL.":
    "模型发现端点必须是完整的 HTTP(S) 地址。",
  "Model discovery endpoint must be a credential-free HTTP(S) URL without query or fragment.":
    "模型发现端点必须是不含凭据、查询串和片段的 HTTP(S) 地址。",
  "Model discovery refused a cross-origin redirect.": "模型发现拒绝跨域重定向。",
  "Model discovery refused a private or loopback endpoint.":
    "模型发现被拒绝：该端点属于私有地址或回环地址。",
  "Credential-bearing model discovery requires HTTPS for non-private endpoints.":
    "携带凭据的模型发现对非私有端点必须使用 HTTPS。",
  "Provider model catalog exceeds the response size limit.": "服务商模型目录超出响应大小限制。",
  "Provider model catalog response has no readable body.": "服务商模型目录响应没有可读内容。",
  "Provider returned an invalid or oversized model catalog.": "服务商返回的模型目录无效或过大。",
  "Model discovery requires a fetch implementation.": "模型发现缺少可用的 fetch 实现。",
  "Model discovery refused a proxy transport that independently resolves the provider destination.":
    "模型发现拒绝使用会自行解析服务商地址的代理传输。",
  "Provider model discovery exceeded the redirect limit.": "服务商模型发现超出了重定向次数上限。",
  "Provider model discovery returned a redirect without a location.":
    "服务商模型发现返回了缺少 location 的重定向。",
  "Provider model catalog did not return JSON.": "服务商模型目录没有返回 JSON。",
  "Provider returned invalid JSON for its model catalog.": "服务商返回的模型目录 JSON 无效。",

  // —— 操作失败时弹出的错误文案（electron/ipc.mjs、command-runner.mjs 抛出）——
  "A hostname or public URL applies only to Cursor setup.": "主机名或公共 URL 仅用于 Cursor 配置。",
  "A model override is supported only for Codex terminal resumes.": "只有 Codex 终端恢复会话支持覆盖模型。",
  "A trusted external node.exe is required to refresh the Windows Control Center.":
    "刷新 Windows 控制中心需要一个受信任的外部 node.exe。",
  "Account label is invalid.": "账户名称无效。",
  "Application window is unavailable.": "应用窗口不可用。",
  "Automatic Cloudflare connector installation is unavailable on this machine.":
    "本机无法自动安装 Cloudflare 连接器。",
  "Browser command is invalid.": "浏览器命令无效。",
  "Browser command is unavailable.": "浏览器命令不可用。",
  "Browser environment is invalid.": "浏览器环境无效。",
  "Browser login completion timeout is invalid.": "浏览器登录完成超时设置无效。",
  "Browser process ownership callback is invalid.": "浏览器进程归属回调无效。",
  "Cannot remove a ChatGPT account while its browser sign-in is in progress.":
    "浏览器登录进行中，无法移除该 ChatGPT 账户。",
  "Certify at most 24 routes at once.": "一次最多认证 24 条路由。",
  "Choose between 1 and 200 provider models.": "请选择 1 到 200 个服务商模型。",
  "Claude Code is not installed. Install the official Claude Code CLI, then refresh Harness.":
    "未安装 Claude Code。请先安装官方 Claude Code CLI，然后刷新工具链。",
  "Cloudflare authorization finished without creating its local certificate.":
    "Cloudflare 授权结束，但没有生成本地证书。",
  "Cloudflare connector command is invalid.": "Cloudflare 连接器命令无效。",
  "Cloudflare connector command is unavailable.": "Cloudflare 连接器命令不可用。",
  "Cloudflare connector finished installing but could not be detected.":
    "Cloudflare 连接器已安装完成，但未能检测到。",
  "Codex CLI is not installed.": "未安装 Codex CLI。",
  "Codex Router source root could not be located.": "无法定位 Codex Router 的源码根目录。",
  "Codex login did not finish before the browser sign-in deadline.":
    "Codex 登录未在浏览器登录超时前完成。",
  "Codex login did not provide an OAuth browser URL.": "Codex 登录未返回 OAuth 浏览器地址。",
  "Codex login exited before providing an OAuth browser URL.":
    "Codex 登录在返回 OAuth 浏览器地址之前就已退出。",
  "Codex task links are unavailable.": "Codex 任务链接不可用。",
  "Could not open Cursor App.": "无法打开 Cursor 应用。",
  "Could not open OpenClaw.": "无法打开 OpenClaw。",
  "Could not open Terminal.": "无法打开终端。",
  "Could not open the Codex desktop app.": "无法打开 Codex 桌面应用。",
  "Credential is invalid.": "凭据无效。",
  "Cursor App is not installed.": "未安装 Cursor 应用。",
  "Cursor is still running. Fully quit it, then click Connect Cursor again.":
    "Cursor 仍在运行。请完全退出后再次点击「连接 Cursor」。",
  "Cursor setup finished without publishing its routed model catalog.":
    "Cursor 配置已结束，但没有发布它的路由模型目录。",
  "Cursor was configured but could not be reopened.": "Cursor 已配置完成，但无法重新打开。",
  "DeepSeek Harness started without a browser URL.": "DeepSeek Harness 已启动，但没有返回浏览器地址。",
  "Disconnect the incompatible router-owned Antigravity record before signing in.":
    "登录前请先断开不兼容的、由路由器管理的 Antigravity 记录。",
  "Doctor returned invalid JSON.": "诊断返回了无效的 JSON。",
  "Each picker model needs a boolean visible value.": "每个选择器模型的 visible 值必须是布尔值。",
  "External links are unavailable.": "外部链接不可用。",
  "Harness command is invalid.": "工具链命令无效。",
  "Harness command is unavailable.": "工具链命令不可用。",
  "Installing the MLX runtime and model requires explicit consent.":
    "安装 MLX 运行时与模型需要你先明确同意。",
  "Invalid router script.": "路由器脚本无效。",
  "Local model URL is invalid.": "本地模型 URL 无效。",
  "Local model reference is invalid.": "本地模型标识无效。",
  "Only HTTPS links can be opened.": "只能打开 HTTPS 链接。",
  "Opening Cloudflare installation instructions is unavailable.":
    "无法打开 Cloudflare 安装说明。",
  "Opening Cursor App is unavailable.": "无法打开 Cursor 应用。",
  "Opening DeepSeek Harness is unavailable.": "无法打开 DeepSeek Harness。",
  "Opening a terminal from the Control Center is currently available on macOS only.":
    "目前只有 macOS 支持从控制中心打开终端。",
  "Opening desktop apps is unavailable.": "无法打开桌面应用。",
  "Opening the official client site is unavailable.": "无法打开官方客户端网站。",
  "Provider CLI sign-in must be run in your own terminal on Windows or Linux.":
    "在 Windows 或 Linux 上，服务商 CLI 登录必须在你自己的终端里运行。",
  "Provider discovery returned invalid JSON.": "服务商发现返回了无效的 JSON。",
  "Provider model ids must be unique.": "服务商模型 id 不能重复。",
  "Repair returned invalid JSON.": "修复返回了无效的 JSON。",
  "Restore this archived task in its owning harness before resuming it.":
    "请先在这条任务所属的工具链中恢复它，然后再继续。",
  "Retention TTL must be a whole number of days.": "保留时长必须是整天数。",
  "Router command output exceeded its limit.": "路由器命令输出超出限制。",
  "Router command timed out.": "路由器命令超时。",
  "Router returned invalid JSON.": "路由器返回了无效的 JSON。",
  "Router script is unavailable.": "路由器脚本不可用。",
  "That URL does not contain an Ollama model tag.": "该 URL 不含 Ollama 模型标签。",
  "That session is not available in its harness store.": "该会话在其工具链存储中不存在。",
  "The Control Center does not include agent bridge probing support.":
    "此控制中心不包含代理桥接探测支持。",
  "The Control Center does not include agent bridge status support.":
    "此控制中心不包含代理桥接状态支持。",
  "The Control Center does not match the installed Codex Router control protocol. Install or update the router and desktop app from the same build, then reopen the app.":
    "此控制中心与已安装的 Codex Router 控制协议不匹配。请用同一构建安装或更新路由器与桌面应用，然后重新打开应用。",
  "The default browser opener is unavailable.": "默认浏览器打开器不可用。",
  "The inherited owner-signal cleanup budget is invalid.": "继承的属主信号清理预算无效。",
  "The installed router cannot detect running Cursor processes.":
    "已安装的路由器无法检测正在运行的 Cursor 进程。",
  "The installed router does not expose direct health reads.":
    "已安装的路由器没有提供直接读取健康状态的接口。",
  "The installed router does not support automatic Cursor hostname discovery.":
    "已安装的路由器不支持自动发现 Cursor 主机名。",
  "The nested command tree exhausted its owner-signal cleanup reserve.":
    "嵌套命令树用尽了属主信号清理预留量。",
  "The saved login changed before removal. Refresh the account list and try again.":
    "保存的登录在移除前发生了变化。请刷新账户列表后重试。",
  "The saved login changed before retry. Refresh the account list and try again.":
    "保存的登录在重试前发生了变化。请刷新账户列表后重试。",
  "The session workspace is unavailable.": "会话工作区不可用。",
  "The subscription account is not active.": "该订阅账户未激活。",
  "The subscription account is not registered.": "该订阅账户未注册。",
  "The subscription account profile is not isolated from the primary Codex login.":
    "该订阅账户配置未与主 Codex 登录隔离。",
  "The subscription account profile is unavailable.": "该订阅账户配置不可用。",
  "URL is invalid.": "URL 无效。",
  "Untrusted IPC sender.": "不受信任的 IPC 发送方。",
  "Use an HTTPS Ollama model-page URL.": "请使用 HTTPS 的 Ollama 模型页 URL。",
  "Use either a managed hostname or an existing public URL, not both.":
    "托管主机名与现有公共 URL 只能提供其中一个。",
  "VITE_DEV_SERVER_URL must be a loopback HTTP URL without credentials.":
    "VITE_DEV_SERVER_URL 必须是不含凭据的回环 HTTP URL。",
  "VITE_DEV_SERVER_URL must be a loopback HTTP URL.": "VITE_DEV_SERVER_URL 必须是回环 HTTP URL。",
  "enabled must be boolean.": "enabled 必须是布尔值。",
  "force must be boolean.": "force 必须是布尔值。",
  "load failed": "加载失败",
  "models must be an array.": "models 必须是数组。",
  "refresh must be boolean.": "refresh 必须是布尔值。",
  "selectAll must be boolean.": "selectAll 必须是布尔值。",
  "slugs must be a non-empty array.": "slugs 必须是非空数组。",
  "visible must be boolean.": "visible 必须是布尔值。",
  "yes must be boolean.": "yes 必须是布尔值。",
};

// D13：模型页「测试连接」按钮。每个账户行末尾的那颗按钮会发一次最小实时请求，
// 按状态换文案（测试 / 测试中… / 连接正常 / 连接失败），所以这四个词必须在精确表里；
// 表头新增的 Test 列与按钮共用同一个词，也归在这里。
const D13: Record<string, string> = {
  Test: "测试",
  "Testing…": "测试中…",
  Works: "连接正常",
  Failed: "连接失败",
  "live response marker verified": "已通过实时响应标记校验",
  "Send one minimal live request through this route. It spends a little of this account's quota.":
    "向该路由发送一次最小实时请求，会消耗此账户少量配额。",
  "The route answered.": "该路由已响应。",
  "The route did not answer.": "该路由没有响应。",
  "The route test did not finish.": "路由测试未完成。",
  "Live response verified.": "实时响应已验证。",
  "No response.": "没有响应。",
  "live response marker missing": "未收到实时响应标记",
  "A live route test may use provider quota; pass --live --yes to confirm.":
    "实时路由测试可能消耗服务商配额；请加 --live --yes 确认。",
  "The installed router cannot run live route tests. Update it and reopen this app.":
    "已安装的路由器无法执行实时路由测试。请更新后重新打开此应用。",
};

export const ZH_EXACT: Record<string, string> = Object.assign({}, D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13);

// ---------------------------------------------------------------------------
// 应用器
// ---------------------------------------------------------------------------

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "NOSCRIPT", "SVG"]);
const TEXT_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt", "aria-valuetext"];
const LANGUAGE_STORAGE_KEY = "codex-router-language";

const textOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();

function isSkipped(node: Node | null): boolean {
  let element = node instanceof Element ? node : node?.parentElement ?? null;
  while (element) {
    if (SKIP_TAGS.has(element.tagName)) return true;
    if (element.hasAttribute("data-zh-skip")) return true;
    element = element.parentElement;
  }
  return false;
}

function applyTextNode(node: Text): void {
  if (isSkipped(node)) return;
  const translated = translateZhText(node.data);
  if (translated === null || translated === node.data) return;
  // 记账用「翻译前的那一版」，这样切回英文时能还原成界面最后一次渲染的原文。
  textOriginals.set(node, node.data);
  node.data = translated;
}

function restoreTextNode(node: Text): void {
  const original = textOriginals.get(node);
  if (original === undefined) return;
  textOriginals.delete(node);
  if (node.data !== original) node.data = original;
}

function applyAttributes(element: Element): void {
  if (isSkipped(element)) return;
  for (const name of TEXT_ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value === null) continue;
    const translated = translateZhText(value);
    if (translated === null || translated === value) continue;
    let store = attributeOriginals.get(element);
    if (!store) {
      store = new Map<string, string>();
      attributeOriginals.set(element, store);
    }
    if (!store.has(name)) store.set(name, value);
    element.setAttribute(name, translated);
  }
}

function restoreAttributes(element: Element): void {
  const store = attributeOriginals.get(element);
  if (!store) return;
  for (const [name, value] of store) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }
  attributeOriginals.delete(element);
}

function visitSubtree(root: Node, visitElement: (element: Element) => void, visitText: (node: Text) => void): void {
  if (root.nodeType === Node.TEXT_NODE) {
    visitText(root as Text);
    return;
  }
  if (root.nodeType === Node.ELEMENT_NODE) visitElement(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) visitText(current as Text);
    else if (current.nodeType === Node.ELEMENT_NODE) visitElement(current as Element);
    current = walker.nextNode();
  }
}

function applySubtree(root: Node): void {
  visitSubtree(root, applyAttributes, applyTextNode);
}

function restoreSubtree(root: Node): void {
  visitSubtree(root, restoreAttributes, restoreTextNode);
}

function storedLanguage(): string {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function interfaceLanguageIsChinese(): boolean {
  const stored = storedLanguage();
  if (stored) return stored.toLowerCase().startsWith("zh");
  const declared = typeof document === "undefined" ? "" : document.documentElement?.lang ?? "";
  if (declared) return declared.toLowerCase().startsWith("zh");
  return (typeof navigator === "undefined" ? "" : navigator.language ?? "").toLowerCase().startsWith("zh");
}

export interface UiZhController {
  apply: () => void;
  restore: () => void;
  active: () => boolean;
  translate: (raw: string) => string | null;
}

export function installUiZh(): UiZhController {
  let active = false;
  let observer: MutationObserver | null = null;

  const controller: UiZhController = {
    apply: () => {
      if (typeof document !== "undefined" && document.body) applySubtree(document.body);
    },
    restore: () => {
      if (typeof document !== "undefined" && document.body) restoreSubtree(document.body);
    },
    active: () => active,
    translate: translateZhText,
  };

  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return controller;

  const start = (): void => {
    if (active || !document.body) return;
    active = true;
    applySubtree(document.body);
    observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") applyTextNode(record.target as Text);
        else if (record.type === "attributes" && record.target instanceof Element) applyAttributes(record.target);
        else for (const node of Array.from(record.addedNodes)) applySubtree(node);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TEXT_ATTRIBUTES,
    });
  };

  const stop = (): void => {
    if (!active) return;
    active = false;
    observer?.disconnect();
    observer = null;
    if (document.body) restoreSubtree(document.body);
  };

  const sync = (): void => {
    if (interfaceLanguageIsChinese()) start();
    else stop();
  };

  sync();
  // 应用切换语言时会改写 <html lang>，直接监听这个信号最可靠。
  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  // 兜底：面板等路径可能只改 localStorage 与界面文本，不写 lang。
  window.setInterval(sync, 1500);

  return controller;
}
