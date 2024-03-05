# 初探Linux文件和文件系统


前面的文章讲了进程控制和进程通信的内容, 在学习和准备这些内容的过程中, 发现对Linux文件系统并不是很熟悉. 此前对Linux文件系统的理解非常肤浅, 嘴上会说"万物皆是文件"的话, 但是并不是很理解Linux的文件系统. 这里插入一篇文章, 学习和整理一下Linux文件系统的内容.

<!--more-->

## 文件

> 这一节作为引言, 先看看我们日常操作的一些结果在深入内核去看会更容易理解.

### ls

在Linux上可以使用ls命令查看对应路径下的文件, 比如ls -la查看当前路径下的文件:
```
drwxrwxr-x 3 mi mi 4096 4月  27 19:32 .
drwxrwxr-x 7 mi mi 4096 4月  26 10:02 ..
-rw-rw-r-- 1 mi mi    0 4月  26 10:03 file_attr
drwxrwxr-x 2 mi mi 4096 4月  27 19:32 file_dic
```
每一行代表一个文件或者一个目录, 一行大概可以分成七块区域, 以文件file_attr为例: ```-rw-rw-r--```, ```1```, ```mi```, ```mi```, ```0```, ```4月  26 10:03```, ```file_attr```.

首先可以理解, ```4月  26 10:03```, ```file_attr```代表的是时间和文件名, 且时间是在每次写入文件时才会改变, 打开文件时这个时间是不变的, 所以这里的时间就是最后修改的时间. 其他的部分是什么意思呢?

```-rw-rw-r--```代表文件的权限, 在Linux系统中, 一切操作都有比较严格的权限控制, 对一个文件来说, 它可以读/写/执行, 所以Linux使用```rwx```三个字符分别表示文件的读写和执行权限, 实际上是一个mask, 用3bits表示, 从高到底分别是读写和执行, 所以可以用7表示读写执行权限, 6表示读写权限, 1表示执行权限等等. 针对当前用户, 当前用户组, 其他用户组可以设置不同的读/写/执行权限.

数字```1```则表示有几个文件link了这个文件, 表示的是硬链接. ```mi mi```两项代表这个文件的拥有者和拥有者的用户组. 数字```0```则代表文件内容的大小, 因为没有向文件中添加内容, 所以大小为0.

注意到当前目录表示```.```和上一级目录表示```..```都被ls打印出来了, 其是这两种目录都是文件. 在Linux中目录和文件都被当做文件, 只是属于不同的文件类型.

### 文件权限

普通文件的文件权限比较好理解, 这里就不再验证了. 目录文件的文件权限如何理解呢?

对某个目录./filesystem/, 向关闭所有权限:
```
chmod 000 ./filesystem/
```
这时候再查看就会报错:
```
$ ls ./filesystem/
ls: cannot open directory './filesystem/': Permission denied
```
添加读写权限:
```
chmod 600 ./filesystem/
```
这时候再查看依然会有一些错误:
```
$ ls  ./filesystem/
ls: cannot access './filesystem/file_attr': Permission denied
ls: cannot access './filesystem/file_dic': Permission denied
file_attr  file_dic
```
列举除了目录下的文件, 但是对目录下的文件没有访问权限(继续往下看)?

如果添加读写执行权限, 这一切都正常了:
```
$ ls -la filesystem/
total 12
drwxrwxrwx  3 mi mi 4096 5月  11 20:36 .
drwxrwxrwx 11 mi mi 4096 5月   8 20:32 ..
-rw-rw-r--  1 mi mi    0 5月   8 20:32 file_attr
drwxrwxr-x  2 mi mi 4096 5月  11 20:36 file_dic
```

可以继续类似实验, 总的来说, 目录同样需要读写执行权限, 如果权限不对, 可以会有无法打开文件, 无法ls文件, 无法添加文件, 无法cd到目录等问题.

### stat

可以使用stat查看文件的详细信息, 比如下面两段:

当前目录的信息:
```
$ stat .
  File: .
  Size: 4096            Blocks: 8          IO Block: 4096   directory
Device: 802h/2050d      Inode: 136185988   Links: 3
Access: (0775/drwxrwxr-x)  Uid: ( 1000/      mi)   Gid: ( 1000/      mi)
Access: 2021-05-11 20:36:13.625994262 +0800
Modify: 2021-05-11 20:36:12.533997328 +0800
Change: 2021-05-11 20:36:12.533997328 +0800
 Birth: -
```

某个普通文件的信息:
```
$ stat ./file_attr
  File: ./file_attr
  Size: 0               Blocks: 0          IO Block: 4096   regular empty file
Device: 802h/2050d      Inode: 136185989   Links: 1
Access: (0664/-rw-rw-r--)  Uid: ( 1000/      mi)   Gid: ( 1000/      mi)
Access: 2021-05-12 13:04:02.996823303 +0800
Modify: 2021-05-08 20:32:55.623371621 +0800
Change: 2021-05-08 20:32:55.623371621 +0800
 Birth: -
```

两段信息结构相同, 包含了名称, 大小, link, 日期, 权限等信息.

Inode项是inode的id, inode是实际存储文件信息和内容的结构体, 对操作系统来说, 文件名是陌生的, 操作系统看文件是看的inode. 通过ls -i也可以查看文件的inode id.

目录和文件都有inode.

## 文件系统

> 问题: 文件是怎么储存在磁盘上, 又是如何加载进内存的?

如果让我们自己设计磁盘存储文件的方式, 可能会想到两种:

1. 文件存储在磁盘连续的空间上;
2. 文件分片存储在磁盘连续的空间上;

如果是第一种存储方式, 那么可能会遇到一些问题, 比如磁盘上存储了很多很小的文件, 假设只有1KB, 之后我们删除其中的一些文件, 那么在磁盘上就会有很多坑坑洼洼的小碎片, 如果这时候我们要存储一个比较大文件, 但是没有连续的空间了, 该怎么办呢?  这时候我们可以"整理"一下磁盘, 把分散的文件移动到一起, 这样就会有大的连续的存储空间了. 但是, 这样必然会设计大量的搬运操作, 大大提高系统功耗, 降低系统的效率, 且容易损坏磁盘.

第二种方式这是类比链表(或者类比内存RAM), 将磁盘分成很多很多的小块, 比如每块只有1KB, 那么文件就存储在这些小块上. 比如, 文件小于1KB, 则一块空间就行了, 文件大于1KB, 则每1KB都存储在一小块空间上, 不需要连续. 相比于第一种方法, 第二种方法原生地就把磁盘分割成了很多小块, 就算有超大文件需要存储也用担心有没有足够大小的连续空间的问题. 但是第二种方法就需要存储每个小块的地址, 并且需要知道小块的顺序关系, 而第一种方法一般只需要存储一个地址和文件大小就行了.

一般使用的是第二种存储方式, 按照映射关系又可以分为不同的文件系统, 有的类似树状结构存储, 有的类似链表结构存储.

链式存储:

!["链式存储"](https://bu.dusays.com/2022/06/26/62b87a9d8ab66.png "链式存储")

树状存储:

!["树状存储"](https://bu.dusays.com/2022/06/26/62b87aa068ebe.png "树状存储")

### inode
inode可以认为是操作系统眼中的文件, 磁盘或者内存上都会有inode, 这里是内存上(VFS)的inode, 是一个结构体.

inode在Linux上是已经分配好的, 磁盘上会有一块固定区域存放inode的bitmap, 这也意味着inode的数量是有限的, 在硬盘格式化的时候就已经确定好了. 通过```df -i```可以看到系统各个分区的inode总数和使用数.

所以我们可能会遇到的一个问题是, 硬盘空间明明还有很多, 但是已经无法创建新的文件了, 这时候就可以考虑是不是inode没有了.

[在线看inode结构](https://code.woboq.org/linux/linux/include/linux/fs.h.html#inode)
```C
/*
 * Keep mostly read-only and often accessed (especially for
 * the RCU path lookup and 'stat' data) fields at the beginning
 * of the 'struct inode'
 */
struct inode {
	umode_t				i_mode;               // 文件权限, rwx等
	unsigned short		i_opflags;
	kuid_t				i_uid;                // 文件所属用户id, ls可以看到
	kgid_t				i_gid;                // 文件所属用户组id, ls可以看到
	unsigned int		i_flags;
#ifdef CONFIG_FS_POSIX_ACL
	struct posix_acl	*i_acl;
	struct posix_acl	*i_default_acl;
#endif
	const struct inode_operations	*i_op;
	struct super_block				*i_sb;        // 指向了super block, 对同一个文件系统是唯一的
	struct address_space			*i_mapping;
//......
	/* Stat data, not accessed from path walking */
	unsigned long		i_ino;
	/*
	 * Filesystems may only read i_nlink directly.  They shall use the
	 * following functions for modification:
	 *
	 *    (set|clear|inc|drop)_nlink
	 *    inode_(inc|dec)_link_count
	 */
	union {
		const unsigned int 	i_nlink;
		unsigned int 		__i_nlink;
	};
	dev_t				i_rdev;
	loff_t				i_size;         // 文件大小
	struct timespec64	i_atime;        // 操作时间相关
	struct timespec64	i_mtime;        // 操作时间相关
	struct timespec64	i_ctime;        // 操作时间相关
	spinlock_t			i_lock;	/* i_blocks, i_bytes, maybe i_size */
	unsigned short      i_bytes;
	u8					i_blkbits;
	u8					i_write_hint;
	blkcnt_t			i_blocks;
//......
	union {
		struct pipe_inode_info	*i_pipe;
		struct block_device		*i_bdev;
		struct cdev				*i_cdev;
		char					*i_link;
		unsigned				i_dir_seq;
	};                        	// inode的类型, 比如可以是一个pipe或者link等, 这时候可以不需要磁盘上具体的文件内容, 仅inode结构就可以了
//......
} __randomize_layout;
```

从这个结构体中我们可以看到, inode基本包含一个文件的所有信息, 文件大小, 访问时间, 文件权限等等, 但是**不包括文件名**.

结构体用一个union表示了文件的类型, 比如是pipe文件(i_pipe)还是link的文件(i_link)等等, 因为一个文件同时只能属于一种类型, 不可能既是link有时pipe等等, 所以只需要使用union表示即可.

我们使用的ls和stat等命令就可以打印inode的基本信息.

以下是文件系统的inode, 是在磁盘上的结构, 比如[ext4](https://code.woboq.org/linux/linux/fs/ext4/ext4.h.html)文件系统:
```C
/*
 * Structure of an inode on the disk
 */
struct ext4_inode {
	__le16	i_mode;		/* File mode */
	__le16	i_uid;		/* Low 16 bits of Owner Uid */
	__le32	i_size_lo;	/* Size in bytes */
	__le32	i_atime;	/* Access time */
	__le32	i_ctime;	/* Inode Change time */
	__le32	i_mtime;	/* Modification time */
	__le32	i_dtime;	/* Deletion Time */
	__le16	i_gid;		/* Low 16 bits of Group Id */
	__le16	i_links_count;	/* Links count */
	__le32	i_blocks_lo;	/* Blocks count */
	__le32	i_flags;	/* File flags */
//.......
	__le32	i_block[EXT4_N_BLOCKS];/* Pointers to blocks */
	__le32	i_generation;	/* File version (for NFS) */
	__le32	i_file_acl_lo;	/* File ACL */
	__le32	i_size_high;
	__le32	i_obso_faddr;	/* Obsoleted fragment address */
//......
};
```
在这里也保存了和文件相关的一些基本信息, 比如mode/时间等等, 同时文件系统的inode也包含```i_block```这个成员, ```i_block```就可以指向磁盘上真正的block.

TODO: 虚拟文件系统的inode是如何与文件系统inode关联的.

#### pipe

以下展示的是inode如何描述一个pipe:

!["pipe"](https://bu.dusays.com/2022/06/26/62b87aa30cc5f.png "pipe")

> 前面的文章说过: Linux管道是一个文件, 但是没有具体的文件内容, 在struct inode中就可以看到inode会有一个成员指向pipe_inode_info.

pipe_inode_info结构体如下, 这里会关注tmp_page和bufs, 分别指向了page缓存和pipe的环形缓存队列. 并且这两者都是以page为单位的, 所以这里可以看到, pipe的最小单位是page, 并且pipe结构体中有一个锁, 所以可以猜测, pipe的原子操作是以page(已缓存的tmp_page)为单位(之前的文章中已经有过这个结论).
```C
/**
 *	struct pipe_inode_info - a linux kernel pipe
 *	@mutex: mutex protecting the whole thing
 *	@wait: reader/writer wait point in case of empty/full pipe
 *	@nrbufs: the number of non-empty pipe buffers in this pipe
 *	@buffers: total number of buffers (should be a power of 2)
 *	@curbuf: the current pipe buffer entry
 *	@tmp_page: cached released page
 *	@readers: number of current readers of this pipe
 *	@writers: number of current writers of this pipe
 *	@files: number of struct file referring this pipe (protected by ->i_lock)
 *	@waiting_writers: number of writers blocked waiting for room
 *	@r_counter: reader counter
 *	@w_counter: writer counter
 *	@fasync_readers: reader side fasync
 *	@fasync_writers: writer side fasync
 *	@bufs: the circular array of pipe buffers
 *	@user: the user who created this pipe
 **/
struct pipe_inode_info {
	struct mutex mutex;
	wait_queue_head_t wait;
	unsigned int nrbufs, curbuf, buffers;
	unsigned int readers;
	unsigned int writers;
	unsigned int files;
	unsigned int waiting_writers;
	unsigned int r_counter;
	unsigned int w_counter;
	struct page *tmp_page;
	struct fasync_struct *fasync_readers;
	struct fasync_struct *fasync_writers;
	struct pipe_buffer *bufs;
	struct user_struct *user;
};
```

pipe_buffer的结构内容:
```C
/**
 *	struct pipe_buffer - a linux kernel pipe buffer
 *	@page: the page containing the data for the pipe buffer
 *	@offset: offset of data inside the @page
 *	@len: length of data inside the @page
 *	@ops: operations associated with this buffer. See @pipe_buf_operations.
 *	@flags: pipe buffer flags. See above.
 *	@private: private data owned by the ops.
 **/
struct pipe_buffer {
	struct page *page;
	unsigned int offset, len;
	const struct pipe_buf_operations *ops;
	unsigned int flags;
	unsigned long private;
};
```
pipe_buffer描述了整个pipe的page机构, 偏移量, 操作函数等信息. page还有更复杂的结构, 这里就先不研究了. 总之, 我们还是可以看出pipe与page之间的关系.

### block
TODO: inode如何访问到block的需要再确认.

block是磁盘存储内容的最小单位, 计算机按照block为单位读取磁盘内容. (类比内存按照page为最小单位读写.) 每次读写一个block都会触发一个IO操作.

这里说明的是, inode可以直接将内容存储在block中, 这样一次跳转就可以访问到磁盘的内容, 但是如果直接指向block就会导致文件的最大大小受到限制.

所以inode会有多种机制, 可以直接指向保存内容的block, 也可以指向一个中间block, 这个中间block会指向多个保存有文件内容的block, 或者这个中间block再指向多个次中间block, 这些block再指向保存有文件内容的block.

这样的好处就是不需要过大的inode, inode只需极少数的block指针, 就可以存储很大的文件. 坏处是多级指向会降低对大文件读写的效率, 因为计算机按照block读取文件内容, 多级指向就会增加IO访问次数, 降低读写效率.

以下是文件系统inode到block的多级指向结构:

!["inode-block"](https://bu.dusays.com/2022/06/26/62b87aa57c86e.png "inode-block")

通过inode和block的指向关系, 我们可以大概算出系统支持的最大文件大小. 假设block大小是4KB, 那么通过inode直接指向block, 一个文件最大大概是4KB. 通过一级指向, 那么一个文件最大大概是$(4KB / 64b) * 4KB  = 256MB$. 通过二级指向, 一个文件最大大概有$((4KB / 64b) * 4KB / 64b) * 4KB = 16GB$. 上述是比较简单的计算, 但是计算方式基本如此, 供参考.

### super_block
super block是内核直接管理的block, 内核可以直接拿到这个block的内容. 一个文件系统负责操作一个super block.

[在线看super_block](https://code.woboq.org/linux/linux/include/linux/fs.h.html#super_block):
```C
struct super_block {
	struct list_head	s_list;		/* Keep this first */
	dev_t				s_dev;		/* search index; _not_ kdev_t */
	unsigned char		s_blocksize_bits;
	unsigned long		s_blocksize;
	loff_t				s_maxbytes;	/* Max file size */
	struct file_system_type			*s_type;
	const struct super_operations	*s_op;
	const struct dquot_operations	*dq_op;
	const struct quotactl_ops		*s_qcop;
	const struct export_operations 	*s_export_op;
	unsigned long		s_flags;
	unsigned long		s_iflags;	/* internal SB_I_* flags */
	unsigned long		s_magic;
	struct dentry		*s_root;    // 根结点dentry
	struct rw_semaphore	s_umount;
	int					s_count;
	atomic_t			s_active;
//......
	struct hlist_bl_head	s_roots;	/* alternate root dentries for NFS */
	struct list_head		s_mounts;	/* list of mounts; _not_ for fs use */
	struct block_device		*s_bdev;
	struct backing_dev_info *s_bdi;
	struct mtd_info			*s_mtd;
	struct hlist_node		s_instances;
	unsigned int			s_quota_types;	/* Bitmask of supported quota types */
	struct quota_info		s_dquot;		/* Diskquota specific options */
	struct sb_writers		s_writers;
//......
	char			s_id[32];	/* Informational name */
	uuid_t			s_uuid;		/* UUID */
	unsigned int	s_max_links;
	fmode_t			s_mode;
	/*
	 * The next field is for VFS *only*. No filesystems have any business
	 * even looking at it. You had been warned.
	 */
	struct mutex s_vfs_rename_mutex;	/* Kludge */
	/*
	 * Filesystem subtype.  If non-empty the filesystem type field
	 * in /proc/mounts will be "type.subtype"
	 */
	const char *s_subtype;
	const struct dentry_operations *s_d_op; /* default d_op for dentries */
	/*
	 * Saved pool identifier for cleancache (-1 means none)
	 */
	int cleancache_poolid;
	struct shrinker s_shrink;	/* per-sb shrinker handle */
	/* Number of inodes with nlink == 0 but still referenced */
	atomic_long_t s_remove_count;
	/* Pending fsnotify inode refs */
	atomic_long_t s_fsnotify_inode_refs;
	/* Being remounted read-only */
	int s_readonly_remount;
	/* AIO completions deferred from interrupt context */
	struct workqueue_struct *s_dio_done_wq;
	struct hlist_head s_pins;
	/*
	 * Owning user namespace and default context in which to
	 * interpret filesystem uids, gids, quotas, device nodes,
	 * xattrs and security labels.
	 */
	struct user_namespace *s_user_ns;
	/*
	 * The list_lru structure is essentially just a pointer to a table
	 * of per-node lru lists, each of which has its own spinlock.
	 * There is no need to put them into separate cachelines.
	 */
	struct list_lru		s_dentry_lru;
	struct list_lru		s_inode_lru;
	struct rcu_head		rcu;
	struct work_struct	destroy_work;
	struct mutex		s_sync_lock;	/* sync serialisation lock */
	/*
	 * Indicates how deep in a filesystem stack this SB is
	 */
	int s_stack_depth;
	/* s_inode_list_lock protects s_inodes */
	spinlock_t		s_inode_list_lock ____cacheline_aligned_in_smp;
	struct list_head	s_inodes;	/* all inodes */
	spinlock_t		s_inode_wblist_lock;
	struct list_head	s_inodes_wb;	/* writeback inodes */
} __randomize_layout;
```
很多成员不太懂什么意思, 这里先关注s_root这个成员, s_root指向的是一个dentry, 从名字也可以看出是指向的根结点的dentry, 也就是```/```目录.

因为每个inode都有一个指向super block的指针, 所以每个inode都可以间接访问到根结点, 这也为文件系统的访问奠定了基础.

!["inode-super_block"](https://bu.dusays.com/2022/06/26/62b87aa96c462.png "inode-super_block")

下面来看dentry的结构.

### dentry

dentry是一个目录的结构表示:
```C
struct dentry {
	/* RCU lookup touched fields */
	unsigned int 	d_flags;		/* protected by d_lock */
	seqcount_t 		d_seq;			/* per dentry seqlock */
	struct hlist_bl_node d_hash;	/* lookup hash list */
	struct dentry	 	*d_parent;		/* parent directory */
	struct qstr 		d_name;
	struct inode 		*d_inode;		/* Where the name belongs to - NULL is
					 	* negative */
	unsigned char d_iname[DNAME_INLINE_LEN];	/* small names */
	/* Ref lookup also touches following */
	struct lockref d_lockref;					/* per-dentry lock and refcount */
	const struct dentry_operations *d_op;
	struct super_block *d_sb;	/* The root of the dentry tree */
	unsigned long d_time;		/* used by d_revalidate */
	void *d_fsdata;				/* fs-specific data */
	union {
		struct list_head d_lru;		/* LRU list */
		wait_queue_head_t *d_wait;	/* in-lookup ones only */
	};
	struct list_head d_child;	/* child of parent list */
	struct list_head d_subdirs;	/* our children */
	/*
	 * d_alias and d_rcu can share memory
	 */
	union {
		struct hlist_node d_alias;	/* inode alias list */
		struct hlist_bl_node d_in_lookup_hash;	/* only for in-lookup ones */
	 	struct rcu_head d_rcu;
	} d_u;
} __randomize_layout;
```
每个dentry都会有指向父结点的指针d_parent, 目录名d_name也存在dentry的结构体中, 还会有一个指向inode的指针d_inode, 这也说明目录和文件之间存在一定的关系. 除此之外, dentry也可以之间访问到自己的兄弟结点d_child和孩子结点d_subdirs, 有了这两个指向关系, 系统就可以做一些缓存操作, 不需要每次都从根结点一层一层访问到当前结点(这里是个人猜测的).

比如我们要访问某个文件, 一般会按照以下顺序, 先是解析路径, 找到根结点, 一层一层查找, 直到当前结点.

!["open"](https://bu.dusays.com/2022/06/26/62b87aac891df.png "open")

## 小结

这一篇主要是学习一些概念, 很多知识我也是第一次接触, 不是科班出身.

我们所理解的文件对操作系统来说就是inode, inode存储了文件的基本信息, 包括权限和访问时间等等, 但是inode不包括文件名. inode可以直接访问到文件内容的block, 也可以通过多级跳转访问到文件内容的block, 具体看文件的大小和block大小的关系.

之前学习过的pipe也是一个inode, 并且没有实际的block, 只是系统内存上的一个inode结构体. 通过pipe结构体, 我们也可以看到pipe缓存是以页为基本单位, 并且会给之加锁, 所以pipe对一个page的读写是原子操作的.

目录会和dentry关联, dentry也会有指向inode的指针, 所以目录的一些基本信息也会存储在inode中, 这也可以认为目录也是文件. inode可以直接访问到super block, 进而访问到根结点的dentry, 一般来说我们访问一个文件, 系统会从根结点一层一层的追溯到被访问文件的inode. 文件名和inode的对应关系会存在一个表中, 但是存在哪, 如何存的还需进一步学习.

## 遗留问题(TODO)

1. 查看根目录inode信息, 有几项特殊的内容:
```Shell
ls -ia /
2 .  2 ..  2 dev  2 run
1 proc  1 sys
```
```.``` ```..``` ```dev```和```run```的inode id相同;
```proc```和```sys```的inode id相同;
为什么他们的inode id相同但是内容会不同?

2. inode如何找到block的? 是那个成员指向?
3. dentry找到inode的具体过程如何? 是哪些成员参与指向?

## 参考链接
1. [Linux中的任务和调度[一]](https://zhuanlan.zhihu.com/p/100030111)
2. [Linux的进程地址空间[一]](https://zhuanlan.zhihu.com/p/66794639)
3. [If threads share the same PID, how can they be identified?](https://stackoverflow.com/questions/9305992/if-threads-share-the-same-pid-how-can-they-be-identified)
4. [从内核角度看Linux 线程和进程的区别](https://blog.csdn.net/qq_28351465/article/details/88950311)
5. [linux/include/linux/fs.h](https://code.woboq.org/linux/linux/include/linux/fs.h.html#inode)
6. [Overview of the Linux Virtual File System](https://www.kernel.org/doc/html/latest/filesystems/vfs.html?highlight=inode)
7. [Index Nodes](https://www.kernel.org/doc/html/latest/filesystems/ext4/inodes.html?highlight=inode)
8. [Overlay Filesystem](https://www.kernel.org/doc/html/latest/filesystems/overlayfs.html?highlight=inode)

这一篇知识很浅, 通过写这篇文章对文件系统也有一些粗浅的了解了, 后续还会写一个文件系统的专题.
