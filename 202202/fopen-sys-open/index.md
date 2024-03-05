# glibc-fopen源码阅读-补充篇-open系统调用


上一篇[《glibc-fopen源码阅读》](/202106/fopen-deep)讲到了`fopen`是怎么工作的，以及`FILE`是怎么和文件关联起来的。但是再次阅读之后，发现还是有些细节存在疑问：

<!--more-->

1. 系统调用`openat`怎么就拿到了`fd`？
2. `struct file`怎么和文件内容关联起来的，什么时候关联起来的？

带着以上疑问，继续阅读系统的`open`类函数。不过仅了解`fopen`也是可以的，并不影响对glibc的文件打开过程的理解。

## 系统调用open

上篇已经说到，`fopen`最终通过系统调用`openat`拿到了文件的`fd`，并且将`fd`放到了`FILE`的`_fileno`成员中：
```C
int
__libc_open64 (const char *file, int oflag, ...)
{
  int mode = 0;
  if (__OPEN_NEEDS_MODE (oflag))
    {
      va_list arg;
      va_start (arg, oflag);
      mode = va_arg (arg, int);
      va_end (arg);
    }
  return SYSCALL_CANCEL (openat, AT_FDCWD, file, oflag | EXTRA_OPEN_FLAGS,
                         mode);
}
```

### openat

`fopen`最终走到的系统调用是`openat`，`openat`调用的是`do_sys_open`，对`fopen`来说，调用`openat`和`open`是一样的：
```C
SYSCALL_DEFINE3(open, const char __user *, filename, int, flags, umode_t, mode)
{
	if (force_o_largefile())
		flags |= O_LARGEFILE;
	return do_sys_open(AT_FDCWD, filename, flags, mode);
}
SYSCALL_DEFINE4(openat, int, dfd, const char __user *, filename, int, flags,
		umode_t, mode)
{
	if (force_o_largefile())
		flags |= O_LARGEFILE;
	return do_sys_open(dfd, filename, flags, mode);
}
```

`open`和`openat`指向的都是`do_sys_open`这个函数，下面来看`do_sys_open`：
```C
long do_sys_open(int dfd, const char __user *filename, int flags, umode_t mode)
{
	struct open_flags op;
	int fd = build_open_flags(flags, mode, &op);
	struct filename *tmp;
	if (fd)
		return fd;
	tmp = getname(filename);
	if (IS_ERR(tmp))
		return PTR_ERR(tmp);
	fd = get_unused_fd_flags(flags);
	if (fd >= 0) {
		struct file *f = do_filp_open(dfd, tmp, &op);
		if (IS_ERR(f)) {
			put_unused_fd(fd);
			fd = PTR_ERR(f);
		} else {
			fsnotify_open(f);
			fd_install(fd, f);
		}
	}
	putname(tmp);
	return fd;
}
```
初看可以分为几个部分：

1. 建立`open flag`
2. 获取`name`（什么`name`？）
3. 获取`fd`
4. 打开文件
5. 通知`file system`
6. 将文件注册到进程

下面逐个分析。

### build_open_flags

先是根据不同情况设置不同的`open flag`，我认为这里不是重点，稍微看看就好了，不过注意一下`O_TMPFILE_MASK`（因为最近用到了`tmpfile`这个函数...），有些情况是会直接返回一个错误码的。所以，`fd`相关的返回值，如果是负数则表示发生错误，可以从其返回值大致判断错误类型。
```C
static inline int build_open_flags(int flags, umode_t mode, struct open_flags *op)
{
  // ......
	if (flags & __O_TMPFILE) {
		if ((flags & O_TMPFILE_MASK) != O_TMPFILE)
			return -EINVAL;
		if (!(acc_mode & MAY_WRITE))
			return -EINVAL;
	} else if (flags & O_PATH) {
		/*
		 * If we have O_PATH in the open flag. Then we
		 * cannot have anything other than the below set of flags
		 */
		flags &= O_DIRECTORY | O_NOFOLLOW | O_PATH;
		acc_mode = 0;
	}
  // ......
	return 0;
}
```

### getname

`getname`会返回一个`filename`的结构体，所以先来看看`filename`结构体：
```C
struct filename {
	const char		*name;	/* pointer to actual string */
	const __user char	*uptr;	/* original userland pointer */
	int			refcnt;
	struct audit_names	*aname;
	const char		iname[];
};
```
`audit`对应的是linux审计系统相关，就先不理它了。其余注意到`filename`结构体主要是存储了一些字符串，大概可以猜想到是存储的文件路径相关的字符串。但是为什么需要这么多成员来存储呢？

再看`getname`函数指向的`getname_flags`，这里或许可以找到`filename`的一些原理：
```C
struct filename *
getname_flags(const char __user *filename, int flags, int *empty)
{
  //......
  const size_t size = offsetof(struct filename, iname[1]);
  kname = (char *)result;
  /*
    * size is chosen that way we to guarantee that
    * result->iname[0] is within the same object and that
    * kname can't be equal to result->iname, no matter what.
    */
  result = kzalloc(size, GFP_KERNEL);
  if (unlikely(!result)) {
    __putname(kname);
    return ERR_PTR(-ENOMEM);
  }
  result->name = kname;
  len = strncpy_from_user(kname, filename, PATH_MAX);
  //.......

	result->refcnt = 1;
  //......

	result->uptr = filename;
	result->aname = NULL;
	audit_getname(result);
	return result;
}
```

`kname`指向的是`filename`结构体的第一个成员，它会`alloc`一段空间，下面是关于`kzalloc`函数的描述：

```C
/*
 * kmalloc is the normal method of allocating memory
 * for objects smaller than page size in the kernel.
*/
static __always_inline void *kmalloc(size_t size, gfp_t flags);

static inline void *kzalloc(size_t size, gfp_t flags)
{
	return kmalloc(size, flags | __GFP_ZERO);
}
```
现在可以知道，`filename`结构体的`name`成员指向了`kmalloc`申请的一块内存，这块内存的最大空间是`1Page`，这也就是为什么会有`PATH_MAX`这个系统宏了，其对应大小是`4096`，在我的系统上就是一个`Page`的大小。

```C
len = strncpy_from_user(kname, filename, PATH_MAX);
result->refcnt = 1;
result->uptr = filename;
```

以上，`filename`结构体的`name`成员指向了自己分配的一块内存，其内容是`filename`这个字符串的拷贝，`uptr`成员则指向了`filename`这个字符串，`refcnt`成员被置为1。但是，现在还没回答上面的问题，为什么`filename`结构体会有两个成员来存储同一个字符串？

可以大概猜想一下，调用完`open`之后，`filename`字符串因为是用户申请的，所以可能被回收，如果后续还在使用的话就存在越界的可能，所以需要一块额外的空间存储`filename`字符串，所以就自己申请一块了。后续还会用到`filename`结构体的`name`成员。

### get_unused_fd_flags

`get_unused_fd_flags`调用的是`__alloc_fd`函数，这里注意到`current`，先前已经介绍过，代表当前的`task_struct`，所以这里拿到了当前进程的`files`，在[《进程控制和通信(四) · PCB介绍 》](/202105/process-ctracon4/)中已经讲过`task_struct`和`files`的关系了。
```C
int get_unused_fd_flags(unsigned flags)
{
	return __alloc_fd(current->files, 0, rlimit(RLIMIT_NOFILE), flags);
}
```

下面是摘取自`__alloc_fd`的一些语句：
```C
fdt = files_fdtable(files);
fd = start;
if (fd < files->next_fd)
  fd = files->next_fd;
if (fd < fdt->max_fds)
  fd = find_next_fd(fdt, fd);
//......

error = expand_files(files, fd);
/*
  * If we needed to expand the fs array we
  * might have blocked - try again.
  */
if (error)
  goto repeat;
if (start <= files->next_fd)
  files->next_fd = fd + 1;
__set_open_fd(fd, fdt);
// ......
```

可以知道，`__alloc_fd`的大致过程：

1. 获取`fdtable`
2. 找到一个可用的`fd`
3. 如果没有可用的`fd`，则尝试扩展`fdtable`（参考[《进程控制和通信(四) · PCB介绍 》](/202105/process-ctracon4/)）
4. 扩展后在尝试找一个可用的`fd`
5. 找`fd`成功，设置`fdtable`对应`bit`位

目前为止，文件还是没有被打开，也没有对`filename`指向的文件做任何操作。不过，`fd`和`filename`结构体准备好后，就可以打开文件了。

### do_filp_open

以下是`do_filp_open`函数：
```C
struct file *do_filp_open(int dfd, struct filename *pathname,
		const struct open_flags *op)
{
	struct nameidata nd;
	int flags = op->lookup_flags;
	struct file *filp;
	set_nameidata(&nd, dfd, pathname);
	filp = path_openat(&nd, op, flags | LOOKUP_RCU);
	if (unlikely(filp == ERR_PTR(-ECHILD)))
		filp = path_openat(&nd, op, flags);
	if (unlikely(filp == ERR_PTR(-ESTALE)))
		filp = path_openat(&nd, op, flags | LOOKUP_REVAL);
	restore_nameidata();
	return filp;
}
```
这个函数看着比较简单，大概是先通过`filename`得到一个`nameidata`的结构体，然后就用这个`nameidata`生成了一个`struct file`。

`nameidata`是什么？还是先来看看这个结构体的成员：
```C
struct nameidata {
	struct path	path;
	struct qstr	last;
	struct path	root;
	struct inode	*inode; /* path.dentry.d_inode */
	unsigned int	flags;
	unsigned	seq, m_seq;
	int		last_type;
	unsigned	depth;
	int		total_link_count;
	struct saved {
		struct path link;
		struct delayed_call done;
		const char *name;
		unsigned seq;
	} *stack, internal[EMBEDDED_LEVELS];
	struct filename	*name;
	struct nameidata *saved;
	struct inode	*link_inode;
	unsigned	root_seq;
	int		dfd;
} __randomize_layout;
```

我认为重要的就是两个`inode`，一个是`dentry`的`inode`，一个是`link_inode`。

`set_nameidata`只是大概填写`nameidata`的一些基础信息，关于`inode`的部分这里并没有填写。

```C
static void set_nameidata(struct nameidata *p, int dfd, struct filename *name)
{
	struct nameidata *old = current->nameidata;
	p->stack = p->internal;
	p->dfd = dfd;
	p->name = name;
	p->total_link_count = old ? old->total_link_count : 0;
	p->saved = old;
	current->nameidata = p;
}
```

所以，接下来需要关注`path_openat`函数是怎么填写`nameidata`的：

```C
file = alloc_empty_file(op->open_flag, current_cred());
error = do_o_path(nd, flags, file);
```

摘取了一些语句，大致过程如上，先是申请了一个空的`struct file`，根据`alloc_empty_file`的输入参数，也大概可以看出，`alloc_empty_file`只是申请了一个结构体之类的内存，不会真正打开文件（因为没有路径等信息输入）。然后是`do_o_path`（这里有多个类似的函数入口，仅挑选`do_o_path`追踪）：

```C
static int do_o_path(struct nameidata *nd, unsigned flags, struct file *file)
{
	struct path path;
	int error = path_lookupat(nd, flags, &path);
	if (!error) {
		audit_inode(nd->name, path.dentry, 0);
		error = vfs_open(&path, file);
		path_put(&path);
	}
	return error;
}
```

大概是两步：
```C
int error = path_lookupat(nd, flags, &path);
error = vfs_open(&path, file);
```

在`path_lookupat`的时候会填写`nameidata`的`inode`等成员，因此，`path_lookupat`之后可以通过`nameidata`拿到文件的`dentry`信息了，在`dentry`的`inode`表里就可以找到文件对应的`inode`。

然后通过`vfs_open`打开文件，拿到文件的`inode`等信息填写到`struct file`结构体中。不同的`vfs`会有对应的`open`方法，`vfs_open`指向的`do_dentry_open`方法中，就会使用文件所在`vfs`的`open`方法来打开文件。

到目前为止，已经打开文件，拿到文件的`inode`等信息，并且写入`struct file`了。

!["do_filp_open过程"](https://bu.dusays.com/2022/06/26/62b87a7191bb8.png "do_filp_open过程")

### fsnotify_open

略。（这部分有机会单独讲，关于Linux文件事件）

!["fsnotify_open过程"](https://bu.dusays.com/2022/06/26/62b87a757fa2b.png "fsnotify_open过程")

### fd_install

文件已经打开了，怎么让进程拥有这个文件呢？并且我们已经知道，文件可以通过一个`fd`就能打开了。关键是`fd_install`函数：

```C
void fd_install(unsigned int fd, struct file *file)
{
	__fd_install(current->files, fd, file);
}
```

通过`current`可以获得当前`task_struct`的`files_struct`，进而可以获得`fdtable`。然后将`fdtable`的第`fd`个元素指向`file`这个`struct file`结构体。此时通过`task_struct`就可以找到对应的文件了，并且通过`fd`就能准确在`fdtable`中找到对应的`struct file`。

