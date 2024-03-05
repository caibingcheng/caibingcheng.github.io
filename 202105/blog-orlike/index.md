# 使用OrLike为博文添加点赞系统


## [OrLike](https://github.com/caibingcheng/orlike)

使用LeanCloud, 部署在vercel的博客点赞插件, 保障安全.

当前功能:

<!--more-->

- [x] 分离APPID/APPKEY, 保护账号安全
- [x] 使用随机用户ID, 不保存用户其他信息, 保障用户隐私
- [x] 支持设置用户过期时间
- [x] 支持取消点赞/踩
- [x] 将orlike发布为pipy包, 方便自动升级
- [x] 加载动画
- [x] 自定义图标和CDN

## Branch

- server: server端代码
- client: client端代码
- master: demo

## Deployment

在这里可以将OrLike部署到你的Vercel账户上.

[![Deploy to Vercel](https://camo.githubusercontent.com/f209ca5cc3af7dd930b6bfc55b3d7b6a5fde1aff/68747470733a2f2f76657263656c2e636f6d2f627574746f6e)](https://vercel.com/import/project?template=https://github.com/caibingcheng/orlike-vercel)

我们更推荐使用这个[**零配置的例子**](https://github.com/caibingcheng/orlike-vercel).

## Usage

在你期望嵌入```OrLike```的页面加入以下链接:
```JavaScript
<script src="https://cdn.jsdelivr.net/gh/caibingcheng/orlike@client/orlike.min.js"></script>
```
当然, 也可以使用自己的CDN. 本项目也依赖JQuery, 所以别忘记引用JQuery:
```JavaScript
<script src="https://cdn.bootcdn.net/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
```

接下来, 在你期望嵌入```OrLike```的位置加上一个```div```标签, 并且加上```class```或者```id```:
```HTML
<div class="orlike-box"></div>
```

然后在合适的地方初始化```OrLike```:
```HTML
<script>
    new OrLike({
        serverUrl: "https://orlike.vercel.app/",
        el: ".orlike-box",
        days: 30,
        icon: {like: "fa fa-heart", dislike: false},
        style: "https://cdn.jsdelivr.net/gh/caibingcheng/orlike@client/orlike.min.css",
    });
</script>
```

> 尽管可以使用公共的serverUrl, 但是更推荐使用私有的serverUrl, 这样更容易保证数据安全.

目前初始化需要的参数:
- ```serverUrl```: **必填**, Vercel服务地址
- ```el```: **必填**, 放```orlike```的```div```名字(```class```或```id```)
- ```days```: 可选, 用户id保存的时间, 默认是30天
- ```icon```: 可选, 自定义点赞和踩的图标, 不填写这是默认, 如果是false, 则不显示对应的按扭
- ```style```: 可选, 可自定义样式, 如果不填写, 则使用默认CDN
- ```ifont```: 可选, 可自定义font-awesome CDN, 如果不填写, 则使用默认CDN

到此为止, 本地工作已经做完了, 现在需要创建LeanCloud账户, 可以参考[Valine](https://valine.js.org/quickstart.html)的配置方法.

创建账户并且新建应用之后， 需要**给应用添加一个名为```OrLike```的class**, 并且设置**读写权限为所有用户**, 然后再拿到LeanCloud的```APP ID``` 和 ```APP Key```填入到Vercel的环境变量.

- ```APPID``` 对应 ```APP ID```
- ```APPKEY``` 对应 ```APP Key```

然后部署OrLike就可以正常工作了.

## Todo & Contributes
项目初期, 还有很多想象空间, 加油↖(^ω^)↗

- [ ] 提供点赞/踩排名

## 为hugo添加orlike

添加文件```layouts/partials/single/orlike.html```:
```HTML
<script src="https://cdn.jsdelivr.net/gh/caibingcheng/orlike@client/orlike.min.js"></script>
<script src="https://cdn.bootcdn.net/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
<div class="orlike-box"></div>
<script>
    new OrLike({
        serverUrl: "https://orlike-vercel.vercel.app/",
        el: ".orlike-box",
        days: 30,
    });
</script>
```
要记得引用jquery, 如果已经引用过了并且jquery可以工作, 那么这里就不需要重复引用了.

在```layouts/posts/single.html```合适的位置引用以上文件, 例如在content末尾:
```HTML
{{- /* Content */ -}}
<div class="content" id="content">
    {{- dict "Content" .Content "Ruby" $params.ruby "Fraction" $params.fraction "Fontawesome" $params.fontawesome | partial "function/content.html" | safeHTML -}}

    {{- /* OrLike */ -}}
    {{- partial "single/orlike.html" . -}}

    {{- /* Reward */ -}}
    {{- partial "single/reward.html" . -}}

    {{- /* Notice */ -}}
    {{- partial "single/notice.html" . -}}
</div>
```

现在可以刷新页面试试是否有效.

