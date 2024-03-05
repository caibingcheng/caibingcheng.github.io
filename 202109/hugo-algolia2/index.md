# Hugo搜索工具hugo-algolia2


本站原来使用lunr.js作为搜索引擎，在使用过程中发现一些问题：

<!--more-->


1. 客户端需要下载索引文件
2. 会出现搜索失效的情况

故本站改为algolia搜索，使用hugo-algolia创建algolia索引文件时发现，hugo-algolia仅针对英文分词，并且会包含一些无用词。hugo-algolia项目master分支超过一年未更新，且issue也较长时间未作出回复，所以本项目[hugo-algolia2](https://github.com/caibingcheng/hugo-algolia2) clone自[hugo-algolia](https://github.com/replicatedhq/hugo-algolia)，在其ISC许可下作为单独项目开发。


**本项目持续更新中，如有问题欢迎反馈**

## hugo-algolia2

项目改编自[hugo-algolia](https://github.com/replicatedhq/hugo-algolia), 用于hugo静态内容的搜索.

### New Features

- 修复原项目的一些问题
- 支持自定义URI格式
- 支持按照文件后缀过滤
- 去除无用单词
- 添加中文分词

### Installation

从[npm](https://npmjs.org)安装`hugo-algolia2`

```
npm install hugo-algolia2
```

或者

```
yarn add hugo-algolia2
```

### How does it work?

默认遍历hugo项目的`/content`路径下的文件, 并且按照['html','md']后缀过滤, 并且在`/public`下生成`algolia.json`. 具体配置参数可以使用`hugo-algolia2 --help`.

### Sending to Algolia

在hugo项目根目录下添加配置文件`config.yaml`, 如下:

```
---
baseURL: /
uri: :year:month/:slug

algolia:
  index: "index-name"
  key: "[your API key]"
  appID: "[your app id]"
---
```

URI是访问路径, 需要和hugo的配置相同. key需要填写Admin API Key.

配置之后,
```
hugo-algolia2 -s
```
可以上传algolia配置.
### Github Action
```
name: deploy
on:
  push:
  workflow_dispatch:

jobs:
  generate-algolia:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: caibingcheng/hugo-algolia2@v1
        with:
          input: "./posts/**"
          output: "./algolia.json"
          index: ${{ secrets.ALGOLIA_INDEX }}
          apikey: ${{ secrets.ALGOLIA_APIKEY }}
          appid: ${{ secrets.ALGOLIA_APPID }}

```

## License
同[hugo-algolia](https://github.com/replicatedhq/hugo-algolia), 本项目也使用ISC License.
