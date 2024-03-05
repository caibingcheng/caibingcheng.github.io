# dotfiles之外的一些应用


我学习到的dotfiles的核心想法就是：1. 通过软链接将不同路径下的文件统一管理；2. 通过软链接将统一管理的文件分配给不同路径；

受这两个观点的启发，在日常开发/生活中也可以通过软链接实现一些应用。

<!--more-->

## 文件分类

（文件分类这个标题有点大，但是也不是不可以～～）

我遇到的实际问题是，把需要的log文件放在特定的文件夹中，如以下目录结构：
```
logs
    config_1.yml
    config_2.yml
    config_3.yml
    log_1.log
    log_2.log
    log_3.log
    log_4.log
    static_1.png
    static_2.png
    static_3.png
```

我期望文件夹中只有`log_*.log`这些文件，这样就可以方便的用`vscode`之类的打开和查看了。

一种想法是将`log_*.log`文件拷贝出来，如：

```mkdir -p log_view && cp logs/log_*.log log_view```

这样的问题是多增加了一次不必要的拷贝。那么引用dotfiles的思想，可以这样做：

```mkdir -p log_view && ln logs/log_*.log log_view```

不增加额外的内容拷贝，可以在`log_view`目录下查看log文件这一分类，我们可以添加更多这样的分类，来达到‘零拷贝’文件分类的目的。（比如实现一个文件标签功能的应用）

## 文件映射

（没有想到一个好的标题...）

最近沉迷欧卡2，其中有一项功能就是可以在卡车上播放本地下载的音乐，做法是在`[User]\Documents\Euro Truck Simulator 2\music`路径下放置音乐文件。但是`Document`默认是和系统挂载在一起的，我期望本地音乐在Nas的硬盘上（已打开SMB），而不是再拷贝一份到上述目录下。有了dotfiles的提示，就很简单了，直接从SMB的音乐目录选中喜欢的音乐，创建软链接（快捷方式）到上述`music`路径就行了。

（欧卡真好玩...入了g29方向盘，最近下班回家都会送上一趟货，被迫加班😄）
