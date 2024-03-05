# 添加了一些WebAPI


为应对blog的一些需求, 依托vercel搭建了一个webapi的服务, 考虑到vercel的性能以及自建难度, 部分api仅供个人使用.

[api.bbing.com.cn](https://api.bbing.com.cn), 支持以下api.

<!--more-->

## /dog

请求舔狗日记.

数据来源网络, **如有侵权请联系我删除**.

| 参数 | 值域 | 作用 | 默认 |
|---|---|---|---|
| method | js\|json\|text | 数据返回形式 | text |
| count | 1-100 | 一次请求返回count条数据 | 1 |
| identify | Element ID | 数据填写的Element ID | "" |


- /dog?method=js
```
curl "https://api.bbing.com.cn/dog?method=js"
```
```
document.write('我今天送了你一支口红，你拿到之后很开心，在他的嘴巴上亲了一下，或许他送你口红的时候，你也会在我的嘴巴上亲一下吧。');
```

- /dog?method=js&identify=dogdog
```
curl "https://api.bbing.com.cn/dog?method=js&identify=dogdog"
```
```
document.getElementById('dogdog').innerText='小时候抓周抓了个方向盘 爸妈都以为我长大了会当赛车手 最差也是个司机 没想到我长大了当了你的备胎';
```

```
curl "https://api.bbing.com.cn/dog?method=json&count=2"
```
```
{"data": "['你从来没说过爱我，聊天记录搜索了一下“爱”，唯一的一条是：你好像乡村爱情里的刘能啊。', '昨晚你终于回我信息了，你回了一句谢谢还加了一个爱心。当时我在工地上激动的差点把隔壁的吊塔阿姨给亲了。不过我想了想你笑起来的样子我还是忍住了。你给我发爱心，一定是已经爱上我了吧，放心，我连咱们的孩子名字都想好了。等我，我一定会继续努力挣钱，给你买更多的化妆品，发更多的红包！']"}
```

- /dog?method=text
```
curl "https://api.bbing.com.cn/dog?method=text"
```
```
昨天你把我拉黑了，我看着红色感叹号陷入了久久的沉思，我想这其中一定有什么含义？红色红色？我明白了！红色代表热情，你对我很热情，你想和我结婚，我愿意。
```

- /dog?method=text&count=2
```
curl "https://api.bbing.com.cn/dog?method=text&count=2"
```
```
['你说你情头是一个人用的 空间上锁是因为你不喜欢玩空间 情侣空间是和闺蜜开的 找你连麦时你说你在忙工作 每次聊天你都说在忙 你真是一个上进的好女孩 你真好 我好喜欢你。', '昨天你把我拉黑了，我看着红色感叹号陷入了久久的沉思，我想这其中一定有什么含义？红色红色？我明白了！红色代表热情，你对我很热情，你想和我结婚，我愿意。']
```

## /uptimerobot

自用.

返回uptimerobot的监视器, 300s更新一次, 用于自动判断blog友链的可访问性, 详细见[友链](https://www.bbing.com.cn/friends/).

## /gist

自用.

返回gist, 60s更新一次, 用于加速国内访问时获取blog友链列表, 详细见[友链](https://www.bbing.com.cn/friends/).
