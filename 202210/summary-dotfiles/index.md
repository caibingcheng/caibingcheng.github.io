# 同步不同设备间的设置-dotfiles


曾经遇到过一个问题，我的工作电脑、个人电脑、服务器如何同步一些个人设置？

因为很多配置文件都是在`~/`路径下的，我最开始的做法是在`~/`路径下维护一个git仓库，然后在不同机器间同步。这样的问题是，这个仓库“太大了”，相当于`~/`路径下的所有文件对它都是可见的，因此维护起来比较麻烦。

最近看Codespace文档的时候了解到了`dotfiles`这个概念，目前完全可以满足我的需求。

<!--more-->

## dotfiles

`dotfiles`如其名，就是点文件，因为类Linux系统下的大多数配置文件都是`.xxx`的形式，因此而得名。其思想也是使用一个git仓库管理所有的配置文件，但是不像开头那样在`~/`下维护一个仓库，而是在任意路径下维护诸如名字为`dotfiles`的仓库。这样配置文件的路径不是乱套了吗？`dotfiles`的核心思想就是使用软链接将配置文件链接到正确的路径。

比如在`.dotfiles`目录下管理如下配置文件：
```shell
.dotfiles
├── aliases
├── tag-rcm
│   └── rcrc
└── tag-zsh
    ├── zinit_plugins
    ├── zshrc
    ├── zshrc_alias
    └── zshrc_bindkeys
```

经过软链接后在`~/`目录下映射为了如下配置文件：
```shell
.aliases -> /home/codespace/.dotfiles/aliases
.rcrc -> /home/codespace/.dotfiles/tag-rcm/rcrc
.zinit_plugins -> /home/codespace/.dotfiles/tag-zsh/zinit_plugins
.zshrc -> /home/codespace/.dotfiles/tag-zsh/zshrc
.zshrc_alias -> /home/codespace/.dotfiles/tag-zsh/zshrc_alias
.zshrc_bindkeys -> /home/codespace/.dotfiles/tag-zsh/zshrc_bindkeys
```

以上，还使用了tag来管理不同类别的配置文件，这样不会很复杂吗？如何简化？使用`rcm`.

`rcm`是一款`dotfiles`的管理工具。用它可以实现对`dotfiles`的创建、映射、打标签等功能。不过有点奇怪，虽然是通过`apt install rcm`之类的命令安装的，但是rcm并不是一条命令，它提供了4条相关命令：

```
lsrc
mkrc
rcdn
rcup
```

分别是打印(ls)、创建(mk)、删除(dn)、构建/更新(up). 除基础命令外，还带额外参数，比如打标签(-t)，不加点(-U)等。要了解更多参数和用法，更好的方法是阅读man。

## 我的配置

以前设备上的配置文件已经丢失，之后我会使用`dotfiles`的方式重新管理设备的配置文件。目前的配置文件更新在[https://github.com/caibingcheng/dotfiles](https://github.com/caibingcheng/dotfiles).

目前，我的终端环境切换到了`zsh`，此前一直是`bash`。在“初次”使用`zsh`时发现了一些比较好用的东西：
1. `zinit`，主要用于替换`oh-my-zsh`，`zinit`一个`zsh`插件管理器，`oh-my-zsh`是一个`zsh`配置环境，前者很轻后者有点重。
2. `fzf`，是一款查找工具，可以查找管道信息，也可以查找文件，和`find`对比的话，非常人性化，很早就有朋友给我推过，但是现在才使用。
3. `ripgrep`，使用`Rust`编写，主要是用于替换`grep`，很早就开始使用了，对我来说属于必装项目。
4. `exa`，主要用于替换`ls`，还在体验中，因为`zinit`的`fzf-tab`插件才了解到这个工具。

（这篇拖了好几天了，动手写之后发现也没太多内容）
