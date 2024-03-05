# glibc-read/write源码阅读


Linux文件系统可以分为两层，虚拟文件系统(VFS)和驱动。VFS主要和驱动对接，以实现对不同文件系统的适配和管理。本文阅读的`read/write`函数是VFS层面的，源码如下：[https://codebrowser.dev/linux/linux/fs/read_write.c.html](https://codebrowser.dev/linux/linux/fs/read_write.c.html)

<!--more-->

大致结构如下，当然以下所指的设备不一定是真实的物理设备。

![VFS-驱动](https://bu.dusays.com/2023/01/08/63ba3fb60141e.png "VFS-驱动")

## read

`read`的入口如下，输入参数是文件`fd`、buffer、长度。回顾之前的文章中学习过的，`fd`是指文件在`task_struct`中files table的下标，通过`fd`可以找到`struct file`，从而拿到inode，获取到文件内容。

```C
SYSCALL_DEFINE3(read, unsigned int, fd, char __user *, buf, size_t, count)
{
	return ksys_read(fd, buf, count);
}
```

`ksys_read`展开如下：

```C
ssize_t ksys_read(unsigned int fd, char __user *buf, size_t count)
{
	struct fd f = fdget_pos(fd);
	ssize_t ret = -EBADF;
	if (f.file) {
		loff_t pos, *ppos = file_ppos(f.file);
		if (ppos) {
			pos = *ppos;
			ppos = &pos;
		}
		ret = vfs_read(f.file, buf, count, ppos);
		if (ret >= 0 && ppos)
			f.file->f_pos = pos;
		fdput_pos(f);
	}
	return ret;
}
```

其中，`fdget_pos`会调用到以下这个函数：

```C
unsigned long __fdget_pos(unsigned int fd)
{
	unsigned long v = __fdget(fd);
	struct file *file = (struct file *)(v & ~3);
	if (file && (file->f_mode & FMODE_ATOMIC_POS)) {
		if (file_count(file) > 1) {
			v |= FDPUT_POS_UNLOCK;
			mutex_lock(&file->f_pos_lock);
		}
	}
	return v;
}
```

`fdput_pos`展开如下：

```C
static inline void fdput_pos(struct fd f)
{
	if (f.flags & FDPUT_POS_UNLOCK)
		__f_unlock_pos(f.file);
	fdput(f);
}
```

如果文件被标记了`FMODE_ATOMIC_POS`，并且有多线程使用，那么`f_pos`会被加锁保护（认为是原子操作了）。在最后`fdput_pos`的时候则会对应解锁。注意到`struct file *file = (struct file *)(v & ~3);`这在[tagged-pointer-让指针包含更多信息](/202211/tagged-pointer/)一文是介绍过的。

再回`ksys_read`到先是通过`unsigned int fd`拿到`struct fd`，其定义如下：

```C
struct fd {
	struct file *file;
	unsigned int flags;
};
```

这时候可以拿到`struct file`了，回顾一下其中重要的成员有：

```C
struct file {
	struct path			f_path;
	struct inode		*f_inode;	/* cached value */
	const struct file_operations	*f_op;
	//...
}
```

`path`包含dentry、mnt信息，`inode`可以指向物理设备中的信息，`file_operations`保护一组操作表。

`ksys_read`接下来会尝试获取文件的pos（这里是读位置）信息：

```C
loff_t pos, *ppos = file_ppos(f.file);
```

`file_ppos`的返回值被赋给了`long long*`，为什么是一个指针？展开`file_ppos`看看：

```C
/* file_ppos returns &file->f_pos or NULL if file is stream */
static inline loff_t *file_ppos(struct file *file)
{
	return file->f_mode & FMODE_STREAM ? NULL : &file->f_pos;
}
```

如果不是file stream的情况下，会返回`struct file`成员`f_pos`的地址。为什么要返回一个地址，而不是值呢？关注这段逻辑：

```C
if (ppos) {
	pos = *ppos;
	ppos = &pos;
}
```

`ppos`是指针，`ppos`本来是指向`struct file`的`f_pos`成员，上述逻辑走完后，`ppos`指向了一个临时的`pos`，这时候`f_pos`相当于被保护起来了。上述说法说得通，但是为什么不直接赋值给`po`s，这样也不会影响`f_pos`呀？回到`file_ppos`，因为对file stream的情况需要返回`NULL`，如果直接赋值给`pos`再处理这种`NULL`情况的话，事情也不会变得更简单，因此引入一个`ppos`是合理的。

再往下看：

```C
ret = vfs_read(f.file, buf, count, ppos);
if (ret >= 0 && ppos)
	f.file->f_pos = pos;
fdput_pos(f);
```

这段逻辑也可以说`ppos`起到了保护作用，在`vfs_read`之后，如果成功了，则会更新`f_pos`的值，如果失败也就不会更新了。这样做是可以保证失败的时候不会动`f_pos`，但是如果是多线程情况，且没有`FMODE_ATOMIC_POS`标记，`f_pos`的值不是乱套了吗？先进去`vfs_read`看看：

```C
ssize_t vfs_read(struct file *file, char __user *buf, size_t count, loff_t *pos)
{
	//... 校验 ...
	if (count > MAX_RW_COUNT)
		count =  MAX_RW_COUNT;
	if (file->f_op->read)
		ret = file->f_op->read(file, buf, count, pos);
	else if (file->f_op->read_iter)
		ret = new_sync_read(file, buf, count, pos);
	else
		ret = -EINVAL;
	if (ret > 0) {
		fsnotify_access(file);
		add_rchar(current, ret);
	}
	inc_syscr(current);
	return ret;
}
```

如果驱动实现了`read`接口，那么就调用`read`接口，这里依赖驱动实现，就先跳过了；如果驱动没有实现`read`，而是实现`read_iter`，那么就是调用`new_sync_read`，进去看看：

```C
static ssize_t new_sync_read(struct file *filp, char __user *buf, size_t len, loff_t *ppos)
{
	struct kiocb kiocb;
	struct iov_iter iter;
	ssize_t ret;
	init_sync_kiocb(&kiocb, filp);
	kiocb.ki_pos = (ppos ? *ppos : 0);
	iov_iter_ubuf(&iter, READ, buf, len);
	ret = call_read_iter(filp, &kiocb, &iter);
	BUG_ON(ret == -EIOCBQUEUED);
	if (ppos)
		*ppos = kiocb.ki_pos;
	return ret;
}
```

这里遇到了之前没有接触过的结构体（概念）`struct kiocb`和`struct iov_iter`，定义如下：

```C
struct kiocb {
	struct file		*ki_filp;
	loff_t			ki_pos;
	void (*ki_complete)(struct kiocb *iocb, long ret);
	void			*private;
	int			ki_flags;
	u16			ki_ioprio; /* See linux/ioprio.h */
	struct wait_page_queue	*ki_waitq; /* for async buffered IO */
};

struct iov_iter {
	u8 iter_type;
	bool nofault;
	bool data_source;
	bool user_backed;
	union {
		size_t iov_offset;
		int last_offset;
	};
	size_t count;
	union {
		const struct iovec *iov;
		const struct kvec *kvec;
		const struct bio_vec *bvec;
		struct xarray *xarray;
		struct pipe_inode_info *pipe;
		void __user *ubuf;
	};
	union {
		unsigned long nr_segs;
		struct {
			unsigned int head;
			unsigned int start_head;
		};
		loff_t xarray_start;
	};
};
```

这两个结构体可以获取什么信息呢？一个是`struct kiocb`扩展了`struct file`的一些信息，一个是`struct iov_iter`包含用户需要填充的buffer信息。（关于这两个概念先不深挖了，这里是我的知识盲区，似乎涉及到VFS更下面的东西。）经过`init_sync_kiocb`和`iov_iter_ubuf`的填充，就会调用到`call_read_iter`。不过还要注意到`ppos`是会被更新的。

```C
static inline ssize_t call_read_iter(struct file *file, struct kiocb *kio,
				     struct iov_iter *iter)
{
	return file->f_op->read_iter(kio, iter);
}
```

回到`vfs_read`的最后，read完之后，就是通过`fsnotify_access`发送一个access fsnotify。

### 小结

以上就是VFS这一层`read`的大致逻辑。大致流程就是先通过fd获取到`struct file`（这就是为什么`read`之前要先`open`），然后再获取当前的read指针位置，然后调用驱动的`read/read_iter`方法，如果读取成功则发送access fsnotify，最后把read指针更新后的位置回写给`struct file`。

上文还遗留一个问题，如果多线程读怎么办？可以假设驱动层的`read/read_iter`是原子的（那是驱动的事情），但是glibc的`read`默认是没有保护的，所以可能存在一些不安全的情况，比如`f_pos`的更新没有被保护，就可能导致多线程读错位。

关于多线程读的问题，可以再参考`fread`：

```C
size_t
_IO_fread (void *buf, size_t size, size_t count, FILE *fp)
{
	size_t bytes_requested = size * count;
	size_t bytes_read;
	CHECK_FILE (fp, 0);
	if (bytes_requested == 0)
		return 0;
	_IO_acquire_lock (fp);
	bytes_read = _IO_sgetn (fp, (char *) buf, bytes_requested);
	_IO_release_lock (fp);
	return bytes_requested == bytes_read ? count : bytes_read / size;
}
```

可以看到，因为`_IO_acquire_lock`和`_IO_release_lock`，这是可以保证`fread`默认情况下就是线程安全的。

## write

`write`流程和`read`类似的，区别在`vfs_write`的实现：

```C
ssize_t vfs_write(struct file *file, const char __user *buf, size_t count, loff_t *pos)
{
	// ... 校验 ...
	file_start_write(file);
	if (file->f_op->write)
		ret = file->f_op->write(file, buf, count, pos);
	else if (file->f_op->write_iter)
		ret = new_sync_write(file, buf, count, pos);
	else
		ret = -EINVAL;
	if (ret > 0) {
		fsnotify_modify(file);
		add_wchar(current, ret);
	}
	inc_syscw(current);
	file_end_write(file);
	return ret;
}
```

两者区别除了`write`发送的是`fsnotify_modify`通知外，`vfs_write`默认会保护`struct file`的读，怎么做的呢？`file_start_write`最终会调到`__sb_start_write`：

```C
static inline void __sb_start_write(struct super_block *sb, int level)
{
	percpu_down_read(sb->s_writers.rw_sem + level - 1);
}
```

这时候给读加上了锁，可以参考[percpu-rw-semaphore](https://www.kernel.org/doc/html/latest/locking/percpu-rw-semaphore.html)。

在写完之后`file_end_write`调用`__sb_end_write`给读解锁：

```C
static inline void __sb_end_write(struct super_block *sb, int level)
{
	percpu_up_read(sb->s_writers.rw_sem + level-1);
}
```

