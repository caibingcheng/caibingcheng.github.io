# glibc-raise源码阅读


## 问题

关于`raise`函数，有几个想调查的问题：

<!--more-->


1. `raise`是怎么实现的?
2. `raise`的作用时机?


## 源码

先来看raise的实现, 代码比较简单, 我们也无需递归地去看每一个函数地实现.

raise调用的就是tgkill. tgkill相比kill和tkill, 增加了多线程的保护, 通过tid和tgid基本保证信号传递到正确的线程, 而不会因为线程的消亡和构建而传递到错误的线程.

```C
int
raise (int sig)
{
  /* rt_sigprocmask may fail if:
     1. sigsetsize != sizeof (sigset_t) (EINVAL)
     2. a failure in copy from/to user space (EFAULT)
     3. an invalid 'how' operation (EINVAL)
     The first case is already handle in glibc syscall call by using the arch
     defined _NSIG.  Second case is handled by using a stack allocated mask.
     The last one should be handled by the block/unblock functions.  */
  sigset_t set;
  __libc_signal_block_app (&set);
  INTERNAL_SYSCALL_DECL (err);
  pid_t pid = INTERNAL_SYSCALL (getpid, err, 0);
  pid_t tid = INTERNAL_SYSCALL (gettid, err, 0);
  int ret = INLINE_SYSCALL (tgkill, 3, pid, tid, sig);
  __libc_signal_restore_set (&set);
  return ret;
}
```

`raise`看起来很简单, 我们也可以通过`man raise`来详细了解一下, 其说明的是:

1. raise在单线程中等同于kill;
2. raise在多线程中等同于pthread_kill;
3. raise在信号处理函数处理结束后返回;
4. raise是多线程安全的;
5. glibc 2.3.3版本后raise调用的是tgkill.(本文即是tgkill)

所以我们可以解答开头的问题:

1. `raise`是怎么实现的?

等同于tgkill, rasie发送信号给线程(进程), 然后调用对应的信号处理函数. 回忆上一篇[《glibc-abort源码阅读》](/202111/glibc-abort/), 调用abort的时候就是调用raise发送SIGABRT信号, 会有SIG_DFL之类的处理函数绑定SIGABRT信号, 从而造成进程退出.

2. `raise`的作用时机?

同信号处理, 参考[《进程控制和通信(四) · PCB介绍》](/202105/process-ctracon4)可以知道, raise是在用户陷入内核态再从内核态返回用户态的过程中会被处理. 所以, abort的作用时机也是等同于raise.

!["信号处理时机"](https://bu.dusays.com/2022/06/26/62b87a97ae35b.png "信号处理时机")

