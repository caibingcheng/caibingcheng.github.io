# 进程控制和通信(四)


在前面的文章中, 我们学习了进程通信的几种方式, 并且也接触到了内核控制进程的结构块```task_struct```, ```task_struct```的内容主要会分为以下几个部分, 通过这一篇文章可以学习这些部分的大体内容.

<!--more-->

## task_struct

!["task_struct"](https://img-blog.csdnimg.cn/20200520105420402.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3dlaXhpbl80MDk5NDU1Mg==,size_16,color_FFFFFF,t_70 "task_struct")

- 任务ID: 用于区分进程, 是进程的身份证, 比如pid就属于任务ID
- 亲缘关系: 包含兄弟进程, 父子进程的信息
- 任务状态: 用于标识当前进程的运行状态, 比如running, runable, stop, wait等;
- 权限: 进程权限信息, 包括本进程对外以及外对本进程的权限
- 运行统计: 包括启动时间, cpu占用时间等信息
- 调度相关: 包含进程优先级, 调度策略等信息
- 信号处理: 阻塞/等待等信息, 以及信号处理函数(见[进程控制和进程通信三](/202105/process-ctracon3))
- 内存管理: 进程虚拟内存空间
- 文件与文件系统: 进程文件
- 内核栈: 内核栈地址

## 任务ID

和任务ID相关的成员大概有以下:
```C
pid_t				pid;                            // 进程id
pid_t				tgid;                           // 线程group id
struct task_struct		*group_leader;              // 线程group leader
```

```group_leader```是指向线程group第一个task的指针. 比如在```setpgid```函数中会用到.

Linux将```current```包装为了一个宏, 用来获取在当前CPU上运行的```task_struct```地址.
```C
DECLARE_PER_CPU(struct task_struct *, current_task);
static __always_inline struct task_struct *get_current(void)
{
	return this_cpu_read_stable(current_task);
}
#define current get_current()
```

一般, 我们可以调用```getpid```获取进程的进程id, 实际上```getpid```返回的是```task_struct```的```tgid```. (当然这个函数的调用栈不是这么简单的, 还涉及到了Linux的namespace概念, 这里就先简单处理了, 以下的接口同样简单处理)
```C
SYSCALL_DEFINE0(getpid)
{
	return task_tgid_vnr(current);
}
```

同样, 我们也可以用```gettid```获取当前线程的线程id, 实际上```gettid```返回的是```task_struct```的```pid```.
```C
SYSCALL_DEFINE0(gettid)
{
	return task_pid_vnr(current);
}
```

另外, 也可以通过```getppid```获取父进程的进程id, 实际上```getppid```返回的是```task_struct```的```real_parent```的```tgid```.
```C
SYSCALL_DEFINE0(getppid)
{
	int pid;
	rcu_read_lock();
	pid = task_tgid_vnr(rcu_dereference(current->real_parent));
	rcu_read_unlock();
	return pid;
}
```

对内核来说, 没有区分进程和线程的概念, 在内核中, 这两种概念都叫task, 由```task_struct```结构体管理. 所以, 怎么来区分进程和线程呢? 内核会用```pid```和```tgid```两个成员区分, ```pid```表示的当前```task_struct```的id, 可以认为是```task_struct```的标识符, 每个task都不一样. 如果某个进程/线程创建了一个子线程, 那么就会生成一个新的```pid```, 但是会继承父结点的```tgid```.

!["pid和tgid"](https://bu.dusays.com/2022/06/26/62b880022a82b.png "pid和tgid")

为什么有这两个概念? 我猜是因为从单核单进程时代到多进程时代迁移的遗留问题.

## 亲缘关系

与task亲缘关系相关的成员如下:
```C
/* Real parent process: */
struct task_struct __rcu	*real_parent;
/* Recipient of SIGCHLD, wait4() reports: */
struct task_struct __rcu	*parent;
/* Children/sibling form the list of natural children: */
struct list_head		children;
struct list_head		sibling;
```

```real_parent```指向的是真正的parent进程, 如下是进程```clone```时的一段代码, 可以看到```real_parent```是指向子(新)进程的父进程. 如果创建的是thread, 则和父进程的```real_parent```相同.
```C
/* CLONE_PARENT re-uses the old parent */
if (clone_flags & (CLONE_PARENT|CLONE_THREAD)) {
    p->real_parent = current->real_parent;
    p->parent_exec_id = current->parent_exec_id;
} else {
    p->real_parent = current;
    p->parent_exec_id = current->self_exec_id;
}
```
```parent```指向的是给当前进程传递```SIGCHLD```信号的进程, 这个进程一般是debug进程, 比如GDB调试进程, 这时候```parent```就是指向的GDB进程.

比如```ptrace```的link阶段, 就会更新```parent```的指向.
```C
void __ptrace_link(struct task_struct *child, struct task_struct *new_parent,
		   const struct cred *ptracer_cred)
{
	BUG_ON(!list_empty(&child->ptrace_entry));
	list_add(&child->ptrace_entry, &new_parent->ptraced);
	child->parent = new_parent;
	child->ptracer_cred = get_cred(ptracer_cred);
}
```

关于```parent```的参考信息可见[kernelnewbies:parent和real_parent](https://www.mail-archive.com/kernelnewbies@kernelnewbies.org/msg04745.html).

```children```用于存放子进程指针, ```sibling```存放兄弟进程指针;

## 任务状态

与任务状态相关的一些成员如下:
```C
/* -1 unrunnable, 0 runnable, >0 stopped: */
volatile long			state;
/* Per task flags (PF_*), defined further below: */
unsigned int			flags;
int				exit_state;
```

以下是关于state的描述:
```C
/* Used in tsk->state: */
#define TASK_RUNNING			0x0000
#define TASK_INTERRUPTIBLE		0x0001
#define TASK_UNINTERRUPTIBLE	0x0002
#define __TASK_STOPPED			0x0004
#define __TASK_TRACED			0x0008
/* Used in tsk->exit_state: */
#define EXIT_DEAD				0x0010
#define EXIT_ZOMBIE				0x0020
#define EXIT_TRACE				(EXIT_ZOMBIE | EXIT_DEAD)
/* Used in tsk->state again: */
#define TASK_PARKED				0x0040
#define TASK_DEAD				0x0080
#define TASK_WAKEKILL			0x0100
#define TASK_WAKING				0x0200
#define TASK_NOLOAD				0x0400
#define TASK_NEW				0x0800
#define TASK_STATE_MAX			0x1000
/* Convenience macros for the sake of set_current_state: */
#define TASK_KILLABLE			(TASK_WAKEKILL | TASK_UNINTERRUPTIBLE)
#define TASK_STOPPED			(TASK_WAKEKILL | __TASK_STOPPED)
#define TASK_TRACED				(TASK_WAKEKILL | __TASK_TRACED)
#define TASK_IDLE				(TASK_UNINTERRUPTIBLE | TASK_NOLOAD)
/* Convenience macros for the sake of wake_up(): */
#define TASK_NORMAL				(TASK_INTERRUPTIBLE | TASK_UNINTERRUPTIBLE)
/* get_task_state(): */
#define TASK_REPORT				(TASK_RUNNING | TASK_INTERRUPTIBLE | \
					 			TASK_UNINTERRUPTIBLE | __TASK_STOPPED | \
					 			__TASK_TRACED | EXIT_DEAD | EXIT_ZOMBIE | \
					 			TASK_PARKED)
```
总的来说, 进程状态可以分为以下几种: 可运行, 等待(中断/不可中断), 退出(僵死/销毁), 暂停. 这些对应的状态通过ps aux命令也可以查看, 基本是对应的.

- ```TASK_RUNNING```表示是可运行的状态, 可运行不仅仅是runable的意思, 也表示running. 实际上处于```TASK_RUNNING```状态的task会被安排进```runqueue```, 那么其状态可能是等待执行或者正在执行. 如下一段代码是计算task运行时间的, 如果task状态是```TASK_RUNNING```就被塞进```runqueue```.
```C
/*
 * Called when a process ceases being the active-running process involuntarily
 * due, typically, to expiring its time slice (this may also be called when
 * switching to the idle task).  Now we can calculate how long we ran.
 * Also, if the process is still in the TASK_RUNNING state, call
 * sched_info_queued() to mark that it has now again started waiting on
 * the runqueue.
 */
static inline void sched_info_depart(struct rq *rq, struct task_struct *t)
{
	unsigned long long delta = rq_clock(rq) - t->sched_info.last_arrival;
	rq_sched_info_depart(rq, delta);
	if (t->state == TASK_RUNNING)
		sched_info_queued(rq, t);
}
```
- ```TASK_INTERRUPTIBLE```和```TASK_UNINTERRUPTIBLE```可以表示task的两种等待状态. 在task运行时, 如果需要等待一些IO设备的返回, 就会处于等待状态. 处于```TASK_INTERRUPTIBLE```状态的task可以被一些信号唤醒, 转而去执行信号处理函数; 处于```TASK_UNINTERRUPTIBLE```状态的task则不可被信号唤醒, 只能一直等待当前IO返回, 此时一般只能通过重启电脑来杀死这个进程. 通过一些状态的组合, 就可以生成一些更复杂的状态, 比如```TASK_KILLABLE```, 就表示task不可被一般信号唤醒, 但是可以被系统的kill信号唤醒, 这个状态在控制一些重要进程时是很有用的.

- ```TASK_DEAD```和```EXIT_ZOMBIE```表示进程的僵死状态. 在task处于退出状态时, 会处于```TASK_DEAD```状态, 此时```exit_state```工作. task退出会清空task资源, 但是```task_struct```这个结构体资源还在保留, 需要父进程清理(调用```wait```). 为什么需要父进程清理? 因为```task_struct```中保留了task的退出状态码, 这是需要返回给父进程的, 所以需要被父进程清理. 如果父进程没有清理```task_struct```, 那么这个只有一个空壳```task_struct```的task就会占用内核task队列中的资源, 这种就叫僵尸进程. 如果系统中充斥了大量的僵尸进程, 就会占满task队列, 导致不能有新的进程产生. 如果僵尸进程的父进程退出了, 但是没有清理僵尸进程呢? 这时候僵尸进程就被init进程接管, 此时init进程会自动清理僵尸进程.

- ```TASK_DEAD```和```EXIT_DEAD```表示进程的正常退出状态. 比如用```detach```分离一个线程, 那么线程退出时直接就是```EXIT_DEAD```状态. 其他例子不再叙述, 但是也有一个问题(TODO): task正常退出时, 是先处于```EXIT_ZOMBIE```然后再处于```EXIT_DEAD```吗?

- ```TASK_STOPPED```和```TASK_TRACED```可以表示进程的暂停状态. ```TASK_STOPPED```状态是在task收到```SIGSTOP/SIGTTIN/SIGTSTP/SIGTTOU```信号后进入的状态. ```TASK_TRACED```是调试进程监控当前task时, 如果调试进程暂停了当前进程则会进入该状态.

关于state的状态转换, 可以参考如下:
![state状态机](https://static001.geekbang.org/resource/image/e2/88/e2fa348c67ce41ef730048ff9ca4c988.jpeg "state状态机")

以下是task的flag:
```C
/*
 * Per process flags
 */
#define PF_IDLE				0x00000002	/* I am an IDLE thread */
#define PF_EXITING			0x00000004	/* Getting shut down */
#define PF_EXITPIDONE		0x00000008	/* PI exit done on shut down */
#define PF_VCPU				0x00000010	/* I'm a virtual CPU */
#define PF_WQ_WORKER		0x00000020	/* I'm a workqueue worker */
#define PF_FORKNOEXEC		0x00000040	/* Forked but didn't exec */
#define PF_MCE_PROCESS		0x00000080  /* Process policy on mce errors */
#define PF_SUPERPRIV		0x00000100	/* Used super-user privileges */
#define PF_DUMPCORE			0x00000200	/* Dumped core */
#define PF_SIGNALED			0x00000400	/* Killed by a signal */
#define PF_MEMALLOC			0x00000800	/* Allocating memory */
#define PF_NPROC_EXCEEDED	0x00001000	/* set_user() noticed that RLIMIT_NPROC was exceeded */
#define PF_USED_MATH		0x00002000	/* If unset the fpu must be initialized before use */
#define PF_USED_ASYNC		0x00004000	/* Used async_schedule*(), used by module init */
#define PF_NOFREEZE			0x00008000	/* This thread should not be frozen */
#define PF_FROZEN			0x00010000	/* Frozen for system suspend */
#define PF_KSWAPD			0x00020000	/* I am kswapd */
#define PF_MEMALLOC_NOFS	0x00040000	/* All allocation requests will inherit GFP_NOFS */
#define PF_MEMALLOC_NOIO	0x00080000	/* All allocation requests will inherit GFP_NOIO */
#define PF_LESS_THROTTLE	0x00100000	/* Throttle me less: I clean memory */
#define PF_KTHREAD			0x00200000	/* I am a kernel thread */
#define PF_RANDOMIZE		0x00400000	/* Randomize virtual address space */
#define PF_SWAPWRITE		0x00800000	/* Allowed to write to swap */
#define PF_MEMSTALL			0x01000000	/* Stalled due to lack of memory */
#define PF_UMH				0x02000000	/* I'm an Usermodehelper process */
#define PF_NO_SETAFFINITY	0x04000000	/* Userland is not allowed to meddle with cpus_allowed */
#define PF_MCE_EARLY		0x08000000  /* Early kill for mce process policy */
#define PF_MEMALLOC_NOCMA	0x10000000	/* All allocation request will have _GFP_MOVABLE cleared */
#define PF_FREEZER_SKIP		0x40000000	/* Freezer should not count it as freezable */
#define PF_SUSPEND_TASK		0x80000000  /* This thread called freeze_processes() and should not be frozen */
```
内容比较多, 但是可以通过这些注释了解到, ```flag```也是表示当前进程的一些状态, 但是不全是运行状态. 比如```flag```可以表示一个进程是不是kernal的/该进程是否可以被frozen等等.

关于```flag```的读写权限, 代码中有如下说明: 除了trace进程和```fork```时的父进程以及当前进程可以读写```flag```以外, 其他进程只能读当前进程的```flag```.
```
/*
 * Only the _current_ task can read/write to tsk->flags, but other
 * tasks can access tsk->flags in readonly mode for example
 * with tsk_used_math (like during threaded core dumping).
 * There is however an exception to this rule during ptrace
 * or during fork: the ptracer task is allowed to write to the
 * child->flags of its traced child (same goes for fork, the parent
 * can write to the child->flags), because we're guaranteed the
 * child is not running and in turn not changing child->flags
 * at the same time the parent does it.
 */
```

## 权限

和权限相关的成员如下:
```C
/* Process credentials: */
/* Tracer's credentials at attach: */
const struct cred __rcu		*ptracer_cred;
/* Objective and real subjective task credentials (COW): */
const struct cred __rcu		*real_cred;
/* Effective (overridable) subjective task credentials (COW): */
const struct cred __rcu		*cred;
```
对一个task的权限管理分为了三类: trace的权限, 其他task的权限, 当前task的权限. 要了解权限的大体内容, 需要关注```cred```结构体:
```C
struct cred {
	atomic_t	usage;
#ifdef CONFIG_DEBUG_CREDENTIALS
	atomic_t	subscribers;	/* number of processes subscribed */
	void		*put_addr;
	unsigned	magic;
#define CRED_MAGIC	0x43736564
#define CRED_MAGIC_DEAD	0x44656144
#endif
	kuid_t		uid;		/* real UID of the task */
	kgid_t		gid;		/* real GID of the task */
	kuid_t		suid;		/* saved UID of the task */
	kgid_t		sgid;		/* saved GID of the task */
	kuid_t		euid;		/* effective UID of the task */
	kgid_t		egid;		/* effective GID of the task */
	kuid_t		fsuid;		/* UID for VFS ops */
	kgid_t		fsgid;		/* GID for VFS ops */
	// .......
	kernel_cap_t	cap_inheritable; /* caps our children can inherit */
	kernel_cap_t	cap_permitted;	 /* caps we're permitted */
	kernel_cap_t	cap_effective;	 /* caps we can actually use */
	kernel_cap_t	cap_bset;		 /* capability bounding set */
	kernel_cap_t	cap_ambient;	 /* Ambient capability set */
	// .......
} __randomize_layout;
```
可以看到一个```cred```主要储存了一些user id和group id以及表示能力的cap.

- ```uid/gid```表示当前task的id, 一般是谁启动这个task那么就表示谁.
- ```suid/sgid```让本来没有相应权限的用户运行这个程序时, 可以访问他没有权限访问的资.passwd就是一个很鲜明的例子.([linux：SUID、SGID详解](https://www.cnblogs.com/fhefh/archive/2011/09/20/2182155.html))
- ```euid/egid```表示当前task可以操作的一些资源的权限, 比如共享内存/管道等等, 这时候就可以比较这个用户和用户组是否有权限可以操作.
- ```fsuid/fsgid```表示当前task可以操作的文件系统的权限, 比如文件打开/读写时, 就会比较这个用户和用户组是否有对应的权限.

以上的```*id```都是对用户和用户组授权, 权限粒度比较大, 比如某些task期望给普通用户运行, 但是又期望可以得到一些更高级的权限. 如果只使用```*id```来区分, 则可能需要赋予root之类高级用户的权限, 相对是不安全的. 这时候```kernel_cap_t```就起到作用了. ```kernel_cap_t```相当于是一个mask, 通过这个mask可以控制用户的权限粒度, 达到更精细的权限控制的目的. 这样就算是普通用户也可以得到高级用户某些必要权限, 而不污染其他权限.

关于```cred```和```real_cred```在[源码](https://code.woboq.org/linux/linux/include/linux/cred.h.html#cred)中有以下解释:
```
/*
 * The security context of a task
 *
 * The parts of the context break down into two categories:
 *
 *  (1) The objective context of a task.  These parts are used when some other
 *	task is attempting to affect this one.
 *
 *  (2) The subjective context.  These details are used when the task is acting
 *	upon another object, be that a file, a task, a key or whatever.
 *
 * Note that some members of this structure belong to both categories - the
 * LSM security pointer for instance.
 *
 * A task has two security pointers.  task->real_cred points to the objective
 * context that defines that task's actual details.  The objective part of this
 * context is used whenever that task is acted upon.
 *
 * task->cred points to the subjective context that defines the details of how
 * that task is going to act upon another object.  This may be overridden
 * temporarily to point to another security context, but normally points to the
 * same context as task->real_cred.
 */
```

## 运行统计

主要是task的一些时间相关的状态信息.
```C
u64				utime;				//用户态消耗的CPU时间
u64				stime;				//内核态消耗的CPU时间
/* Context switch counts: */
unsigned long			nvcsw;		//自愿的上下文切换计数
unsigned long			nivcsw;		//非自愿的上下文切换计数
/* Monotonic time in nsecs: */
u64				start_time;			//进程启动时间, 不包含睡眠时间
/* Boot based time in nsecs: */
u64				real_start_time;	//进程启动时间, 包含睡眠时间
```

## 调度相关
调度相关成员如下:
```C
int							prio;
int							static_prio;
int							normal_prio;
unsigned int				rt_priority;
const struct sched_class	*sched_class;
struct sched_entity			se;
struct sched_rt_entity		rt;
```
这里在看相关资料的时候发现task的优先级还是比较复杂的, 涉及到了不同的调度器, 不同的调度策略等等. 所以调度相关的内容还需要额外一个篇幅来说明的(TODO). 这里就简单介绍一下吧~

首先我们可以在[prio.h](https://code.woboq.org/linux/linux/include/linux/sched/prio.h.html#23)中找到一些和prio相关的定义.
```C
#define MAX_NICE	19
#define MIN_NICE	-20

#define MAX_USER_RT_PRIO	100
#define MAX_RT_PRIO			MAX_USER_RT_PRIO				// 100
#define MAX_PRIO			(MAX_RT_PRIO + NICE_WIDTH)		// 140
#define DEFAULT_PRIO		(MAX_RT_PRIO + NICE_WIDTH / 2)  // 120
```
优先级的值越低这表示优先级越高.

```*_NICE```决定了用户可以设置的task的优先级范围, 比如是```[-19, 20]```. 通过```nice -n```和```renice -n N -p PID```命令, 我们可以对某个程序或者对当前的某个进程设置其nice值. nice值越低则表示优先级越高.

nice的结果是会作用在```*_prio```成员上的, 所以nice也只能部分控制task的优先级. 比如参考如下的计算方法:
```C
#define NICE_TO_PRIO(nice)	((nice) + DEFAULT_PRIO)
#define PRIO_TO_NICE(prio)	((prio) - DEFAULT_PRIO)
```

系统也规定了优先级的范围, 最大范围是[0, 139]. 但是会将这个范围分成几个部分:
- ```[0, MAX_RT_PRIO-1]```表示RT的task的优先级范围.
- ```[MAX_RT_PRIO, MAX_PRIO-1]```表示```SCHED_NORMAL/SCHED_BATCH```的task的优先级范围.

比如查看系统进程信息:
```
$ ps -la
F S   UID   PID  PPID  C PRI  NI ADDR SZ WCHAN  TTY          TIME CMD
4 S  1000 16697  8335  0  80   0 - 537617 futex_ pts/4   00:01:19 hugo
```
可以看到hugo对应的NI(nice)值是0, PRI(prio)是80, 可以尝试设置hugo的nice值.
```
$ renice -n 20 -p 16697 && ps -la | grep hugo
16697 (process ID) old priority 0, new priority 19
4 S  1000 16697  8335  0  99  19 - 537617 ep_pol pts/4   00:01:20 hugo
```
我们设置了nice为20, 但是实际应用的只有19, priority也只能到99. 这是因为hugo这个进程是RT的, 最大优先级也只能到99.
如果再设置nice值<=0就会发现, 这时候需要root权限才可以设置了, 这是因为如果设置高优先级的话, 就可能会抢占其他进程的资源, 这一般是内核不愿意看到的, 所以会需要更高的权限.

## 信号处理
和信号处理相关的部分成员如下:
```C
/* Signal handlers: */
struct signal_struct		*signal;
struct sighand_struct		*sighand;
sigset_t					blocked;
sigset_t					real_blocked;
/* Restored if set_restore_sigmask() was used: */
sigset_t					saved_sigmask;
struct sigpending			pending;
unsigned long				sas_ss_sp;
size_t						sas_ss_size;
unsigned int				sas_ss_flags;
```

```pending```用于缓存当前task收到的信号, 这些信号还未被处理, 只有在task从内核态跳到用户态的过程中, 才会检查```pending```中的信号. 而内核进程一般都在内核态运行, 所以无法通过这种方法相应信号, 因此对内核进程我们一般无法使用kill等指令杀死. 对处于```TASK_INTERRUPTIBLE```状态的进程, 信号发送函数会直接唤醒当前task, 让当前task有机会从内核态转换到用户态, 从而响应信号处理函数. 对处于```TASK_UNINTERRUPTIBLE```状态的进程, 信号就只被添加进```pending```队列, 无法响应对应的信号.

```sighand```用来指向信号处理函数. 信号处理时机可以参考下图:

!["信号处理时机"](https://bu.dusays.com/2022/06/26/62b87a97ae35b.png "信号处理时机")

```get_signal```函数中会获取当前task的```sighand```. ```saved_sigmask```也是在这个时间段会被用到. 如下在[kernel/signal.c](https://code.woboq.org/linux/linux/arch/x86/kernel/signal.c.html)中可以找到:
```C
// bool get_signal(struct ksignal *ksig)
struct sighand_struct *sighand = current->sighand;
struct signal_struct *signal = current->signal;
```

关于进程信号的使用, 可以参考[进程控制和进程通信三](/202105/process-ctracon3). 查看当前系统支持64种不同的信号, 如下:
```
$ kill -l
 1) SIGHUP	 	 2) SIGINT		 3) SIGQUIT		 4) SIGILL	 	5) SIGTRAP
 2) SIGABRT	 	 7) SIGBUS		 8) SIGFPE		 9) SIGKILL		10) SIGUSR1
1)  SIGSEGV		12) SIGUSR2		13) SIGPIPE		14) SIGALRM		15) SIGTERM
2)  SIGSTKFLT	17) SIGCHLD		18) SIGCONT		19) SIGSTOP		20) SIGTSTP
3)  SIGTTIN		22) SIGTTOU		23) SIGURG		24) SIGXCPU		25) SIGXFSZ
4)  SIGVTALRM	27) SIGPROF		28) SIGWINCH	29) SIGIO		30) SIGPWR
5)  SIGSYS		34) SIGRTMIN	35) SIGRTMIN+1	36) SIGRTMIN+2	37) SIGRTMIN+3
6)  SIGRTMIN+4	39) SIGRTMIN+5	40) SIGRTMIN+6	41) SIGRTMIN+7	42) SIGRTMIN+8
7)  SIGRTMIN+9	44) SIGRTMIN+10	45) SIGRTMIN+11	46) SIGRTMIN+12	47) SIGRTMIN+13
8)  SIGRTMIN+14	49) SIGRTMIN+15	50) SIGRTMAX-14	51) SIGRTMAX-13	52) SIGRTMAX-12
9)  SIGRTMAX-11	54) SIGRTMAX-10	55) SIGRTMAX-9	56) SIGRTMAX-8	57) SIGRTMAX-7
10) SIGRTMAX-6	59) SIGRTMAX-5	60) SIGRTMAX-4	61) SIGRTMAX-3	62) SIGRTMAX-2
11) SIGRTMAX-1	64) SIGRTMAX
```

## 内存管理
与内存管理相关的部分成员如下:
```C
struct mm_struct		*mm;
struct mm_struct		*active_mm;
```

主要关注```mm_struct```结构体, 其中会包含一些segment的分段信息:
```C
unsigned long start_code, end_code, start_data, end_data;
unsigned long start_brk, brk, start_stack;
unsigned long arg_start, arg_end, env_start, env_end;
```

!["Segment指向"](https://img.jbzj.com/file_images/article/201709/2017090617062846.png "Segment指向")

进程从task_struct如何映射到物理内存的, 大概可以知道是以下流程了:
!["进程到物理内存"](https://bu.dusays.com/2022/06/26/62b88006a6907.png "进程到物理内存")

当然, 现在依然存在一些盲区, ```mm_struct```怎么指向页表的? 页表在哪里? 页表的工作流程是怎样的?

```mm```和```active_mm```有什么区别呢? 这封[1999-07-30的邮件](https://www.kernel.org/doc/html/latest/vm/active_mm.html)(和现在的一些表述可能有点区别)中有详细的说明:

邮件中描述, 内存空间有"real address spaces"和"anonymous address spaces", 这里可以理解为"real address spaces"是指用户空间, "anonymous address spaces"指内核空间(The obvious use for a "anonymous address space" is any thread that doesn't need any user mappings), 因为内核空间是不需要映射关系就可以找到的. ```mm```用来指向"real address spaces", ```active_mm```用来指向"real address spaces". 那么linux内核设计了以下规则: 如果当前进程(一般是内核进程)空间指向"anonymous address spaces", 则```mm```的值为```NULL```, ```active_mm```指向当前空间; 如果当前进程空间指向"real address spaces", 则```active_mm```的值和```mm```的值保持一致. 所以, 现在一般也可以通过```mm```的值判断当前是内核进程还是用户进程.

## 文件与文件系统
与文件与文件系统相关的成员如下:
```C
/* Filesystem information: */
struct fs_struct		*fs;
/* Open file information: */
struct files_struct		*files;
```

通过```fs_struct```, 可以拿到文件系统的root路径, 和当前进程的工作路径pwd.
```C
struct fs_struct {
	int users;
	spinlock_t lock;
	seqcount_t seq;
	int umask;
	int in_exec;
	struct path root, pwd;
} __randomize_layout;
```

```files_struct```表示当前进程打开的文件.
```C
/*
 * Open file table structure
 */
struct files_struct {
/* read mostly part */
	atomic_t count;
	bool resize_in_progress;
	wait_queue_head_t resize_wait;
	struct fdtable __rcu *fdt;
	struct fdtable fdtab;
/* written part on a separate cache line in SMP */
	spinlock_t file_lock ____cacheline_aligned_in_smp;
	unsigned int next_fd;
	unsigned long close_on_exec_init[1];
	unsigned long open_fds_init[1];
	unsigned long full_fds_bits_init[1];
	struct file __rcu * fd_array[NR_OPEN_DEFAULT];
};
```
首先可以关注```fd_array```这个成员, ```NR_OPEN_DEFAULT```默认值是操作系统的位数, 比如是32或者64, 这表示这个进程可以打开32/64个文件, 如果超过了这个值, 则系统会继续增大这个数组, 但是file数组的大小是有限制的:
```C
#define INR_OPEN_MAX 4096	/* Hard limit for nfile rlimits */
```
比如说操作系统限制一个进程最多可以大概4096个文件, 通过root权限可以更改这个最大值.

再关注```fdtable```所指的两个成员, 可以先看看```files_struct```的结构:
```
struct fdtable {
	unsigned int max_fds;
	struct file __rcu **fd;      /* current fd array */
	unsigned long *close_on_exec;
	unsigned long *open_fds;
	unsigned long *full_fds_bits;
	struct rcu_head rcu;
};
```

```fdtable```和```files_struct```看起来会有冲突的地方, 比如都可以表示打开文件的组数. 对应关系如下:
!["fdtable和files_struct"](https://bu.dusays.com/2022/06/26/62b87a8cc55ce.png "fdtable和files_struct")

实际上```fdtable```在打开文件数量扩充中是有用的, 初始化```files_struct```最多可以打开```NR_OPEN_DEFAULT```个文件, 如果超过了则会申请一个新的```fdtable```内存, 由```*fdt```指向这块新的内存, 并且不再和```fd_array```关联(相当于有两块内存存储文件列表), 这时候就可以继续扩充打开文件的数量而不受```NR_OPEN_DEFAULT```大小限制了.

!["fdtable扩充"](https://bu.dusays.com/2022/06/26/62b8800bd62a6.png "fdtable扩充")

文件系统的内容还需要进一步学习.

## 内核栈

```C
struct thread_info		thread_info;		// 必须是task_struct的第一个成员
void					*stack;				// 内核栈
```

stack是指内核栈, 因为如果是用户态的进程, 某些情况(系统调用/异常触发等)会陷入内核态, 这时候在内核态执行指令同样需要栈空间, 如果使用用户态的栈可能会导致内核不安全, 这时候就需要给内核额外的分配栈, 就是这里的内核栈. 所以在用户进程切换到内核态的时候, 栈也会从用户栈切换到内核栈.

为什么```thread_info```必须是第一个成员? 可以看下面的函数:
```C
#define current_thread_info() ((struct thread_info *)current)
```
```current_thread_info```可以把```current```(上文讲过, 这就是当前的```task_struct```)转换为```thread_info```, 所以```thread_info```需要是第一个成员保证转换正确.

```thread_info```是干什么用的? 首先```task_struct```是一种通用的task描述, 和平台架构无关, 但是linux是支持不同平台架构的, 怎么区分这些平台架构, 这时候就是通过```thread_info```来体现这些差异了.

也可以通过以下的方式拿到```thread_info```:
```C
#ifdef CONFIG_THREAD_INFO_IN_TASK
static inline struct thread_info *task_thread_info(struct task_struct *task)
{
	return &task->thread_info;
}
#elif !defined(__HAVE_THREAD_FUNCTIONS)
# define task_thread_info(task)	((struct thread_info *)(task)->stack)
#endif
```
注意到```task_thread_info```宏, 可以通过task的```stack```拿到```thread_info```, 这也说明```stack```和```thread_info```是在同一块内存的. 通过```thread_union```可以得到```stack```的大小是4Pages Size(16KB, 不同架构上可能不一样).

以下是```thread_union```的定义:
```C
#ifdef CONFIG_KASAN
#define KASAN_STACK_ORDER 1
#else
#define KASAN_STACK_ORDER 0
#endif
#define THREAD_SIZE_ORDER	(2 + KASAN_STACK_ORDER)
#define THREAD_SIZE  (PAGE_SIZE << THREAD_SIZE_ORDER)

union thread_union {
#ifndef CONFIG_ARCH_TASK_STRUCT_ON_STACK
	struct task_struct task;
#endif
#ifndef CONFIG_THREAD_INFO_IN_TASK
	struct thread_info thread_info;
#endif
	unsigned long stack[THREAD_SIZE/sizeof(long)];
};
```

在`thread_info`结构体中, ```task_struct/thread_info/stack```之间的关系如下图:
!["thread_info和stack"](https://bu.dusays.com/2022/06/26/62b8800ee9be4.png "thread_info和stack")

为什么将进程内核栈和`task_struct`放一起? 一个解释是, 为了方便内核快速的获取当前进程的描述符. 如此, 可以通过进程内核栈的栈顶指针esp快速计算得到`task_struct`的地址.

如果内核栈增长过多, 就可能踩踏```thread_info```, 导致task崩溃. 实际上内核提供了一些接口用于查询是否踩踏以保证task的安全.
