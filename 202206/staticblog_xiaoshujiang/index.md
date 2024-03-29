# 静态博客写作新体验-小书匠


关于静态博客的写作方式，我此前是把仓库clone到本地，再通过vscode写作，然后再push回去。大概上个月，我在github的codespace申请通过了，就变为了在codespace上写作，然后再push，但始终和理想的写作体验有差别，不够存粹。

<!--more-->

我需要的就是可以和正常笔记一样的写作方式，不需要每次都pull和push的繁琐过程，直到我发现了[小书匠](http://markdown.xiaoshujiang.com/)。这肯定不是一条广告，只是想分享和推广这种静态博客的写作方式。此外，也有 [“静态博客 , 在线写”](https://jingtaiboke.com/) 可以支持静态博客的写作，但是我并没有体验过该应用，所以后文也不做对比和评价。

在小书匠的帮助下，只需要在初始化的时候配置静态博客文章的存储地址，比如我的文章存储在github，那么我就需要配置一些github的参数，再配置图床的参数就可以了。在填写github token的时候，小书匠明确说明了该token需要的权限，此处好评，因为这是我遇到的一款向用户明确了token权限的应用，有些应用因为未告知所需权限，我就全选了，这样就容易让人担心安全问题。

![小书匠github-token权限](https://bu.dusays.com/2022/06/26/62b881ab1e784.png "小书匠github-token权限")

写作上，小书匠支持很多markdown扩展写法，但是我觉得有点太多了，默认开启的几个扩展也不够友好，比如默认开启了`++`这个符号的扩展，这样在我写`C++`这个词的时候就会渲染成奇怪的格式，容易在写作的时候引起误解。

但是，总归是优点多于缺点，我才决定使用它的。

小书匠支持meta信息的模板功能，这在创建新文章的时候很有用，可以替代`hugo new`的指令，比如我配置了如下模板：
```
---
title: ""
slug: ""
date: <% print(moment().format('YYYY-MM-DDThh:mm:ss+08:00')); %>
lastmod: <% print(moment().format('YYYY-MM-DDThh:mm:ss+08:00')); %>
author: bbing
draft: false
tags: []
categories: []
---

<!--more-->
```
那么在创建新文章的时候，就会在头部插入以上信息，可以看到，可以通过一些简单的指令插入动态的元素，比如时间。

也支持片段功能，但是对我来说，目前没有任何需求。在编辑的时候，也支持动态渲染，类似Typora的功能，所见即所得，编辑界面如下：

![小书匠-编辑界面](https://bu.dusays.com/2022/06/26/62b881ae612c5.png "小书匠-编辑界面")

编辑界面的样式可以自行修改。小书匠对图片插入的支持也很好，在配置好图床信息后，本地图片直接拖拽到文章需要的地方就可以了，小书匠会帮助自动上传，以上图片都是通过直接拖拽插入的。

以上可以满足我对写作的基本需求，但是我还有跨设备跨平台的需求，因为我至少可能会在三台设备上写作，所以会期望在某台设备上编辑后，可以同步到其他设备。小书匠的数据默认保存在本地，无法满足需求，需要开启会员功能才可以开启云同步（各种设置、token、模板、文章等等的同步）。会员价格是40元一年，有没有优惠我就不知道了，这个可能需要寻求官方的帮助，暂不推荐开启80元/两年的会员，虽然该应用存在时间很久了，但是未来能否继续存在还是未知的。如果对小书匠方面提供的云同步不放心的话，可以配置自己的云同步功能（同样需要会员才可）。小书匠的云同步可能会不定期清空数据，所以不能将其作为文章的保存工具，仅仅是同步工具，文章内容的保存还是依赖浏览器的本地存储或第三方存储较好。

如何发布文章？通过热键`Ctrl+S`即可将文章发布到已配好的平台上，但是我不太喜欢该热键。幸好，小书匠是可以修改热键的，我将`Ctrl+S`改为同步保存，这样在按下`Ctrl+S`的时候就不会发布到博客平台上了，如果需要发布，则通过UI点击比较保险。

以上，通过小书匠发布静态博客，不再需要繁琐的pull和push的过程，仅需在第一次的时候做好配置即可，此后就像正常的笔记或者某些平台的博客一样写作就行了。

小书匠的功能远不止上述内容，但是对我足以，如果想注册体验的话，可以填写以下邀请码：275_zq2mwb
