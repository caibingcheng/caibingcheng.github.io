# 《UCB CS61a SICP Python 中文》一周目笔记(四)



## 并行计算、序列和协程

锁、条件变量、死锁在译文中的描述符合我的认知，在此就不介绍了。以下是关于信号量的补充，在文章[《进程控制和通信(三) **· 消息、信号、共享内存**》](202105/process-ctracon3/)中描述过信号量，但是仅将信号量作为锁的一种实现方法。

<!--more-->

### 信号量

信号量是用于维持有限资源访问的信号。它们和锁类似，除了它们可以**允许某个限制下的多个访问**。它就像电梯一样只能够容纳几个人。一旦达到了限制，想要使用资源的进程就必须等待。其它进程释放了信号量之后，它才可以获得。

例如，假设有许多进程需要读取中心数据库服务器的数据。如果过多的进程同时访问它，它就会崩溃，所以限制连接数量就是个好主意。如果数据库只能同时支持`N=2`的连接，我们就可以以初始值`N=2`来创建信号量。

这里想到了socket里面的`listen`接口，可以监听N个连接，这里的实现可能就用到了值为N的信号量，不过目前还没找到源码。

```python
>>> from threading import Semaphore
>>> db_semaphore = Semaphore(2) # set up the semaphore
>>> database = []
>>> def insert(data):
        db_semaphore.acquire() # try to acquire the semaphore
        database.append(data)  # if successful, proceed
        db_semaphore.release() # release the semaphore
>>> insert(7)
>>> insert(8)
>>> insert(9)
```

信号量的工作机制是，所有进程只在获取了信号量之后才可以访问数据库。只有`N=2`个进程可以获取信号量，其它的进程都需要等到其中一个进程释放了信号量，之后在访问数据库之前尝试获取它。

```
P1                          P2                           P3
acquire db_semaphore: ok    acquire db_semaphore: wait   acquire db_semaphore: ok
read data: 7                wait                         read data: 9
append 7 to database        wait                         append 9 to database
release db_semaphore: ok    acquire db_semaphore: ok     release db_semaphore: ok
                            read data: 8
                            append 8 to database
                            release db_semaphore: ok
```

**值为 1 的信号量的行为和锁一样**。



### 协程

关于协程，之后再用一个篇幅来讲吧，大概会讲协程的原理和实现方法（TODO），本文仅是SICP的学习记录。

#### send和yield

此处并不是讲`send`和`yield`的实现原理或使用方法，而是为了记录从这两个方法中学习到的一种比较通用的范式，以便可以迁移到其他的学习中去。

协程可以通过`(yield)`语句来消耗值，向像下面这样：

```py
value = (yield)
```

使用这个语法，在带参数调用对象的`send`方法之前，执行流会停留在这条语句上。

```py
coroutine.send(data)
```

之后，执行会恢复，`value`会被赋为`data`的值。为了发射计算终止的信号，我们需要使用`close()`方法来关闭协程。这会在协程内部产生`GeneratorExit`异常，它可以由`try/except`子句来捕获。

下面的例子展示了这些概念。它是一个协程，用于打印匹配所提供的模式串的字符串。

```python
>>> def match(pattern):
        print('Looking for ' + pattern)
        try:
            while True:
                s = (yield)
                if pattern in s:
                    print(s)
        except GeneratorExit:
            print("=== Done ===")
```

按照上述对`yield`和`send`的解释，`match`运行会停在`yield`处，直到有`send`调用才会继续向下执行，执行后又会回到`yield`等待。

如下调用：

```python
>>> text = 'Commending spending is offending to people pending lending!'
>>> matcher = match('ending')
>>> matcher.__next__()
Looking for ending
>>> read(text, matcher)
Commending
spending
offending
pending
lending!
=== Done ===
```

`read`函数向协程`matcher`发送每个单词，协程打印出任何匹配`pattern`的输入。在`matcher`协程中，`s = (yield)`一行等待每个发送进来的单词，并且在执行到这一行之后将**控制流交还**给`read`。

`send`激活`yield`，下一次执行到`yield`时又将控制流交换给`send`之后的流程。

![img](https://wizardforcel.gitbooks.io/sicp-py/content/img/read-match-coroutine.png)

### 尾声

本篇是“SICP笔记/读后感系列”的最后一篇，本篇大部分内容都是摘抄自原文的[ch5](https://wizardforcel.gitbooks.io/sicp-py/content/ch5.html)，本系列文章名后面加了一周目，是因为我觉的这种读物是值得多次阅读的，不同的阶段肯定会有不同的收获、见解。至于什么时候开二周目，我也不知道，至少近期不会。


