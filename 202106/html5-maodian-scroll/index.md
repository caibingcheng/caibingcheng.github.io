# html5锚点滚动



普通的锚点滚动方式是直来直去的，不太平滑，我们可以借助`scrollIntoView`实现平滑滚动。

<!--more-->

## 原始方案


```HTML
<div class="fixedbox">
    <a class="actiongithub" href="https://github.com/caibingcheng/rssblog" title="GitHub" target="_blank" rel="noopener noreffer me"></a>
    <a class="actiontop" href="#top-header"></a>
    <a class="actionbottom" href="#bottom-footer"></a>
</div>
```
一般会按照上述方案实现锚点滚动, 但是这种方案的问题有两点:
1. 会改变url
2. 滚动动画不平滑


## scrollIntoView

采用```scrollIntoView```可以使用很少的代码实现平滑滚动, 并且不会改变url.
```HTML
<div class="fixedbox">
    <a class="actiongithub" href="https://github.com/caibingcheng/rssblog" title="GitHub" target="_blank" rel="noopener noreffer me"></a>
    <a class="actiontop" onclick="javascript:document.getElementById('top-header').scrollIntoView({block: 'start', behavior: 'smooth', inline: 'center'})"></a>
    <a class="actionbottom" onclick="javascript:document.getElementById('bottom-footer').scrollIntoView({block: 'start', behavior: 'smooth', inline: 'center'})"></a>
</div>
```

```scrollIntoView```可以接收三个参数:
- ```behavior```: 定义动画过渡效果, "auto"或 "smooth" 之一. 默认为 "auto".
- ```block```: 定义垂直方向的对齐, "start", "center", "end", 或 "nearest"之一. 默认为 "start".
- ```inline```: 定义水平方向的对齐, "start", "center", "end", 或 "nearest"之一. 默认为 "nearest".

**注意:** Safari桌面和移动端都不支持```scrollIntoView```参数, 仅可以使用默认配置, 这时候是没有平滑滚动效果的.

