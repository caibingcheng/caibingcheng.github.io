# jinja2模板错位问题


## 问题

我有以下模板:

<!--more-->


```HTML
<div class="grid">
    {% for item in data.data %}
    <a href={{ item.link }} class="card">
        <span class="cardindex">{{ loop.index }}. &nbsp;&nbsp;</span>
        <span class="cardtitle">{{ item.title }}</span>
        <div class="carddetail">
            <span class="cardate">{{ item.date }}</span>
            <a href={{ item.home }} class="cardhome">
                <span class="cardauthor">{{ item.author }}</span>
            </a>
        </div>
    </a>
    {% endfor %}
</div>
```

渲染之后看到浏览器显示是:
```HTML
<a href="******" class="card">
    <span class="cardindex">1. &nbsp;&nbsp;</span>
    <span class="cardtitle">******</span>
</a>
<div class="carddetail">
    <a href="******" class="card">
        <span class="cardate">******</span>
    </a>
    <a href="******" class="cardhome">
        <span class="cardauthor">******</span>
    </a>
</div>
```

明显不符合要求, 按照模板的结构```carddetail```应该是```card```的child.

## 解决

通过渲染结果可以大概分析出是```a```标签嵌套导致的错位(TODO: 为什么嵌套```a```标签会导致错位?), 注释第二个```a```标签可以正确渲染.

那么, 解决方案如下:
```HTML
<div class="grid">
    {% for item in data.data %}
    <a href="{{ item.link }}" target="blank" class="card">
        <span class="cardindex">{{ loop.index }}. </span>
        <span class="cardtitle">{{ item.title }}</span>
        <div class="carddetail">
            <span class="cardate">{{ item.date }}</span>
            <span class="cardauthor cardhome" onclick="javascript:window.open('{{ item.home }}')">{{ item.author }}</span>
        </div>
    </a>
    {% endfor %}
</div>
```
移除了```a```标签, 并且使用```onclick```事件来实现跳转.
