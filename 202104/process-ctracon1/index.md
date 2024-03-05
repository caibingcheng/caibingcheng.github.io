# 进程控制和通信(一)


Linux系统的进程由PCB(Process Control Block)管理.

## PCB
推荐[https://code.woboq.org/](https://code.woboq.org/)阅读linux源码.

<!--more-->

Linux PCB 可以在[https://code.woboq.org/linux/linux/include/linux/sched.h.html#task_struct](https://code.woboq.org/linux/linux/include/linux/sched.h.html#task_struct)找到, 对应```task_struct```结构体.


```C
struct task_struct {
#ifdef CONFIG_THREAD_INFO_IN_TASK
	/*
	 * For reasons of header soup (see current_thread_info()), this
	 * must be the first element of task_struct.
	 */
	struct thread_info		thread_info;
#endif
	/* -1 unrunnable, 0 runnable, >0 stopped: */
	volatile long			state;
	/*
	 * This begins the randomizable portion of task_struct. Only
	 * scheduling-critical items should be added above here.
	 */
	randomized_struct_fields_start
	void				*stack;
	refcount_t			usage;
	/* Per task flags (PF_*), defined further below: */
	unsigned int			flags;
	unsigned int			ptrace;
#ifdef CONFIG_SMP
	struct llist_node		wake_entry;
	int				on_cpu;
#ifdef CONFIG_THREAD_INFO_IN_TASK
	/* Current CPU: */
	unsigned int			cpu;
#endif
	unsigned int			wakee_flips;
	unsigned long			wakee_flip_decay_ts;
	struct task_struct		*last_wakee;
	/*
	 * recent_used_cpu is initially set as the last CPU used by a task
	 * that wakes affine another task. Waker/wakee relationships can
	 * push tasks around a CPU where each wakeup moves to the next one.
	 * Tracking a recently used CPU allows a quick search for a recently
	 * used CPU that may be idle.
	 */
	int				recent_used_cpu;
	int				wake_cpu;
#endif
	int				on_rq;
	int				prio;
	int				static_prio;
	int				normal_prio;
	unsigned int			rt_priority;
	const struct sched_class	*sched_class;
	struct sched_entity		se;
	struct sched_rt_entity		rt;
#ifdef CONFIG_CGROUP_SCHED
	struct task_group		*sched_task_group;
#endif
	struct sched_dl_entity		dl;
#ifdef CONFIG_PREEMPT_NOTIFIERS
	/* List of struct preempt_notifier: */
	struct hlist_head		preempt_notifiers;
#endif
#ifdef CONFIG_BLK_DEV_IO_TRACE
	unsigned int			btrace_seq;
#endif
	unsigned int			policy;
	int				nr_cpus_allowed;
	cpumask_t			cpus_allowed;
#ifdef CONFIG_PREEMPT_RCU
	int				rcu_read_lock_nesting;
	union rcu_special		rcu_read_unlock_special;
	struct list_head		rcu_node_entry;
	struct rcu_node			*rcu_blocked_node;
#endif /* #ifdef CONFIG_PREEMPT_RCU */
#ifdef CONFIG_TASKS_RCU
	unsigned long			rcu_tasks_nvcsw;
	u8				rcu_tasks_holdout;
	u8				rcu_tasks_idx;
	int				rcu_tasks_idle_cpu;
	struct list_head		rcu_tasks_holdout_list;
#endif /* #ifdef CONFIG_TASKS_RCU */
	struct sched_info		sched_info;
	struct list_head		tasks;
#ifdef CONFIG_SMP
	struct plist_node		pushable_tasks;
	struct rb_node			pushable_dl_tasks;
#endif
	struct mm_struct		*mm;
	struct mm_struct		*active_mm;
	/* Per-thread vma caching: */
	struct vmacache			vmacache;
#ifdef SPLIT_RSS_COUNTING
	struct task_rss_stat		rss_stat;
#endif
	int				exit_state;
	int				exit_code;
	int				exit_signal;
	/* The signal sent when the parent dies: */
	int				pdeath_signal;
	/* JOBCTL_*, siglock protected: */
	unsigned long			jobctl;
	/* Used for emulating ABI behavior of previous Linux versions: */
	unsigned int			personality;
	/* Scheduler bits, serialized by scheduler locks: */
	unsigned			sched_reset_on_fork:1;
	unsigned			sched_contributes_to_load:1;
	unsigned			sched_migrated:1;
	unsigned			sched_remote_wakeup:1;
#ifdef CONFIG_PSI
	unsigned			sched_psi_wake_requeue:1;
#endif
	/* Force alignment to the next boundary: */
	unsigned			:0;
	/* Unserialized, strictly 'current' */
	/* Bit to tell LSMs we're in execve(): */
	unsigned			in_execve:1;
	unsigned			in_iowait:1;
#ifndef TIF_RESTORE_SIGMASK
	unsigned			restore_sigmask:1;
#endif
#ifdef CONFIG_MEMCG
	unsigned			in_user_fault:1;
#endif
#ifdef CONFIG_COMPAT_BRK
	unsigned			brk_randomized:1;
#endif
#ifdef CONFIG_CGROUPS
	/* disallow userland-initiated cgroup migration */
	unsigned			no_cgroup_migration:1;
#endif
#ifdef CONFIG_BLK_CGROUP
	/* to be used once the psi infrastructure lands upstream. */
	unsigned			use_memdelay:1;
#endif
	unsigned long			atomic_flags; /* Flags requiring atomic access. */
	struct restart_block		restart_block;
	pid_t				pid;
	pid_t				tgid;
#ifdef CONFIG_STACKPROTECTOR
	/* Canary value for the -fstack-protector GCC feature: */
	unsigned long			stack_canary;
#endif
	/*
	 * Pointers to the (original) parent process, youngest child, younger sibling,
	 * older sibling, respectively.  (p->father can be replaced with
	 * p->real_parent->pid)
	 */
	/* Real parent process: */
	struct task_struct __rcu	*real_parent;
	/* Recipient of SIGCHLD, wait4() reports: */
	struct task_struct __rcu	*parent;
	/*
	 * Children/sibling form the list of natural children:
	 */
	struct list_head		children;
	struct list_head		sibling;
	struct task_struct		*group_leader;
	/*
	 * 'ptraced' is the list of tasks this task is using ptrace() on.
	 *
	 * This includes both natural children and PTRACE_ATTACH targets.
	 * 'ptrace_entry' is this task's link on the p->parent->ptraced list.
	 */
	struct list_head		ptraced;
	struct list_head		ptrace_entry;
	/* PID/PID hash table linkage. */
	struct pid			*thread_pid;
	struct hlist_node		pid_links[PIDTYPE_MAX];
	struct list_head		thread_group;
	struct list_head		thread_node;
	struct completion		*vfork_done;
	/* CLONE_CHILD_SETTID: */
	int __user			*set_child_tid;
	/* CLONE_CHILD_CLEARTID: */
	int __user			*clear_child_tid;
	u64				utime;
	u64				stime;
#ifdef CONFIG_ARCH_HAS_SCALED_CPUTIME
	u64				utimescaled;
	u64				stimescaled;
#endif
	u64				gtime;
	struct prev_cputime		prev_cputime;
#ifdef CONFIG_VIRT_CPU_ACCOUNTING_GEN
	struct vtime			vtime;
#endif
#ifdef CONFIG_NO_HZ_FULL
	atomic_t			tick_dep_mask;
#endif
	/* Context switch counts: */
	unsigned long			nvcsw;
	unsigned long			nivcsw;
	/* Monotonic time in nsecs: */
	u64				start_time;
	/* Boot based time in nsecs: */
	u64				real_start_time;
	/* MM fault and swap info: this can arguably be seen as either mm-specific or thread-specific: */
	unsigned long			min_flt;
	unsigned long			maj_flt;
#ifdef CONFIG_POSIX_TIMERS
	struct task_cputime		cputime_expires;
	struct list_head		cpu_timers[3];
#endif
	/* Process credentials: */
	/* Tracer's credentials at attach: */
	const struct cred __rcu		*ptracer_cred;
	/* Objective and real subjective task credentials (COW): */
	const struct cred __rcu		*real_cred;
	/* Effective (overridable) subjective task credentials (COW): */
	const struct cred __rcu		*cred;
	/*
	 * executable name, excluding path.
	 *
	 * - normally initialized setup_new_exec()
	 * - access it with [gs]et_task_comm()
	 * - lock it with task_lock()
	 */
	char				comm[TASK_COMM_LEN];
	struct nameidata		*nameidata;
#ifdef CONFIG_SYSVIPC
	struct sysv_sem			sysvsem;
	struct sysv_shm			sysvshm;
#endif
#ifdef CONFIG_DETECT_HUNG_TASK
	unsigned long			last_switch_count;
	unsigned long			last_switch_time;
#endif
	/* Filesystem information: */
	struct fs_struct		*fs;
	/* Open file information: */
	struct files_struct		*files;
	/* Namespaces: */
	struct nsproxy			*nsproxy;
	/* Signal handlers: */
	struct signal_struct		*signal;
	struct sighand_struct		*sighand;
	sigset_t			blocked;
	sigset_t			real_blocked;
	/* Restored if set_restore_sigmask() was used: */
	sigset_t			saved_sigmask;
	struct sigpending		pending;
	unsigned long			sas_ss_sp;
	size_t				sas_ss_size;
	unsigned int			sas_ss_flags;
	struct callback_head		*task_works;
#ifdef CONFIG_AUDIT
#ifdef CONFIG_AUDITSYSCALL
	struct audit_context		*audit_context;
#endif
	kuid_t				loginuid;
	unsigned int			sessionid;
#endif
	struct seccomp			seccomp;
	/* Thread group tracking: */
	u32				parent_exec_id;
	u32				self_exec_id;
	/* Protection against (de-)allocation: mm, files, fs, tty, keyrings, mems_allowed, mempolicy: */
	spinlock_t			alloc_lock;
	/* Protection of the PI data structures: */
	raw_spinlock_t			pi_lock;
	struct wake_q_node		wake_q;
#ifdef CONFIG_RT_MUTEXES
	/* PI waiters blocked on a rt_mutex held by this task: */
	struct rb_root_cached		pi_waiters;
	/* Updated under owner's pi_lock and rq lock */
	struct task_struct		*pi_top_task;
	/* Deadlock detection and priority inheritance handling: */
	struct rt_mutex_waiter		*pi_blocked_on;
#endif
#ifdef CONFIG_DEBUG_MUTEXES
	/* Mutex deadlock detection: */
	struct mutex_waiter		*blocked_on;
#endif
#ifdef CONFIG_TRACE_IRQFLAGS
	unsigned int			irq_events;
	unsigned long			hardirq_enable_ip;
	unsigned long			hardirq_disable_ip;
	unsigned int			hardirq_enable_event;
	unsigned int			hardirq_disable_event;
	int				hardirqs_enabled;
	int				hardirq_context;
	unsigned long			softirq_disable_ip;
	unsigned long			softirq_enable_ip;
	unsigned int			softirq_disable_event;
	unsigned int			softirq_enable_event;
	int				softirqs_enabled;
	int				softirq_context;
#endif
#ifdef CONFIG_LOCKDEP
# define MAX_LOCK_DEPTH			48UL
	u64				curr_chain_key;
	int				lockdep_depth;
	unsigned int			lockdep_recursion;
	struct held_lock		held_locks[MAX_LOCK_DEPTH];
#endif
#ifdef CONFIG_UBSAN
	unsigned int			in_ubsan;
#endif
	/* Journalling filesystem info: */
	void				*journal_info;
	/* Stacked block device info: */
	struct bio_list			*bio_list;
#ifdef CONFIG_BLOCK
	/* Stack plugging: */
	struct blk_plug			*plug;
#endif
	/* VM state: */
	struct reclaim_state		*reclaim_state;
	struct backing_dev_info		*backing_dev_info;
	struct io_context		*io_context;
#ifdef CONFIG_COMPACTION
	struct capture_control		*capture_control;
#endif
	/* Ptrace state: */
	unsigned long			ptrace_message;
	kernel_siginfo_t		*last_siginfo;
	struct task_io_accounting	ioac;
#ifdef CONFIG_PSI
	/* Pressure stall state */
	unsigned int			psi_flags;
#endif
#ifdef CONFIG_TASK_XACCT
	/* Accumulated RSS usage: */
	u64				acct_rss_mem1;
	/* Accumulated virtual memory usage: */
	u64				acct_vm_mem1;
	/* stime + utime since last update: */
	u64				acct_timexpd;
#endif
#ifdef CONFIG_CPUSETS
	/* Protected by ->alloc_lock: */
	nodemask_t			mems_allowed;
	/* Seqence number to catch updates: */
	seqcount_t			mems_allowed_seq;
	int				cpuset_mem_spread_rotor;
	int				cpuset_slab_spread_rotor;
#endif
#ifdef CONFIG_CGROUPS
	/* Control Group info protected by css_set_lock: */
	struct css_set __rcu		*cgroups;
	/* cg_list protected by css_set_lock and tsk->alloc_lock: */
	struct list_head		cg_list;
#endif
#ifdef CONFIG_X86_CPU_RESCTRL
	u32				closid;
	u32				rmid;
#endif
#ifdef CONFIG_FUTEX
	struct robust_list_head __user	*robust_list;
#ifdef CONFIG_COMPAT
	struct compat_robust_list_head __user *compat_robust_list;
#endif
	struct list_head		pi_state_list;
	struct futex_pi_state		*pi_state_cache;
#endif
#ifdef CONFIG_PERF_EVENTS
	struct perf_event_context	*perf_event_ctxp[perf_nr_task_contexts];
	struct mutex			perf_event_mutex;
	struct list_head		perf_event_list;
#endif
#ifdef CONFIG_DEBUG_PREEMPT
	unsigned long			preempt_disable_ip;
#endif
#ifdef CONFIG_NUMA
	/* Protected by alloc_lock: */
	struct mempolicy		*mempolicy;
	short				il_prev;
	short				pref_node_fork;
#endif
#ifdef CONFIG_NUMA_BALANCING
	int				numa_scan_seq;
	unsigned int			numa_scan_period;
	unsigned int			numa_scan_period_max;
	int				numa_preferred_nid;
	unsigned long			numa_migrate_retry;
	/* Migration stamp: */
	u64				node_stamp;
	u64				last_task_numa_placement;
	u64				last_sum_exec_runtime;
	struct callback_head		numa_work;
	struct numa_group		*numa_group;
	/*
	 * numa_faults is an array split into four regions:
	 * faults_memory, faults_cpu, faults_memory_buffer, faults_cpu_buffer
	 * in this precise order.
	 *
	 * faults_memory: Exponential decaying average of faults on a per-node
	 * basis. Scheduling placement decisions are made based on these
	 * counts. The values remain static for the duration of a PTE scan.
	 * faults_cpu: Track the nodes the process was running on when a NUMA
	 * hinting fault was incurred.
	 * faults_memory_buffer and faults_cpu_buffer: Record faults per node
	 * during the current scan window. When the scan completes, the counts
	 * in faults_memory and faults_cpu decay and these values are copied.
	 */
	unsigned long			*numa_faults;
	unsigned long			total_numa_faults;
	/*
	 * numa_faults_locality tracks if faults recorded during the last
	 * scan window were remote/local or failed to migrate. The task scan
	 * period is adapted based on the locality of the faults with different
	 * weights depending on whether they were shared or private faults
	 */
	unsigned long			numa_faults_locality[3];
	unsigned long			numa_pages_migrated;
#endif /* CONFIG_NUMA_BALANCING */
#ifdef CONFIG_RSEQ
	struct rseq __user *rseq;
	u32 rseq_len;
	u32 rseq_sig;
	/*
	 * RmW on rseq_event_mask must be performed atomically
	 * with respect to preemption.
	 */
	unsigned long rseq_event_mask;
#endif
	struct tlbflush_unmap_batch	tlb_ubc;
	struct rcu_head			rcu;
	/* Cache last used pipe for splice(): */
	struct pipe_inode_info		*splice_pipe;
	struct page_frag		task_frag;
#ifdef CONFIG_TASK_DELAY_ACCT
	struct task_delay_info		*delays;
#endif
#ifdef CONFIG_FAULT_INJECTION
	int				make_it_fail;
	unsigned int			fail_nth;
#endif
	/*
	 * When (nr_dirtied >= nr_dirtied_pause), it's time to call
	 * balance_dirty_pages() for a dirty throttling pause:
	 */
	int				nr_dirtied;
	int				nr_dirtied_pause;
	/* Start of a write-and-pause period: */
	unsigned long			dirty_paused_when;
#ifdef CONFIG_LATENCYTOP
	int				latency_record_count;
	struct latency_record		latency_record[LT_SAVECOUNT];
#endif
	/*
	 * Time slack values; these are used to round up poll() and
	 * select() etc timeout values. These are in nanoseconds.
	 */
	u64				timer_slack_ns;
	u64				default_timer_slack_ns;
#ifdef CONFIG_KASAN
	unsigned int			kasan_depth;
#endif
#ifdef CONFIG_FUNCTION_GRAPH_TRACER
	/* Index of current stored address in ret_stack: */
	int				curr_ret_stack;
	int				curr_ret_depth;
	/* Stack of return addresses for return function tracing: */
	struct ftrace_ret_stack		*ret_stack;
	/* Timestamp for last schedule: */
	unsigned long long		ftrace_timestamp;
	/*
	 * Number of functions that haven't been traced
	 * because of depth overrun:
	 */
	atomic_t			trace_overrun;
	/* Pause tracing: */
	atomic_t			tracing_graph_pause;
#endif
#ifdef CONFIG_TRACING
	/* State flags for use by tracers: */
	unsigned long			trace;
	/* Bitmask and counter of trace recursion: */
	unsigned long			trace_recursion;
#endif /* CONFIG_TRACING */
#ifdef CONFIG_KCOV
	/* Coverage collection mode enabled for this task (0 if disabled): */
	unsigned int			kcov_mode;
	/* Size of the kcov_area: */
	unsigned int			kcov_size;
	/* Buffer for coverage collection: */
	void				*kcov_area;
	/* KCOV descriptor wired with this task or NULL: */
	struct kcov			*kcov;
#endif
#ifdef CONFIG_MEMCG
	struct mem_cgroup		*memcg_in_oom;
	gfp_t				memcg_oom_gfp_mask;
	int				memcg_oom_order;
	/* Number of pages to reclaim on returning to userland: */
	unsigned int			memcg_nr_pages_over_high;
	/* Used by memcontrol for targeted memcg charge: */
	struct mem_cgroup		*active_memcg;
#endif
#ifdef CONFIG_BLK_CGROUP
	struct request_queue		*throttle_queue;
#endif
#ifdef CONFIG_UPROBES
	struct uprobe_task		*utask;
#endif
#if defined(CONFIG_BCACHE) || defined(CONFIG_BCACHE_MODULE)
	unsigned int			sequential_io;
	unsigned int			sequential_io_avg;
#endif
#ifdef CONFIG_DEBUG_ATOMIC_SLEEP
	unsigned long			task_state_change;
#endif
	int				pagefault_disabled;
#ifdef CONFIG_MMU
	struct task_struct		*oom_reaper_list;
#endif
#ifdef CONFIG_VMAP_STACK
	struct vm_struct		*stack_vm_area;
#endif
#ifdef CONFIG_THREAD_INFO_IN_TASK
	/* A live task holds one reference: */
	refcount_t			stack_refcount;
#endif
#ifdef CONFIG_LIVEPATCH
	int patch_state;
#endif
#ifdef CONFIG_SECURITY
	/* Used by LSM modules for access restriction: */
	void				*security;
#endif
#ifdef CONFIG_GCC_PLUGIN_STACKLEAK
	unsigned long			lowest_stack;
	unsigned long			prev_lowest_stack;
#endif
	/*
	 * New fields for task_struct should be added above here, so that
	 * they are included in the randomized portion of task_struct.
	 */
	randomized_struct_fields_end
	/* CPU-specific state of this task: */
	struct thread_struct		thread;
	/*
	 * WARNING: on x86, 'thread_struct' contains a variable-sized
	 * structure.  It *MUST* be at the end of 'task_struct'.
	 *
	 * Do not put anything below here!
	 */
};
```

对```task_struct```, 这里有比较好的分类和总结(不太全):
!["task_struct"](https://img-blog.csdnimg.cn/20200520105420402.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3dlaXhpbl80MDk5NDU1Mg==,size_16,color_FFFFFF,t_70 "task_struct")

一个PCB会包含以下信息:
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

## fork

C语言中的fork用于创建进程. 如上一篇我们讲的进程是系统进行资源分配的最小单元, 所以在创建进程的时候, 自然而然主要是考虑进程的资源如何创建.

C语言中的fork类似于github中的fork, 会把资源"完全"复制一份. 类比github, fork一个仓库, 在fork的时候, 原始仓库和fork之后的仓库内容完全一样, 并且在新仓库会有指针(链接)指向原始仓库, fork之后两个仓库的修改完全无关, 仓库内容开始分叉.

调用C语言的fork, 先是会复制调用进程的上下文, 包括虚拟空间, 映射关系, 调用栈等等, 然后会激活一个新的进程, 这个新的进程是调用进程的子进程, 调用进程是新进程的父进程. 如上述, 子进程会复制父进程的资源, 所以子进程也会有和父进程相同的PC指针, 在fork调用返回后, 父进程和子进程都会从程序的同一地址开始运行(即fork函数之后), 但是父子进程开始走向分化, 互不相关.

如下图, fork之后子进程会复制父进程的资源, PC指针指向相同的虚拟地址, 所以子进程从fork的位置开始运行.

!["fork复制进程"](https://bu.dusays.com/2022/06/26/62b87fe46f20b.png "fork复制进程")

以上, 调用```fork```即会生成一个新的进程, 通过fork的返回值pid可以判断当前进程是父进程还是子进程.

```C
int pid = fork();
if (pid < 0)
{
    // fork error
}
else if (pid == 0)
{
    // children processor
}
else
{
    // parrent processor
}
```

我们可以验证一下fork父子进程互不干扰的结论:
```C
void inc(const char* s, int pid, int i)
{
    printf("%s processor [%d %d] %d\n", s, getppid(), getpid(), i);
}

int main()
{
    volatile int i = 0;
    int pid = fork();
    i = 100;
    if (pid < 0)
    {
        printf("fork error");
        return -1;
    }
    else if (pid == 0)
    {
        for (int j = 0; j < 100; j++)
        {
            inc("child", pid, i++);
        }
    }
    else
    {
        for (int j = 0; j < 20; j++)
        {
            inc("parent", pid, i++);
        }
    }

    i = 0;
    return 0;
}
```
使用```volatile```保证变量```i```保存在内存而不是寄存器. ```fork```会创建子进程循环100次输出, 父进程循化20次输出. 编译执行我们可以看到子进程从100-199输出, 父进程从100-119输出, 互不干扰.

同时我们```printf```了父进程ID和当前进程ID, 可以看到:
```
parent processor [29629 20195] 100
parent processor [29629 20195] 101
parent processor [29629 20195] 102
```
29629是父进程ID, 20195是当前进程ID, 当前进程就是我们执行的程序, 所以这里的父进程就是执行程序的终端的进程.

子进程被唤醒执行后, 有如下输出:
```
child processor [20195 20196] 100
parent processor [29629 20195] 110
child processor [20195 20196] 101
parent processor [29629 20195] 111
```
20195就是当前程序进程ID, 20196是```fork```之后的子进程ID.

最后也会有一些"不符合预期"的输出:
```
child processor [1 20196] 138
child processor [1 20196] 139
child processor [1 20196] 140
```
子进程的父进程ID变成了1? 因为这时候原来执行程序的进程(20195)已经退出了, Linux一般不允许进程没有父进程, 所以得为还在执行的子进程找到一个父进程, 这就是1号进程.

Linux中0号进程是内核启动进程, 也就是系统第一个启动的进程. 0号进程会创建一个新的进程, 即1号进程, 1号进程负责启动init程序并监视其他进程.

### 写时复制

我们可以想到一个问题, 如果```fork```完全复制进程的上下文, 势必会造成资源浪费.

比如一个进程快要执行完了, 这时候通过**缺页中断**这个进程在物理内存中已经占据了不少的空间, 如果```fork```完全复制则子进程也需要复制父进程的物理内存. 可以想象, 在```fork```之前, 可以认为这有两个完全一样的进程, 所有内容共享, ```fork```之后两进程开始分叉. 如果是完全复制, 则```fork```之前共享的内容也需要全部复制, 但是新进程不一定还需要使用之前的内容了, 这时候就会造成资源的浪费.

上述例子比较片面, 需要表达意思就是```fork```不需要完全复制物理内存, 因为可能有些是不需要再访问的.

Linux帧对这种潜在的资源浪费提出的解法就是写时复制.

在```fork```的时候完全不复制物理内存, 仅复制虚拟内存和映射表. 所以在```fork```返回之后, 父子进程是共享的物理内存. 只有在有写操作时, 才会触发中断, 重新在物理内存中申请内存空间, 以区分父子进程的资源.

如下图, 是```fork```执行之后的某个时刻, 父子进程的PC指向将会分化, 指向不同的虚拟地址, 映射表的映射关系也会出现分化, 指向不同的物理内存或者不同的磁盘地址, 两者互不干扰. 需要注意的是, 图中标注的```fork```之前的地址映射关系相同, 并不是说```fork```所在地址之前的映射关系就一定会相同, 实际上也可能不同, 因为```fork```之后父子进程的某些操作也可能影响之前的值.

!["写时复制"](https://bu.dusays.com/2022/06/26/62b87fe8c9a73.png "写时复制")

写时复制的好处就是可以减少资源浪费, 能共享的就共享, 不能共享的就重新创建. 但是我认为写时复制也有一些性能问题, 比如需要在进程运行时不断触发中断, 如果包含频繁写操作的程序运行, 使用写时复制可能会比完全复制的时间复杂度更高.

### 一秒死机程序

在学习```fork```之前, 如果写一些让电脑死机的恶作剧程序可能只会想到开大量线程, 然后线程不停申请内存空间, 使内存占满.

学习```fork```之后, 我们就可以用```fork```来干活了. 进程作为系统资源分配的最小单元, 相比于线程会消耗系统更多的资源(线程一般也就共享一个进程的资源), 所以我们可以写一个程序, 不停的创建进程, 这样系统中就会充斥大量的无用进程, 无用进程多到一定数量的时候, 系统命中有用进程的概率就会降低. 并且, 一般系统都会有最大进程数, 一般是65535, 如果无用进程把所有有效pid用完了, 则正常进程将无pid可分配, 也就可能造成正常无法启动.

流程如下图, 父进程不停创建子进程, 子进程死循环, 不停```malloc```和```memset```. 如上一篇所说, ```malloc```只分配了虚拟内存, 当我们访问的时候会触发缺页中断, 才会真正分配物理内存, 所以```malloc```之后```memset```一下.
!["死机fork流程"](https://bu.dusays.com/2022/06/26/62b87fec7506f.png "死机fork流程")

下面来干活, 代码很少:
```C
#include <stdlib.h>
#include <unistd.h>

int main()
{
    while(1) {
        int pid = fork();
        if (pid < 0) {return 1;}
        else if (pid == 0) { break; }
        else { continue; }
    }

    int i = 0;
    while(1) {
        long long s = sizeof(int) * 1024 * 1024;
        int *p = malloc(s);
        memset(p, i++, s);
    }

    return 1;
}
```

保存代码为```onesecond.c```, 记得先**保存重要文件**, 编译并执行:
```Shell
gcc -o onesecond ./onesecond.c && ./onesecond
```

也可以下载编译好的程序, [点击下载](./onesecond).

好了, 不出意外, 数秒内你的电脑就死机了.



### 再探fork
再来深入了解一下```fork```.

搜索```fork```, 可以找到```_do_fork```函数
```C
/*
 *  Ok, this is the main fork-routine.
 *
 * It copies the process, and if successful kick-starts
 * it and waits for it to finish using the VM if required.
 */
long _do_fork(unsigned long clone_flags,
	      unsigned long stack_start,
	      unsigned long stack_size,
	      int __user *parent_tidptr,
	      int __user *child_tidptr,
	      unsigned long tls)
{
	struct completion vfork;
	struct pid *pid;
	struct task_struct *p;
	int trace = 0;
	long nr;

    // 根据clone_flags判断clone分支
	/*
	 * Determine whether and which event to report to ptracer.  When
	 * called from kernel_thread or CLONE_UNTRACED is explicitly
	 * requested, no event is reported; otherwise, report if the event
	 * for the type of forking is enabled.
	 */
	if (!(clone_flags & CLONE_UNTRACED)) {
		if (clone_flags & CLONE_VFORK)
			trace = PTRACE_EVENT_VFORK;
		else if ((clone_flags & CSIGNAL) != SIGCHLD)
			trace = PTRACE_EVENT_CLONE;
		else
			trace = PTRACE_EVENT_FORK;
		if (likely(!ptrace_event_enabled(current, trace)))
			trace = 0;
	}

    //根据clone_flags copy_process
	p = copy_process(clone_flags, stack_start, stack_size,
			 child_tidptr, NULL, trace, tls, NUMA_NO_NODE);
	add_latent_entropy();
	if (IS_ERR(p))
		return PTR_ERR(p);
	/*
	 * Do this prior waking up the new thread - the thread pointer
	 * might get invalid after that point, if the thread exits quickly.
	 */
	trace_sched_process_fork(current, p);
	pid = get_task_pid(p, PIDTYPE_PID);
	nr = pid_vnr(pid);
	if (clone_flags & CLONE_PARENT_SETTID)
		put_user(nr, parent_tidptr);
	if (clone_flags & CLONE_VFORK) {
		p->vfork_done = &vfork;
		init_completion(&vfork);
		get_task_struct(p);
	}

    //唤醒子进程
	wake_up_new_task(p);
	/* forking complete and child started to run, tell ptracer */
	if (unlikely(trace))
		ptrace_event_pid(trace, pid);
	if (clone_flags & CLONE_VFORK) {
		if (!wait_for_vfork_done(p, &vfork))
			ptrace_event_pid(PTRACE_EVENT_VFORK_DONE, pid);
	}
	put_pid(pid);
	return nr;
}
```

大概分为三段:
1. 根据```clone_flags```选择需要clone的内容;
2. 唤醒子进程
3. 获取并返回子进程pid

```clone_flags```可选项.
{{< admonition >}}
```clone_flags```的被宏```__USE_GNU```保护了, 所以在使用的时候要记得```#define __USE_GNU```.
{{< /admonition >}}
```C
#ifdef __USE_GNU
/* Cloning flags.  */
# define CSIGNAL       0x000000ff /* Signal mask to be sent at exit.  */
# define CLONE_VM      0x00000100 /* Set if VM shared between processes.  */
# define CLONE_FS      0x00000200 /* Set if fs info shared between processes.  */
# define CLONE_FILES   0x00000400 /* Set if open files shared between processes.  */
# define CLONE_SIGHAND 0x00000800 /* Set if signal handlers shared.  */
# define CLONE_PTRACE  0x00002000 /* Set if tracing continues on the child.  */
# define CLONE_VFORK   0x00004000 /* Set if the parent wants the child to
                                     wake it up on mm_release.  */
# define CLONE_PARENT  0x00008000 /* Set if we want to have the same
                                     parent as the cloner.  */
# define CLONE_THREAD  0x00010000 /* Set to add to same thread group.  */
# define CLONE_NEWNS   0x00020000 /* Set to create new namespace.  */
# define CLONE_SYSVSEM 0x00040000 /* Set to shared SVID SEM_UNDO semantics.  */
# define CLONE_SETTLS  0x00080000 /* Set TLS info.  */
# define CLONE_PARENT_SETTID 0x00100000 /* Store TID in userlevel buffer
                                           before MM copy.  */
# define CLONE_CHILD_CLEARTID 0x00200000 /* Register exit futex and memory
                                            location to clear.  */
# define CLONE_DETACHED 0x00400000 /* Create clone detached.  */
# define CLONE_UNTRACED 0x00800000 /* Set if the tracing process can't
                                      force CLONE_PTRACE on this clone.  */
# define CLONE_CHILD_SETTID 0x01000000 /* Store TID in userlevel buffer in
                                          the child.  */
# define CLONE_NEWCGROUP    0x02000000        /* New cgroup namespace.  */
# define CLONE_NEWUTS        0x04000000        /* New utsname group.  */
# define CLONE_NEWIPC        0x08000000        /* New ipcs.  */
# define CLONE_NEWUSER        0x10000000        /* New user namespace.  */
# define CLONE_NEWPID        0x20000000        /* New pid namespace.  */
# define CLONE_NEWNET        0x40000000        /* New network namespace.  */
# define CLONE_IO        0x80000000        /* Clone I/O context.  */
#endif
```

上述调用的```fork```函数定义如下:
```C
#ifdef __ARCH_WANT_SYS_FORK
SYSCALL_DEFINE0(fork)
{
#ifdef CONFIG_MMU
                   //17 = 0x11
	return _do_fork(SIGCHLD, 0, 0, NULL, NULL, 0);
#else
	/* can not support in nommu mode */
	return -EINVAL;
#endif
}
#endif
```
```SIGCHLD```怎么作用在```copy_process```, 需要更多关注```copy_process```函数, 这里不再叙述了.

## vfork

搜索```vfork```, 可以找到```vfork```的代码:
```C
#ifdef __ARCH_WANT_SYS_VFORK
SYSCALL_DEFINE0(vfork)
{
	return _do_fork(CLONE_VFORK | CLONE_VM | SIGCHLD, 0,
			0, NULL, NULL, 0);
}
#endif
```
同```fork```, ```vfork```也是调用```_do_fork```函数, 只是参数不一样.
相比与```fork```, ```vfork```的```clone_flags```增加了```CLONE_VFORK```和两个属性```CLONE_VM```. ```CLONE_VM```使得父子进程享受相同的虚拟地址空间, ```CLONE_VFORK```使得父进程被挂起直到被子进程唤醒. (有点像线程了)
```
# define CLONE_VM      0x00000100 /* Set if VM shared between processes.  */
# define CLONE_VFORK   0x00004000 /* Set if the parent wants the child to
                                     wake it up on mm_release.  */
```
同样, 实验一下```vfork```的功能.
```C
void inc(const char* s, int pid, int i)
{
    printf("%s processor [%d %d] %d\n", s, getppid(), getpid(), i);
}

int main()
{
    volatile int i = 0;
    int pid = vfork();
    i = 100;
    if (pid < 0)
    {
        printf("fork error");
        return -1;
    }
    else if (pid == 0)
    {
        for (int j = 0; j < 100; j++)
        {
            inc("child", pid, i++);
        }
    }
    else
    {
        for (int j = 0; j < 20; j++)
        {
            inc("parent", pid, i++);
        }
    }

    i = 0;
    return 0;
}
```
程序会先输出child, child输出完后才会输出parent, 但是在程序执行最后会出现异常:
```
parent processor [29629 23216] 118
parent processor [29629 23216] 119
Segmentation fault (core dumped)
```
因为调用```vfork```, 子进程需要使用```exit```或者```exec```才能不阻塞父进程. 所以我们将最后的```return 0;```改为```exit(0);```就可以了.

```vfork```的出现本来是为了解决```fork```太过笨重的问题, 在没有写时复制策略之前, ```fork```成本太高, 所以实现了```vfork```做轻量级的进程.

## clone

同样, 我们可以找到```clone```的实现:
```C
#ifdef __ARCH_WANT_SYS_CLONE
#ifdef CONFIG_CLONE_BACKWARDS
SYSCALL_DEFINE5(clone, unsigned long, clone_flags, unsigned long, newsp,
		 int __user *, parent_tidptr,
		 unsigned long, tls,
		 int __user *, child_tidptr)
#elif defined(CONFIG_CLONE_BACKWARDS2)
SYSCALL_DEFINE5(clone, unsigned long, newsp, unsigned long, clone_flags,
		 int __user *, parent_tidptr,
		 int __user *, child_tidptr,
		 unsigned long, tls)
#elif defined(CONFIG_CLONE_BACKWARDS3)
SYSCALL_DEFINE6(clone, unsigned long, clone_flags, unsigned long, newsp,
		int, stack_size,
		int __user *, parent_tidptr,
		int __user *, child_tidptr,
		unsigned long, tls)
#else
SYSCALL_DEFINE5(clone, unsigned long, clone_flags, unsigned long, newsp,
		 int __user *, parent_tidptr,
		 int __user *, child_tidptr,
		 unsigned long, tls)
#endif
{
	return _do_fork(clone_flags, newsp, 0, parent_tidptr, child_tidptr, tls);
}
#endif
```
```C
#ifdef __USE_GNU
/* Clone current process.  */
extern int clone (int (*__fn) (void *__arg), void *__child_stack,
		  int __flags, void *__arg, ...) __THROW;
//...
#endif
```
C语言线程库, 最终调用的也是```clone```函数. ```clone```最终调用```_do_fork```, 但是功能比```fork```更加强大, 传入函数指针, 子进程栈空间, ```clone_flag```, 和函数参数, 就可以实现在子进程中调用函数, 这就是我们常用的线程.

简单使用一下```clone```:
```C
int addone(int *n)
{
    *n = 21;
    printf("[%d %d] add one %d\n", getppid(), getpid(), (*n));
}

int main()
{
    volatile int n = 0;
    void* st;
    st = malloc(FIBER_STACK);

    if (!st)
    {
        printf("error malloc\n");
        return -1;
    }

    printf("create clone\n");
    printf("[%d %d] before add %d\n", getppid(), getpid(), n);
    clone(&addone, (char *)st + FIBER_STACK, CLONE_VM|CLONE_VFORK, &n);
    printf("[%d %d] after add %d\n", getppid(), getpid(), n);

    free(st);
    return 1;
}
```
输出是:
```
create clone
[29629 25737] before add 0
[25737 25738] add one 21
[29629 25737] after add 21
```
即在子进程中的修改可以作用到父进程上.

## 总结

这一篇介绍了PCB, Linux进程控制主要是操作PCB, PCB主要包含进程ID, 内核栈, 权限, 虚拟内存, CPU资源等信息.

Linux使用了写时复制(COW)技术降低进程fork操作的成本. 子进程共享父进程的内存资源, 只有在写操作时, 子进程才会复制对应的内存区域.

glibc库提供了fork, vfork, clone几个函数用来创建进程. fork创建的进程和父进程互不干扰, vfork创建的进程会阻塞父进程, 直到子进程调用exit或者exec. fork和vfork都是通过函数返回值判断是父进程还是子进程. clone提供比较高级的进程功能, 可以开一个进程来运行函数, 并且子进程的修改可以作用在父进程上, pthread库也是通过调用clone实现的.
