# tmux插件-保存会话



本文会推荐一套用于tmux保存会话的插件，这样在重启电脑重新登录的时候，也可以恢复上一次的tmux环境。（主要指tmux的状态环境。）

<!--more-->

## 下载插件
```Shell
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
git clone https://github.com/tmux-plugins/tmux-resurrect ~/.tmux/plugins/tmux-resurrect
git clone https://github.com/tmux-plugins/tmux-continuum ~/.tmux/plugins/tmux-continuum
```

## 配置文件
在```~/.tmux.conf```添加:
```Shell
# plugins
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-resurrect'
set -g @plugin 'tmux-plugins/tmux-continuum'
set -g @continuum-save-interval '15'
set -g @continuum-restore 'on'
set -g @resurrect-capture-pane-contents 'on'

run -b '~/.tmux/plugins/tpm/tpm'
```

## 重新加载
按照个人配置不同, 前缀可能有差异.
```Shell
Ctrl+b r
```

## 手动保存和加载
```Shell
Ctrl+b Ctrl+s ## 保存
Ctrl+b Ctrl+r ## 加载
```
