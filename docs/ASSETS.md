# 素材与生成说明

当前横幅与 32 道菜图通过内置 **image_gen** 生成。菜图为每道菜分别生成的摄影风格示意图，统一暖色自然光、浅色陶瓷餐具和木质桌面；厨房横幅根据用户提供的粉色 Hello Kitty 设计方向生成。网页结构、文字、卡片与交互由前端代码实现。

## 当前素材

- 网页菜图：`public/assets/food/d1-v2.jpg` 至 `d32-v2.jpg`，宽 900 px。
- 小程序菜图：`miniprogram/assets/food/d1-v2.jpg` 至 `d32-v2.jpg`，宽 480 px。
- 厨房横幅：网页 `public/assets/kitty-kitchen-v2.jpg`；小程序 `miniprogram/assets/kitty-kitchen-v2.jpg`。
- [生成提示词与素材映射](food-image-prompts.json)：共同风格提示词、每道菜的内容要求、横幅完整提示词以及文件路径。
- 本地保留的生成原图：`artifacts/food-originals/`；原图不进入发布包。
- `scripts/prepare-food-images.js` 使用 Sharp 从原图导出不同尺寸的 JPG。工程已经包含全部导出图片，运行不需要重新生成。

旧的类别照片已从小程序主包中移除，本地备份在 `artifacts/previous-food/`。自定义新菜尚无照片时使用所选图标；32 道内置菜品均有对应菜图。

## 菜品与图片

| 菜品 | 文件 |
| --- | --- |
| 番茄炒鸡蛋 | d13-v2.jpg |
| 辣椒炒肉 | d14-v2.jpg |
| 红烧肉 | d15-v2.jpg |
| 宫保鸡丁 | d16-v2.jpg |
| 鱼香肉丝 | d17-v2.jpg |
| 麻婆豆腐 | d18-v2.jpg |
| 回锅肉 | d19-v2.jpg |
| 糖醋里脊 | d20-v2.jpg |
| 可乐鸡翅 | d21-v2.jpg |
| 土豆炖牛腩 | d22-v2.jpg |
| 酸辣土豆丝 | d23-v2.jpg |
| 地三鲜 | d24-v2.jpg |
| 手撕包菜 | d25-v2.jpg |
| 蒜蓉西兰花 | d26-v2.jpg |
| 香菇青菜 | d27-v2.jpg |
| 凉拌黄瓜 | d28-v2.jpg |
| 紫菜蛋花汤 | d29-v2.jpg |
| 冬瓜排骨汤 | d30-v2.jpg |
| 清蒸鲈鱼 | d31-v2.jpg |
| 蛋炒饭 | d32-v2.jpg |
| 田园藜麦能量碗 | d1-v2.jpg |
| 香橙鸡丁 | d2-v2.jpg |
| 黑椒牛肉炒面 | d3-v2.jpg |
| 牛油果鲜蔬沙拉 | d4-v2.jpg |
| 鲜虾黄金炒饭 | d5-v2.jpg |
| 青酱蘑菇意面 | d6-v2.jpg |
| 香浓南瓜汤 | d7-v2.jpg |
| 韩式石锅拌饭 | d8-v2.jpg |
| 手作小笼包 | d9-v2.jpg |
| 香煎三文鱼 | d10-v2.jpg |
| 番茄蔬菜浓汤 | d11-v2.jpg |
| 双人分享披萨 | d12-v2.jpg |

## 页面预览

[手机菜单](previews/mobile.png) · [手机订单](previews/mobile-orders.png) · [手机已选](previews/mobile-cart.png) · [桌面菜单](previews/desktop.png) · [原生菜单模板](previews/native-menu.png)

原生页面预览来自编译后的 WXML 树在浏览器中的渲染，用于布局检查，不是微信真机截图。
