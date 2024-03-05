# codebrowser书签插件


在使用[codebrowser](https://codebrowser.dev/)查阅一些源码的时候, 因为没有书签跳转功能, 有时候追踪调用栈就不是很方便. 因此, 开发了一款用于codebrowser书签功能的油猴插件.

<!--more-->

该项目地址: [https://github.com/caibingcheng/codebrowser-bookmark](https://github.com/caibingcheng/codebrowser-bookmark)

![codebrowser书签插件](https://bu.dusays.com/2023/02/08/63e3adb243308.png "codebrowser书签插件")

主要功能有:

- 点击灰色"小圆点"添加书签
- 点击黑色"小圆点"删除书签
- 点击书签栏的对应书签可以跳转到该书签位置
- 点击书签栏的"-"号可以删除对应书签或对应文件下的所有书签
- 按住顶部bar可以拖动书签栏
- 双击笑脸图标可以显示或者隐藏书签栏

书签信息以明文信息存储在`localStorage`的`code-browser-bookmarks`条目下. 因此, 如果清空了浏览器或者对应域名的`localStorage`也会清空codebrowser的书签.

如需使用, 可以在[greasyfork](https://greasyfork.org/zh-CN/import)导入脚本, 链接如下:

```
https://raw.githubusercontent.com/caibingcheng/codebrowser-bookmark/master/index.js
```

<!-- 目前已知一个使用体验上的问题: 如果是新打开的一个文件, 有概率点击"小圆点"无效, 这时候需要先用鼠标移动到行号上, 先让系统加载行号信息, 当浏览器能够显示行号链接, 然后再点击"小圆点"即可. 这可能和行号的锚点标记时机有关系, 因为请求的文档是不带锚点的, 后续可能依赖其他脚本动态生成锚点. 这也导致在地址栏输入codebrowser带锚点的链接之后, 也是会有概率无法跳转的. -->
