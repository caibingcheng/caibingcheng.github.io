# 指数基金估值查询-djeva


工具地址: [https://djeva.bbing.com.cn](https://djeva.bbing.com.cn/)

项目地址: [https://github.com/caibingcheng/djeva](https://github.com/caibingcheng/djeva)

<!--more-->

前段时间读了几本关于理财投资的书籍，其中提到了指数基金定投策略，按照价值投资的理念，在低估时买入指数基金，在正常估值时停止或者降低买入，高估时卖出。估值方式多种多样，我现在可能参考PE、PB、ROE、股息率等估值数据，参考来源是蛋卷基金或者银行螺丝钉的公众号，但是遇到的问题是，我期望能记录我每一笔交易当日的估值，但有时候在当日会忘记记录，而后不太方便查找那日的估值（单项基金的历史数据会缺少一些项目），因此需要一个工具可以用来查找过去某日的全部估值数据。

数据来源是[蛋卷基金](https://danjuanapp.com/djmodule/value-center)，我们进入其估值页面，`F12 -> Network`选项卡查找其数据来源，可以发现一条[https://danjuanapp.com/djapi/index_eva/dj](https://danjuanapp.com/djapi/index_eva/dj)，查看其`response`可以知道这是我们需要的数据。

如果直接用`python`的`request`库`get`上述`url`是不可以的，服务器会拒绝该请求，这时候需要构造`header`，如下：
```
_url = 'https://danjuanapp.com/djapi/index_eva/dj'
_headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36 Edg/101.0.1210.53'
}
```

通过github action，在国内时间每晚8点左右会更新一次数据。

数据格式很简单，拿到后简单处理即可。`djeva`拿到数据后会保存三份：

1. `source`，代表原始数据，是直接从`response`中获取的
2. `json`，是提取后的数据存储为`json`格式，此处的提取仅是提取`source`数据的`data`项
3. `csv`，同`json`，但是以`csv`存储

数据有冗余，以不同的格式存储只是为了客户端获取的方便，减少客户端的数据处理过程（[`rssblog-source`](https://github.com/caibingcheng/rssblog-source)项目也是此原因），并且我们一般也不太在意此类数据准备的时间。

数据准备好之后则期望可以比较方便的呈现，`djeva`采用的是表格形式，使用的是原生`js`编写的`gridmanager`组件，有了该组件我们可以比较方便的呈现数据，但是怎么切换数据来源呢？（比如查看某日期的估值。）可以根据某日期尝试`get`数据，如果超时则认为不存在，不过该方法显然不行，所以还是参考[`rssblog-source`](https://github.com/caibingcheng/rssblog-source)，在数据准备阶段，就会准备一个可用数据的列表，该项目生成的是[`djeva.js`](https://github.com/caibingcheng/djeva/blob/master/djeva.js)，其中包含的内容就是`djeva`已经备份的估值的日期。

不过，即使以上生成了`js`文件，由于跨域问题的存在，将数据源和客户端分离的话，获取数据将变得不方便，我只想到通过构建一个后端，然后再通过后端获取来屏蔽跨域问题的方案，并且认为其性价比不高（但是`gridmanager`就可以通过`url`获取，还没看其源码），因此索性将数据源和客户端放在一起。当前的`djeva`是通过`vercel`构建的，但是客户端只有`index.html`文件，又因为`vercel`会将该仓库的所有数拉取过去，因此不存在跨域问题。
