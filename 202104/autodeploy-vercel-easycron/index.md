# 使用vercel和easycron实现自动部署


最近做了一个博客内容聚合的网站[RSSBlog](https://rssblog.vercel.app/), 写入rss链接, 就会定时触发, 获取rss文章列表. 如下:

<!--more-->

![RSSBlog](https://raw.githubusercontent.com/caibingcheng/rssblog/master/public/screenshot.png "RSSBlog")

开发的时候遇到了一个问题, 如何做到定时拉取呢? 这里用到了vercel和easycron.

## vercel

vercel用于部署[RSSBlog](https://rssblog.vercel.app/), 这里不赘述如何部署.

在vercel进入对应的项目页面, 在Setting->Git->Deploy Hooks中,输入Hook Name和Git Branch Name.

Hook Name指Hook链接的名字, 好区分即可. Git Branch Name是待部署的Git分支, 每次访问Hook链接都会根据这个分支重新部署.

可以使用curl访问Hook链接:
```
curl -X POST https://api.vercel.com/v1/integrations/deploy/QmcwKGEbAyFtfybXBxvuSjFT54dc5dRLmAYNB5jxxXsbeZ/hUg65Lj4CV
```

> POST 和 GET 请求都可以触发.

可能得到输出:
```
{
  "job": {
    "id": "A7OcAEEgNRh61p1VZXE1",
    "state": "PENDING",
    "createdAt": 1564399503217
  }
}
```

尽量使用自己的Hook触发, 以免给他人带来不便.

手动访问这个链接太过麻烦, 这时候可以使用easycron.

## EasyCron

进入vercel个人页面, 在Integrations->Marketplace可以找到EasyCron这个工具.

添加工具, 并注册个人账号, 在EasyCron页面可以设置访问链接和定时.

在EasyCron页面点击Cron Job就可以方便的添加定时了.

## github webhooks

除了easycron的定时触发, 我们也可以使用github的webhooks实现事件触发.

在github仓库settings->webhooks目录下, 可以给仓库添加webhooks, 可以实现在某些事件(比如push/star等)发生的情况下, 给某个url发送post请求. 这样我们就可以实现在blog内容更新的时候, 可以给vercel的waline项目的hook连接发送请求, 重新部署评论系统, 以达到更新评论系统的目的.

## 总结

以上是简单记录, 开始刚接触vercel和easycron, 主要还是看看官网说明: [Deploy Hooks](https://vercel.com/docs/more/deploy-hooks). 如果接触过Linux上的cron则对easycron就很容易理解了.

不过刚开始对Hook理解错了, 认为访问Hook链接之后vercel会更新一笔到github上, 实际上不是的, vercel只做重新部署, 可以理解为重新从github上拉取代码然后部署.

