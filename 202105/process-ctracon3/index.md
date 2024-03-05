# 进程控制和通信(三)


## 消息队列

消息队列是在内核空间开辟的一块共享内存, 类似于以下结构:

<!--more-->

!["内核提供共享区域做IPC"](https://bu.dusays.com/2022/06/26/62b87feec6917.png "内核提供共享区域做IPC")

类似于具名管道, 消息队列也有一个标识符MSG_KEY, 用来标识不同的消息队列. 只要知道某个消息队列的标识符, 并且拥有相应的权限, 就可以使用相应的消息队列. 所以, 消息队列可以在没有亲缘关系的进程间使用.

Linux系统调用为我们提供了几个C接口用于消息队列, 在[sys/msg.h](https://code.woboq.org/userspace/glibc/sysvipc/sys/msg.h.html)可以找到定义. 主要是以下4个函数:
```C
/* Message queue control operation.  */
extern int msgctl (int __msqid, int __cmd, struct msqid_ds *__buf) __THROW;
/* Get messages queue.  */
extern int msgget (key_t __key, int __msgflg) __THROW;
/* Receive message from message queue.
   This function is a cancellation point and therefore not marked with
   __THROW.  */
extern ssize_t msgrcv (int __msqid, void *__msgp, size_t __msgsz,
                       long int __msgtyp, int __msgflg);
/* Send message to message queue.
   This function is a cancellation point and therefore not marked with
   __THROW.  */
extern int msgsnd (int __msqid, const void *__msgp, size_t __msgsz,
                   int __msgflg);
```

- ```msgget```接收MSG_KEY和权限flag, 用于创建或者打开一个消息队列.
- ```msgsnd```接收msg_id和消息内容以及消息控制flag, 用于发送消息.
- ```msgrcv```接收msg_id和接收消息的容器以及消息控制flag, 用于接收消息.
- ```msgctl```接收msg_id和控制命令, 用于控制消息队列.

在[bits/ipc.h](https://code.woboq.org/qt5/include/bits/ipc.h.html)可以找到各种flag:
```
/* Mode bits for `msgget', `semget', and `shmget'.  */
#define IPC_CREAT	01000		/* Create key if key does not exist. */
#define IPC_EXCL	02000		/* Fail if key exists.  */
#define IPC_NOWAIT	04000		/* Return error on wait.  */

/* Control commands for `msgctl', `semctl', and `shmctl'.  */
#define IPC_RMID	0		/* Remove identifier.  */
#define IPC_SET		1		/* Set `ipc_perm' options.  */
#define IPC_STAT	2		/* Get `ipc_perm' options.  */
#ifdef __USE_GNU
# define IPC_INFO	3		/* See ipcs.  */
#endif
```

接下来, 我们开启两个进程, 使用消息队列实现进程间通信, 一个用于发送消息, 一个用于接收消息.

### 发送端
```C
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <errno.h>
#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/msg.h>

#define MSG_KEY 7777

struct MSG {
    long type;
    char msg[1024];
};

int main() {
    int msg_id = msgget(MSG_KEY, IPC_EXCL);
    if (msg_id < 0)
    {
        msg_id = msgget(MSG_KEY, IPC_CREAT | 0666);
    }

    if (msg_id < 0)
    {
        printf("get msg queue failed!");
        return -1;
    }
    printf("msq key %d id %d\n", MSG_KEY, msg_id);

    while(1)
    {
        struct MSG msg;
        printf("msg type: ");
        scanf("%ld", &msg.type);
        printf("msg info: ");
        scanf("%s", &msg.msg);
        int snd_id = msgsnd(msg_id, &msg, sizeof(msg.msg), IPC_NOWAIT);
        if (snd_id < 0)
        {
            printf("send msg failed with errno=%d[%s]\n", errno, strerror(errno));
    		msgctl(msg_id, IPC_RMID, 0);
            return -1;
        }
    }
}
```
发送端定义了```#define MSG_KEY 7777```, ```MSG_KEY```可以是任意的KEY, 不要和已有的混淆即可. 在创建消息队列的时候加了额外的权限, ```msgget(MSG_KEY, IPC_CREAT | 0666);```, ```6```对应的是```0110```表示read和write. 在发送消息的时候, 如果发送失败, 则会移除对应的消息队列```msgctl(msg_id, IPC_RMID, 0);```.

此外, 我们还定义了一个结构体用来作为消息容器:
```C
struct MSG {
    long type;
    char msg[1024];
};
```
第一个成员是long型, 作为消息的ID, 这意为着在同一个消息队列中, 每条消息都可以拥有不同的消息ID. 所以仅使用一个消息队列, 也可以在多个进程间实现通信, 且多个进程可以互不干扰.(关于这一点, 继续看后面的接收端就清楚了)

启动发送端程序, 输入消息ID和消息内容:
```
msq key 7777 id 1
msg type: 1
msg info: hello
msg type: 2
msg info: helloworld
```

### 接收端
```C
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/msg.h>

#define MSG_KEY 7777

struct MSG {
    long type;
    char msg[1024];
};

int main() {
    int msg_id = msgget(MSG_KEY, IPC_EXCL);
    if (msg_id < 0)
    {
        msg_id = msgget(MSG_KEY, IPC_CREAT | 0666);
    }

    if (msg_id < 0)
    {
        printf("get msg queue failed!");
        return -1;
    }
    printf("msq key %d id %d\n", MSG_KEY, msg_id);

    while(1)
    {
        struct MSG msg;
        for (int id = 0; id < 100; id++)
        {
            msg.type = id;
            int rev_id = msgrcv(msg_id, &msg, sizeof(msg.msg), msg.type, IPC_NOWAIT);
            if (rev_id > 0)
            {
                printf("rev msg[%ld]: %s\n", msg.type, msg.msg);
            }
        }
    }
}
```
接收端类似于发送端, 拥有相同的```MSG_KEY```和相同的```struct MSG```定义. 区别在与, 接收的时候不仅要有消息队列的ID, 还需要有消息的ID, 比如```msg.type```. 这意为着只有消息队列ID和消息ID都匹配时, 才可以读取到对应的消息. 所以接收端可以通过不同的消息ID, 区分不同发送端发送过来的消息, 当然最好要事先约定好消息ID. 如果没有事先约定消息ID, 则需要发送额外的消息来通知接收端以区分消息ID.

启动接收端程序, 可以收到:
```
msq key 7777 id 1
rev msg[1]: hello
rev msg[2]: helloworld
```

### 小结

使用```msgget```创建消息队列, 创建消息队列要注意权限控制, 如果异常可以使用```errno```查看错误信息, ```msgsnd```用来发送消息, ```msgrcv```用来接收消息. 如果发现消息队列异常时, 比如发送失败或者接收失败, 则最好使用```msgctl```移除对应的消息队列.

一个消息队列里面的每条消息都有对应的消息ID, 所以在消息队列ID相同的情况下, 不同进程可以通过区分消息ID以区分不同的消息发送端.

如果没有清空消息队列, 则发送的消息会缓存在消息队列中, 直到读出或者移除.

## 信号

进程间的信号通信有点类似于中断机制. 大概意思是, 当某个进程收到某个信号时, 就可以暂停进程当前的操作, 转而根据信号的类型做相应的操作(函数). 信号可以认为是一个整形的数, 所以信号的数量存在一个上限.

!["信号通信"](https://bu.dusays.com/2022/06/26/62b87ff172d04.png "信号通信")

Linux为我们提供了C的接口用于信号通信, 在[include/signal.h](https://code.woboq.org/gcc/include/signal.h.html)可以找到:
```C
/* Send signal SIG to process number PID.  If PID is zero,
   send SIG to all processes in the current process's process group.
   If PID is < -1, send SIG to all processes in process group - PID.  */
#ifdef __USE_POSIX
extern int kill (__pid_t __pid, int __sig) __THROW;
#endif /* Use POSIX.  */

/* Set the handler for the signal SIG to HANDLER, returning the old
   handler, or SIG_ERR on error.
   By default `signal' has the BSD semantic.  */
extern __sighandler_t signal (int __sig, __sighandler_t __handler)
     __THROW;
```

这里简单介绍两个, ```kill```用于发送信号, ```signal```用于处理信号.

### 发送信号
```C
#include <stdio.h>
#include <signal.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    int signo = SIGUSR1;
    int pid = atoi(argv[1]);

    kill(pid, signo);
    printf("send sig %d to pid %d\n", signo, pid);
}
```

我们要输入进程PID, 然后调用```kill```函数将信号发送给对应PID的进程:
```Shell
$ ./kill 15273
send sig 10 to pid 15273
```
则看起来很麻烦, 如果结合上述几种进程间通信方法, 就可以先使用具名管道或者消息队列通信, 告知PID, 然后再通过发送信号的方式, 处理对应的信号.

### 处理信号
```C
#include <stdio.h>
#include <signal.h>
#include <stdlib.h>

void signalPorcessor(int signo)
{
    printf("process %d receive signal %d\n", getpid(), signo);
}

int main() {
    printf("current pid %d\n", getpid());
    signal(SIGUSR1, signalPorcessor);

    while(1) {
        printf("process %d doing something\n", getpid());
        sleep(1);
    }
}
```

接收端的信号处理函数和接收端是在同一个进程:
```Shell
current pid 15273
process 15273 doing something
process 15273 doing something
process 15273 doing something
process 15273 doing something
process 15273 doing something
process 15273 receive signal -1943753024
process 15273 doing something
process 15273 doing something
```

### 小结

信号类似于软件中断, 进程在收到信号的时候, 可以转而去处理对应的信号处理函数, 处理完成之后, 回到被中断的地方继续执行.

因为信号传递需要知道对方PID, 所以可以通过其他进程通信的方式, 事先告知PID, 再使用信号传递通信.

操作系统会有很多信号, 比如Ctrl+C中断程序会触发信号, 进程越界会触发信号, 等等. 有些信号尽量不要随意使用, 它们可能负责系统的安全. 有些信号可能不能直接被使用, 比如SIGKILL和SIGSTOP, 他们用来保证进程可以被系统管理员正常杀死, 如果改写这两个进程, 则可以让进程一直存在系统中, 不被销毁.

## 共享内存

在此之前, 进程间的通信基本都在内核空间进行, 我们是否可以在用户空间进行进程间的通信呢? 这就是共享内存.

!["共享内存"](https://bu.dusays.com/2022/06/26/62b87ff3e186a.png "共享内存")

我们知道, 进程的虚拟内存空间到实际的物理内存空间会有内存映射表. 如果将不同进程的映射表的某个地址映射到同一块物理内存, 那么这些进程之间就可以通过共享这块内存而实现通信.

Linux在[sys/shm.h](https://code.woboq.org/gcc/include/sys/shm.h.html)为我们提供了操作共享内存的方法. 类比消息队列:
```C
/* The following System V style IPC functions implement a shared memory
   facility.  The definition is found in XPG4.2.  */
/* Shared memory control operation.  */
extern int shmctl (int __shmid, int __cmd, struct shmid_ds *__buf) __THROW;
/* Get shared memory segment.  */
extern int shmget (key_t __key, size_t __size, int __shmflg) __THROW;
/* Attach shared memory segment.  */
extern void *shmat (int __shmid, const void *__shmaddr, int __shmflg)
     __THROW;
/* Detach shared memory segment.  */
extern int shmdt (const void *__shmaddr) __THROW;
```

- ```shmget```接收SHM_KEY和buffer大小以及权限flag, 用于创建或者打开一个共享内存.
- ```shmat```接收shm_id, 用于获得共享内存的地址.
- ```shmdt```接收共享内存地址, 用于将共享内存和当前进程分离.
- ```shmctl```接收shm_id和控制命令, 用于控制共享内存.

下面使用两个进程, 一个向共享内存写入数据, 一个从共享内存读出数据.

### 写入内存
```C
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/shm.h>

#define SHM_KEY 7777
#define BUF_SIZ 1024

int main()
{
    time_t t;
    srand((unsigned) time(&t));

    int shm_id = shmget(SHM_KEY, BUF_SIZ, IPC_EXCL);
    if (shm_id < 0)
    {
        shm_id = shmget(SHM_KEY, BUF_SIZ, IPC_CREAT | 0666);
    }

    if (shm_id < 0)
    {
        printf("get shm failed!");
        return -1;
    }

    printf("shm key %d id %d\n", SHM_KEY, shm_id);

    char* shmem = shmat(shm_id, NULL, 0);

    for (int i = 0; i < 3; i++)
    {
        char msg[512] = {0};
        for (int j = 0; j < 20; j++)
        {
            msg[j] = rand() % 26 + 65;
        }
        memcpy(shmem, msg, BUF_SIZ);
        printf("[%d]write msg: %s\n", getpid(), shmem);
        sleep(2);
    }

    // shmdt(shmem);
    // shmctl(shm_id, IPC_RMID, NULL);
}
```
操作类似消息队列, 在写入数据时, 用时随机生成的长度20的字符串. 大概每间隔2秒向共享内存写入数据. 比如向内存写入:

```
shm key 7777 id 1802301
[24105]write msg: HAHCIUYUHCWKPKOTMWGA
[24105]write msg: VUMRNYOLVFJDHSFRPDOY
[24105]write msg: HKIWVWQHSWJPQYIFYZST
```

代码最后两句, 用于分离共享内存和当前进程, 并且移除共享内存, 这样的话, 下次再次执行时, 可能会指向不同的共享内存块:
```C
shmdt(shmem);
shmctl(shm_id, IPC_RMID, NULL);
```

### 读出内存
```C
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/shm.h>

#define SHM_KEY 7777
#define BUF_SIZ 1024

int main()
{
    int shm_id = shmget(SHM_KEY, BUF_SIZ, IPC_EXCL);
    if (shm_id < 0)
    {
        shm_id = shmget(SHM_KEY, BUF_SIZ, IPC_CREAT | 0666);
    }

    if (shm_id < 0)
    {
        printf("get shm failed!");
        return -1;
    }

    printf("shm key %d id %d\n", SHM_KEY, shm_id);

    char* shmem = shmat(shm_id, NULL, 0);
    while(1)
    {
        printf("[%d]get msg: %s\n", getpid(), shmem);
        sleep(1);
    }
}
```

间隔1秒从共享内存读取数据:
```
shm key 7777 id 1802301
[24096]get msg: OPVCCQHLNBRVUNOZLNWD
[24096]get msg: OPVCCQHLNBRVUNOZLNWD
[24096]get msg: HAHCIUYUHCWKPKOTMWGA
[24096]get msg: HAHCIUYUHCWKPKOTMWGA
[24096]get msg: VUMRNYOLVFJDHSFRPDOY
[24096]get msg: VUMRNYOLVFJDHSFRPDOY
[24096]get msg: HKIWVWQHSWJPQYIFYZST
[24096]get msg: HKIWVWQHSWJPQYIFYZST
[24096]get msg: HKIWVWQHSWJPQYIFYZST
[24096]get msg: HKIWVWQHSWJPQYIFYZST
[24096]get msg: HKIWVWQHSWJPQYIFYZST
```
会读到本次没有写入的数据```OPVCCQHLNBRVUNOZLNWD```, 这是写入进程在上次写入的数据, 依然保存在共享内存中, 因为没有调用```shmctl```移除对应内存. 同时也发现每条数据会读到多次, 因为共享内存并没有提供同步机制. 所以单独使用共享内存时, 可能会遇到一些问题:

- 多次读取同一个数据(读比写快)
- 丢失数据(写比读快)
- 乱序(读到一半时, 又重新写)

为了解决这些问题, 我们可以使用其他的进程通信方式以达到同步的目的. 比如使用信号, 写入进程写完数据后, 发送信号, 读取进程捕获信号, 进入相应函数读取数据, 同时发送信号给写入进程, 表示已经读完数据, 可以继续写入. 当然, 有很多方式可以保证共享内存的同步, 接下来要介绍的信号量也可以用来解决共享内存的同步问题.

### 小结

使用shmget创建或者打开共享内存, 通过shmat获取共享内存的地址, 拿到地址后就可以像一块普通内存一样操作它, 通过shmdt和shmctl可以分离当前进程和共享内存然后移除它.

如果写端移除了共享内存, 读端还在继续读的话, 读端依然可以正常工作, 但是其数据不再更新.

共享内存会有同步问题, 因为共享内存的相关操作都不是原子操作, 所以需要搭配其他的IPC方式以解决共享内存的同步问题.

## 信号量

可以认为信号量是一个计数器, 并且对信号量的操作是原子操作. 信号量维护了一个计数器sv, 可以对sv进行+1和-1的操作. 那么, 有如下规定:

- 执行-1操作(P操作), 如果计数器sv大于0, 则sv减1, 否则, 如果sv等于0, 则挂起调用进程
- 执行+1操作(V操作), 如果有其他进程因为sv等于0被挂起, 则回复对应进程, 否则, 计数器sv加1

如果我们定义一个信号量, 其值只有0和1, 那么就可以实现简单的互斥锁. 这时可能有以下流程:

1. 初始化信号量sv的值为1
2. 进程1调用信号量, 试图执行-1操作, 由于sv大于0, 则执行-1操作, 继续往下执行
3. 此时, 如果进程2调用信号量,  试图执行-1操作, 由于sv等于0, 则进程2被挂起
4. 进程1处理完, 调用信号量, 试图执行+1操作, 由于进程2因为sv等于0被挂起, 则回复进程2, 此时sv等于0
5. 进程2执行, 进程1再次执行到信号量时, 也会被挂起, 只能等待其他进程试图执行+1操作是, 进程1才会被回复

以上, 我们来实现简单的互斥锁, 信号量-1时对应lock操作, 信号量+1时对应unlock操作.

Linux为我们提供了对信号的基本操作:

```C
/* Semaphore control operation.  */
extern int semctl (int __semid, int __semnum, int __cmd, ...) __THROW;
/* Get semaphore.  */
extern int semget (key_t __key, int __nsems, int __semflg) __THROW;
/* Operate on semaphore.  */
extern int semop (int __semid, struct sembuf *__sops, size_t __nsops) __THROW;
```

- ```semget``` 用于获取或者创建信号量, 输入SEM_KEY参数和信号量数目以及权限flag
- ```semop``` 用于对信号量的基本操作, 可以执行+1或者-1操作
- ```semctl``` 用于对信号量的基本控制, 包括初始化, 移除等

```semop```中的```sembuf```定义如下:

```C
struct sembuf
{
  unsigned short int sem_num;	/* semaphore number */
  short int sem_op;		/* semaphore operation */
  short int sem_flg;		/* operation flag */
};
```

### 实现互斥锁

将信号量的操作抽象为lock和unlock函数, lock函数表示当前进程正在操作资源, 只它进程访问到lock时会被挂起, unlock这表示当前进程已经访问完资源, 其他进程可以竞争抢占这个资源. 定义```utils.h```文件:
```C
#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <sys/sem.h>

struct sembuf sem;
union semun
{
    int val;
    struct semid_ds *buf;
    unsigned short int *array;
    struct seminfo *__buf;
};

void init(int sem_id)
{
    union semun sem_union;

    sem_union.val = 1;
    semctl(sem_id, 0, SETVAL, sem_union);
}
void uinit(int sem_id)
{
    union semun sem_union;
    semctl(sem_id, 0, IPC_RMID, sem_union);
}
void lock(int sem_id)
{
    sem.sem_num = 0;
    sem.sem_op = -1;
    sem.sem_flg = SEM_UNDO;
    semop(sem_id, &sem, 1);
}
void unlock(int sem_id)
{
    sem.sem_num = 0;
    sem.sem_op = 1;
    sem.sem_flg = SEM_UNDO;
    semop(sem_id, &sem, 1);
}
```
结构体```union semun```在```semctl```有用, Linux现在没有定义这个结构体, 需要用户自行定义. [bits/sem.h](https://code.woboq.org/qt5/include/bits/sem.h.html)中解释如下:
```C
/* The user should define a union like the following to use it for arguments
   for `semctl'.
   union semun
   {
     int val;				<= value for SETVAL
     struct semid_ds *buf;		<= buffer for IPC_STAT & IPC_SET
     unsigned short int *array;		<= array for GETALL & SETALL
     struct seminfo *__buf;		<= buffer for IPC_INFO
   };
   Previous versions of this file used to define this union but this is
   incorrect.  One can test the macro _SEM_SEMUN_UNDEFINED to see whether
   one must define the union or not.  */
#define _SEM_SEMUN_UNDEFINED	1
```
可以使用宏```_SEM_SEMUN_UNDEFINED```判断是否需要自定义. 可以看注释, val用于set值, 其他成员的用法暂不清楚.

init函数用于初始化, 将信号量的值初始化为0.

uinit则用于移除信号量.

### 结合共享内存实现写入端

```C
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <sys/sem.h>
#include "utils.h"

#define SHM_KEY 7777
#define SEM_KEY 8888
#define BUF_SIZ 1024

int main(int argc, char **argv)
{
    time_t t;
    srand((unsigned) time(&t));
    if (argc > 1)
    {
        srand(atoi(argv[1]));
    }

    int shm_id = shmget(SHM_KEY, BUF_SIZ, IPC_CREAT | 0666);
    int sem_id = semget(SEM_KEY, 1, IPC_CREAT | 0666);
    init(sem_id);
    printf("shm key %d id %d, sem key %d id %d\n", SHM_KEY, shm_id, SEM_KEY, sem_id);

    char* shmem = shmat(shm_id, NULL, 0);
    for (int i = 0; i < 3; i++)
    {
        char msg[512] = {0};
        for (int j = 0; j < 20; j++)
        {
            msg[j] = rand() % 26 + 65;
        }
        lock(sem_id);
        memcpy(shmem, msg, BUF_SIZ);
        unlock(sem_id);
        printf("[%d]write msg: %s\n", getpid(), shmem);
        sleep(1);
    }
    uinit(sem_id);
    printf("[%d]write done\n", getpid());
}
```
正常情况下, 可以看到以下输出:
```Shell
$ ./write & ./write 1 & ./write 2 & ./write 3
[1] 16970
[2] 16971
[3] 16973
shm key 7777 id 1867816, sem key 8888 id 10
[16970]write msg: NUHUWAWMIXYSWZZLVBED
shm key 7777 id 1867816, sem key 8888 id 10
[16971]write msg: NWLRBBMQBHCDARZOWKKY
shm key 7777 id 1867816, sem key 8888 id 10
[16973]write msg: EBGNHAMDHNUXBVZLUFPK
shm key 7777 id 1867816, sem key 8888 id 10
[16976]write msg: GVWQTYSKRGSEDLWPMVFX
[16970]write msg: ZHFMVCTSCFVPBCKYDIMN
[16971]write msg: HIDDQSCDXRJMOWFRXSJY
[16973]write msg: KSNBVDSSSJDWKKJUMXXT
[16976]write msg: RAEATJRJUUYASWSLVKYO
[16970]write msg: HLGEMFRJIYMIHRWCVPUX
[16971]write msg: BLDBEFSARCBYNECDYGGX
[16973]write msg: NTSOORAIYRSLLIMGNHAF
[16976]write msg: SQSVCRNOMSNFSRGLCZWW
[16970]write done
[16973]write done
[16971]write done
[16976]write done
[1]   Done                    ./write
[2]-  Done                    ./write 1
[3]+  Done                    ./write 2
```
这是符合预期的, 如果我们删除unlock操作, 则会发现, 进程会卡住:
```Shell
$ ./write & ./write 1 & ./write 2 & ./write 3
[1] 20832
[2] 20833
[3] 20834
shm key 7777 id 1867816, sem key 8888 id 11
[20832]write msg: EXOIWWVYGLJNJUAKPSLZ
shm key 7777 id 1867816, sem key 8888 id 11
[20833]write msg: NWLRBBMQBHCDARZOWKKY
shm key 7777 id 1867816, sem key 8888 id 11
[20834]write msg: EBGNHAMDHNUXBVZLUFPK
shm key 7777 id 1867816, sem key 8888 id 11
[20835]write msg: GVWQTYSKRGSEDLWPMVFX
// 卡在这
```
这是因为触发了sv等于0的情况, 进程都被挂起了. 并且, 因为每个进程都会做一个init操作, 使得被减为0的sv也会被初始化为1, 所以可能的情况是:
1. 所有进程都会执行一次, 然后都被卡在第二次lock函数处
2. 反复调用程序, 可能会解开一些lock住的进程

### 结合共享内存实现读取端

```C
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <sys/sem.h>
#include "utils.h"

#define SHM_KEY 7777
#define SEM_KEY 8888
#define BUF_SIZ 1024

int main()
{
    int shm_id = shmget(SHM_KEY, BUF_SIZ, IPC_CREAT | 0666);
    int sem_id = semget(SEM_KEY, 1, IPC_CREAT | 0666);
    init(sem_id);
    printf("shm key %d id %d, sem key %d id %d\n", SHM_KEY, shm_id, SEM_KEY, sem_id);

    char* shmem = shmat(shm_id, NULL, 0);
    while(1)
    {
        lock(sem_id);
        printf("[%d]get msg: %s\n", getpid(), shmem);
        unlock(sem_id);
        // sleep(1);
    }
    uinit(sem_id);
}
```
读取端比较简单, 添加信号量保证读取是原子的就好.

### 小结

信号量操作类似于消息队列和共享内存, 通过semget打开或者创建, 通过semop操作, 通过semctl初始化或者删除.

要区分信号量和信号, 可以将信号量类比于互斥锁, 将信号类比与中断, 两者是不同的. 信号量保证不同进程对共享资源的同步, 信号则是让不同进程可以根据不同信号执行相应操作.

操作信号量要考虑清楚, 也可能会出现死锁的情况.
