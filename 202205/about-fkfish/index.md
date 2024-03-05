# 摸鱼工具-fkfish


项目地址: [https://github.com/caibingcheng/fkfish](https://github.com/caibingcheng/fkfish)

合理地摸鱼可以提高工作效率，也有助于降低因资本压迫而带来的精神损耗，在当今如此内卷的互联网环境下，我认为学会摸鱼是十分有必要且合理的。

目前已有一些摸鱼插件可以帮助广大无产/中产阶级从部分无休止、无意义的工作中相对的解放出来，比如vscode下的彩虹屁、韭菜盒子等插件。但是除了精神的解放，身体的解放也不容忽视，这就是`fkfish`的目的。

<!--more-->

`fkfish`通过将桌面环境伪装成重启、crash等界面，向外界释放“**该机器暂时无法正常工作**”的信号，但是该信号的持续时间不会太长，目标是5分钟（我们只是反对内卷和压迫，但不能违背劳动契约精神），用户可以在这段时间出去走走，或者伸伸懒腰，或者拉拉伸。当然，市面上也有类似的工具，比如从chrome商店可以找到，但是这类插件容易被识破，通过ESC等按键就可以退出，并且也不容易屏蔽鼠标。`fkfish`可以屏蔽鼠标和ESC等按键，但是目前无法屏蔽系统热键，这将是该工具后期努力的方向。

### 安装

#### 依赖环境

`fkfish`依赖`Python`以及`tkinter`，因此在你的系统上需要安装上述依赖：

- Ubuntu

```Shell
apt install python3
apt install python3-tk
```

- Windows

`tkinter`是`Python`的内置特性，因此在安装`Python`的时候勾选安装`tk`即可。

#### 开始安装

准备好运行环境后，可以通过源码或`pip`安装, 推荐使用`pip`安装

- 源码安装

```python
git clone git@github.com:caibingcheng/fkfish.git
cd fkfish
python3 setup.py install
```

- pip安装

```python
pip3 install fkfish
```

### 运行

`fkfish`可以根据不同的系统伪装成对应的界面，直接运行：

```python
## 自动根据不同系统，伪装成重启界面
fkfish
```

Linux下将得到以下界面(未来可能有所改动，但是形式不会改变)：
!["Linux-Demo"](https://bu.dusays.com/2022/06/26/62b87b07e480a.gif "Linux-Demo")

Windows下将得到以下界面(未来可能有所改动，但是形式不会改变)：
!["Windows-Demo"](https://bu.dusays.com/2022/06/26/62b87b8a11714.gif "Windows-Demo")

以上，可以通过`fkfish`的热键退出：
```python
## 如果设置了密码，则该热键不生效
<ctrl + m>
```

此外，也可以通过参数指定伪装的界面：

- Linux 重启
```python
## 伪装Linux重启
fkfish -m linux
```

- windows 重启
```python
## 伪装windows重启
fkfish -m windows
```

- windows 蓝屏
```python
## 伪装windows蓝屏
fkfish -m winblue
```

也可以通过设置密码来退出界面，如下，这时候热键`<ctrl + m>`失效，需要通过输入密码来退出：
```python
## <ctrl + m>失效，密码匹配后才可以退出
fkfish -p [passwd]
```
