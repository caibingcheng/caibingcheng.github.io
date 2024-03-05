# 切换Python版本后导致终端打不开


我使用的是`Ubuntu18.04`, 最近将`python3`命令从`python3.6`指向了`python3.7`, 在重启系统后, 会出现终端无法打开的问题, 这时候切换tty打开也是不可以的.

<!--more-->

其原因可能和库的查找逻辑有关.

1. 打开Ubuntu Software, 下载xterm
2. 打开xterm
```Shell
cd /usr/lib/python3/dist-packages/gi
```
3. 复制并重命名以下文件:

```Shell
sudo cp _gi.cpython-36m-x86_64-linux-gnu.so _gi.cpython-37m-x86_64-linux-gnu.so
sudo cp _gi_cairo.cpython-36m-x86_64-linux-gnu.so _gi_cairo.cpython-37m-x86_64-linux-gnu.so
```

如果是其他版本的python, 基本同理, 但是需要考虑库兼容性的问题.
