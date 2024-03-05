# glibc-abort源码阅读


## 问题
关于`abort`函数，有几个想调查的问题：

<!--more-->

1. `abort`是退出当前线程还是退出当前进程?
2. `abort`和`raise`/`exit`的区别是什么?


通过测试代码, 我们可以验证问题一, 通过阅读源码, 尽量来理解问题二.

## 测试
```C++
#include <thread>
#include <cstdlib>
#include <iostream>
#include <chrono>
#include <exception>

using namespace std;

int main()
{
    thread t1([]() {
        int cnt = 20;
        while (cnt-- > 0)
        {
            cout << "cnt=" << cnt << endl;
            this_thread::sleep_for(std::chrono::seconds(1));
        }
    });

    thread t2([]() {
        this_thread::sleep_for(std::chrono::seconds(2));
        cout << "t2 abort" << endl;
        try
        {
            abort();
        }
        catch (exception &e)
        {
        }
    });

    if (t1.joinable())
        t1.join();
    if (t2.joinable())
        t2.join();

    return 1;
}
```
开始编译:
```Shell
g++ main.cpp -o main --std=c++11 -lpthread
```
输出结果:
```Shell
cnt=19
cnt=18
t2 abort
Aborted (core dumped)
```
通过这个测试可以直到, `abort`会导致进程的退出.

## 源码

首先是与abort相关的一些全局变量的定义, 如下, 有stage和lock, 并且此处的lock是递归lock. 这里可以看到递归锁是通过一个计数器实现的, 这里想到了信号量, 可以参考或对比[《《UCB CS61a SICP Python 中文》一周目笔记(四)》](/202109/sicp-python-read4)和[《进程控制和通信(三) · 消息、信号、共享内存》](/202105/process-ctracon3).

为什么使用递归锁? 有些系统调用函数也不太清楚, 所以不太好下结论. 不过, 这里的递归锁可以保护stage的状态, 至少是有这个用处的. 使用递归的目的, 也是因为abort确实可能存在递归调用(用户性为上的).

从这里我们也可以看到abort的行为是对进程的.
```C
/* We must avoid to run in circles.  Therefore we remember how far we
   already got.  */
static int stage;
/* We should be prepared for multiple threads trying to run abort.  */
__libc_lock_define_initialized_recursive (static, lock);
```

接下来是处理函数, 我们分为几个部分来看:

补充一个知识点: 信号掩码是对线程而言的. 第一部分是设置信号掩码, 允许SIGABRT信号.

尝试第一次raise SIGABRT信号, 用户可能绑定SIGABRT的信号处理函数, 这时候会去处理用户的信号函数. 这里考虑的问题是raise可能失败(去处理用户信号函数, 可能不引起SIGABRT退出), 所以会有后续操作.
```C
/* Cause an abnormal program termination with core-dump.  */
void
abort (void)
{
  struct sigaction act;
  sigset_t sigs;
  /* First acquire the lock.  */
  __libc_lock_lock_recursive (lock);
  /* Now it's for sure we are alone.  But recursive calls are possible.  */
  /* Unblock SIGABRT.  */
  if (stage == 0)
    {
      ++stage;
      __sigemptyset (&sigs);
      __sigaddset (&sigs, SIGABRT);
      __sigprocmask (SIG_UNBLOCK, &sigs, 0);
    }
  /* Send signal which possibly calls a user handler.  */
  if (stage == 1)
    {
      /* This stage is special: we must allow repeated calls of
         `abort' when a user defined handler for SIGABRT is installed.
         This is risky since the `raise' implementation might also
         fail but I don't see another p
         ossibility.  */
      int save_stage = stage;
      stage = 0;
      __libc_lock_unlock_recursive (lock);
      raise (SIGABRT);
      __libc_lock_lock_recursive (lock);
      stage = save_stage + 1;
    }
  //...
```

执行用户绑定的信号函数后, 现在将SIG_DFL绑定到SIGABRT上, 然后raise SIGABRT信号.

SIG_DFL是默认信号处理函数, 其值是0, 调用SIG_DFL相当于是访问0地址, 被禁止访问, 这时候就会退出进程了.
```C
  /* There was a handler installed.  Now remove it.  */
  if (stage == 2)
    {
      ++stage;
      memset (&act, '\0', sizeof (struct sigaction));
      act.sa_handler = SIG_DFL;
      __sigfillset (&act.sa_mask);
      act.sa_flags = 0;
      __sigaction (SIGABRT, &act, NULL);
    }
  /* Try again.  */
  if (stage == 3)
    {
      ++stage;
      raise (SIGABRT);
    }
```

又担心raise失败, 这时候调用汇编的hlt命令(ABORT_INSTRUCTION调用的是htl命令), 使得逻辑CPU处于睡眠状态, 这时候相当于不再给当前进程CPU资源了.

如果hlt失败, 则又尝试exit退出.

如果exit失败, 则又不停地尝试hlt.
```C

  /* Now try to abort using the system specific command.  */
  if (stage == 4)
    {
      ++stage;
      ABORT_INSTRUCTION;
    }
  /* If we can't signal ourselves and the abort instruction failed, exit.  */
  if (stage == 5)
    {
      ++stage;
      _exit (127);
    }
  /* If even this fails try to use the provided instruction to crash
     or otherwise make sure we never return.  */
  while (1)
    /* Try for ever and ever.  */
    ABORT_INSTRUCTION;
}
```

现在我们知道abort是通过调用raise/exit/hlt这些命令使得进程退出的. 不过这里也有疑问, 为什么需要做这么多后备处理? raise/exit/hlt在哪些情况下会失败呢? (TODO)

(这里的`exit`是指系统调用的`_exit`，可以关联[《glibc-exit源码阅读》](/202201/glibc-exit))
