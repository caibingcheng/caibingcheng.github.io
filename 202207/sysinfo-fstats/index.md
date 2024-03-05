# 系统信息悬浮窗-fstats


日常开发过程中, 一次编译经常会占用满系统的CPU和内存资源. 我使用tmux作为终端环境, 有`tmux-cpu`等插件可以监控系统资源, 但是退出该环境后(比如切换到其他应用)就不容易实时查看到系统资源的占用. 为了解决这个问题, 我开发了`fstats`这款显示系统信息的悬浮窗工具, 同[fkfish](/202205/about-fkfish/), 使用`python`作为主要开发语言, 也使用`tkinter`来编写界面.

项目地址: [https://github.com/caibingcheng/fstats](https://github.com/caibingcheng/fstats)

<!--more-->

## 基础功能

最基础的需求是能够显示CPU和内存的占用率, UI界面也可以根据占用率有所变化, 如下:

低占用是白色背景:

!["低占用"](https://bu.dusays.com/2022/09/09/631a92d7908f5.png "低占用")

高占用是红色背景:

!["高占用"](https://bu.dusays.com/2022/09/09/631a92d790b46.png "高占用")

## 扩展

如果只有默认显示, 总感觉少了些什么. 现在`fstats`支持用户扩展, 通过扩展接口, 用户可以自定义更丰富的显示, 通过以下路径配置`<HOME path>/.fstats/config.json`:
```json
{
    "width": 96,
    "height": 64,
    "style": "<HOME path>/.fstats/style.py",
    "items": [
        ["CPU", "<HOME path>/.fstats/cpu.py", "{:<3}: {:<5}%"],
        ["MEM", "<HOME path>/.fstats/mem.py", "{:<3}: {:<5}%"],
        ["LIVE", "<HOME path>/.fstats/live.py", "{:<4}: {:<4}"]
    ]
}
```

通过`width`和`height`, 用户可以定义悬浮窗的大小, 通过`items`, 用户可以定义显示的内容, 如上描述, 第一行显示CPU占用率, 第二行显示内存占用率, 第三行显示一个计数器, 表示存活状态, 这几个`item`的实现如下:

```python
## cpu
import psutil

def info():
    return psutil.cpu_percent(interval=1)
```

```python
## mem
import psutil

def info():
    return psutil.virtual_memory().percent
```

```python
## live
count = 0

def info():
    global count
    count %= 10000
    count += 1
    return count
```

更多的, 比如想显示座右铭, 那么可以实现一个`info`接口, 返回你喜欢的句子即可, 或者可以通过`request`请求远端的数据, 实现座右铭的动态切换. 再或者, 想监控某个进程的存活状态, 也可以通过实现一个`info`接口实现. 但是目前仅支持显示文字, 也只支持`python`脚本, 后续还需至少添加对`shell`脚本和纯字符串的支持. 至于图片之类的内容显示, 目前并不在计划中.

`style`指向的脚本则是用来更新UI状态, 比如一种实现如下:

```python
def style(infoItems, label):
    high = False
    for item in infoItems:
        if item[0] in {'CPU', 'MEM'} and item[1] > 90:
            high = True
    if high:
        label['bg'] = 'red'
        label['fg'] = 'white'
    else:
        label['bg'] = 'white'
        label['fg'] = 'black'
```

以上通过CPU/MEM的占用率, 修改`label`的样式, 这里的`label`就是tkinter中的`Label`对象, 是目前所有信息的容器(所有信息都当作是`Label`的`text`成员). 该接口的扩展方向是, 把每一个`item`都当作是一个`label`对象, 这样就可以控制某些`item`的样式, 而不是整体的样式.

那么, 我个人做了以下扩展:

!["个人扩展"](https://bu.dusays.com/2022/09/09/631a92d839c04.png "个人扩展")

`LIVE`用来标识是不是卡死了, 这是一个计数器, 每次轮循的时候+1.

`BUILD`用来监视编译进程, 因为一次编译可能会消耗几十分钟, 那么我在切换到其他应用的时候, 就可以通过`BUILD`判断编译是否完成了(`ON`表示还在编译, `OFF`表示编译完成).

## 开始使用

该库已提交到`pypi`, 因此`pip`安装即可:

```shell
pip3 install fstats
```

使用的时候, 可以配置到系统启动项, 或者手动启动, 手动启动推荐以下方式, 可以在后台启动:

```shell
fstats &
```

