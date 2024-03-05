# Git的目录结构


## git目录
新建一个git项目，查看.git目录

<!--more-->

```shell
.git/
├── branches
├── config
├── description
├── HEAD
├── hooks
│   ├── applypatch-msg.sample
│   ├── commit-msg.sample
│   ├── fsmonitor-watchman.sample
│   ├── post-update.sample
│   ├── pre-applypatch.sample
│   ├── pre-commit.sample
│   ├── prepare-commit-msg.sample
│   ├── pre-push.sample
│   ├── pre-rebase.sample
│   ├── pre-receive.sample
│   └── update.sample
├── info
│   └── exclude
├── objects
│   ├── info
│   └── pack
└── refs
    ├── heads
    └── tags

9 directories, 15 files
```

## objects
我的理解是，项目中你看到的每个东西都是一个object，实际上object有：commit、tree、blob、tag（加tag的时候才会有）

- 添加一个文件

```shell
echo 111 > a.txt
# 此时看git目录没有任何变化
git add .
# 此时看git 目录可以看到多了objects下多了一个目录，运行以下命令：
git cat-file -p 58c9  #xxxx是遗传16进制的值，由目录名和里面的文件名组成
# 输出 111
git cat-file -t 58c9  #可以看到当前objects的类型，此时是blob
# 通过上述的操作，可以知道，blob是一个只包含文件内容的object

# 接下来执行commit操作，此时会发现objects目录下多了两个文件，我们一个一个查看
git cat-file -p 9759 #
# 内容是tree f253233a1a0e59f33115daca3fa494eaa20758d8，还有一些其他信息
# 我们可以看到f253233a1a0e59f33115daca3fa494eaa20758d8也是objects中的一个对象，接着看看它，其实已经可以判断它是一个tree类型
git cat-file -t 9759 #类型是commit
git cat-file -p f253 #内容 100644 blob 58c9bdf9d017fcd178dc8c073cbfcbb7ff240d6c    a.txt
git cat-file -t f253  #类型tree
```
通过以上的信息，实际上一次commit是构建了一棵树。

以上：

9759->f253->58c9  ||  commit->tree->blob

如果修改a.txt的内容，可以看到会生成新的objects，并且有一个新的blob完全包含了新的a.txt的全部内容，**这意味着，git是保存文件的完全的副本，而不是差异**。同时会有新的commit object 和 新的tree object。**实践吧！**

添加了b.txt的objects tree

```shell
├── objects
│   ├── 4c
│   │   └── aaa1a9ae0b274fba9e3675f9ef071616e5b209
│   ├── 58
│   │   └── c9bdf9d017fcd178dc8c073cbfcbb7ff240d6c
│   ├── 97
│   │   └── 590a17d455bf791b68561588bddae174d125d1
│   ├── c2
│   │   └── 00906efd24ec5e783bee7f23b5d7c941b0c12c
│   ├── d6
│   │   └── 43f2709193bf972c2d01a0119934e8789ec915
│   ├── f2
│   │   └── 53233a1a0e59f33115daca3fa494eaa20758d8
│   ├── info
│   └── pack
# d643是新的commit，可以看它的内容，会多了一个parent 97590a17d455bf791b68561588bddae174d125d1
# parent 把新的commit和过去的commit连接起来了！
```

可以试着reset一下，会发现其实所有的objects都还在的，只是改变了HEAD等指针；

**git的所有内容都是实例和指向它的指针。**

---

[以下在git magic]

## blob

>  Git基于“内容寻址”：文件并不按它们的文件名存储，而是按它们包含内容的哈希值， 在一个叫“blob对象”的文件里。我们可以把文件内容的哈希值看作一个唯一ID，这样 在某种意义上我们通过他们内容放置文件。开始的“blob 6”只是一个包含对象类型与 其长度的头；它简化了内部存储。

>  这样我可以轻易预言你所看到的输出：文件名是无关的：只有里面的内容被用作构 建blob对象。

>  你可能想知道对相同的文件会发生什么。试图填加一个你文件的拷贝，什么文件名都行。 在 .git/objects 的内容保持不变，不管你加了多少。Git都只存储一次数据。

以下内容hash值：

`"blob" SP "6" NUL "[内容]" LF`

以上， blob结构是， 按照文件内容生成的，只要内容相同， 就是同一个blob

## tree

>  “tree”对象：一组包含文件类型，文件名和哈希值的数据。在我们的例 子里，文件类型是100644，这意味着“rose”是一个一般文件，并且哈希值指blob对象， 包含“rose”的内容。其他可能文件类型有可执行，链接或者目录。在最后一个例子里， 哈希值指向一个tree对象。
以上， tree结构是， 包含了文件名/类型（一般文件/可执行/链接/目录），和其指向的对象（目录指向tree， 一般指向blob）

以下内容hash值：

`"tree" SP "32" NUL "[文件类型] 文件名" NUL 0xaa823728ea7d592acc69b36875a482cdf3fd5c8d[指向的对象]`

## commmit
commit 结构， 会包含commit信息/作者等， 会包含父commit指针， 包含tree指针

## 结构
![结构图](https://bu.dusays.com/2022/06/26/62b87a68de589.png "结构图")
