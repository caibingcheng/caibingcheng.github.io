# glibc-fopen源码阅读


## FILE

```fopen```返回值是```FILE```结构体, 先来看看[FILE](https://code.woboq.org/userspace/glibc/libio/bits/types/struct_FILE.h.html#_IO_FILE)结构体的内容:

<!--more-->

```C
struct _IO_FILE;
typedef struct _IO_FILE FILE;

struct _IO_FILE
{
  int _flags;                /* High-order word is _IO_MAGIC; rest is flags. */
  /* The following pointers correspond to the C++ streambuf protocol. */
  char *_IO_read_ptr;        /* Current read pointer */
  char *_IO_read_end;        /* End of get area. */
  char *_IO_read_base;       /* Start of putback+get area. */
  char *_IO_write_base;      /* Start of put area. */
  char *_IO_write_ptr;       /* Current put pointer. */
  char *_IO_write_end;       /* End of put area. */
  char *_IO_buf_base;        /* Start of reserve area. */
  char *_IO_buf_end;         /* End of reserve area. */
  /* The following fields are used to support backing up and undo. */
  char *_IO_save_base;       /* Pointer to start of non-current get area. */
  char *_IO_backup_base;     /* Pointer to first valid character of backup area */
  char *_IO_save_end;        /* Pointer to end of non-current get area. */
  struct _IO_marker *_markers;
  struct _IO_FILE   *_chain;
  int _fileno;
  int _flags2;
  __off_t _old_offset;       /* This used to be _offset but it's too small.  */
  /* 1+column number of pbase(); 0 is unknown. */
  unsigned short _cur_column;
  signed char    _vtable_offset;
  char           _shortbuf[1];
  _IO_lock_t     *_lock;
  __off64_t      _offset;
  /* Wide character stream stuff.  */
  struct _IO_codecvt   *_codecvt;
  struct _IO_wide_data *_wide_data;
  //......
  int _mode;
  /* Make sure we don't get into trouble again.  */
  // 最后这个成员_unused2比较有意思, 给的解释是这个成员可以保证不会再出错.
  char _unused2[15 * sizeof (int) - 4 * sizeof (void *) - sizeof (size_t)];
};
```
首先, ```FILE```结构体中包含了缓存区(```fopen```是有缓存区域的)读写指针的位置, 如```_IO_read_ptr```/```_IO_write_ptr```, 也会有指向缓存区头尾的指针, 如```_IO_backup_base```. 还有```_fileno```成员, 会指向文件的fd, 通过```_fileno```可以真正的拿到文件.

### 缓存区

一般来说读写指针都是指向的缓存区, 如下图是**可能的**两种关系:
!["情况一"](https://bu.dusays.com/2022/06/26/62b87a78756d6.png "情况一")

!["情况二"](https://bu.dusays.com/2022/06/26/62b87a8966aa2.png "情况二")

### wide data

同时注意到, 上述读写等指针都是```char*```型的, 应对ascii的字符没问题, 但是文件不仅只有ascii, 会有其他更复杂的格式, 这时候怎么办呢?

针对字符编码格式问题, glibc提供了宽字符流. 在```FILE```中, ```_codecvt```指向的是```_IO_codecvt```, 这是针对字符编码转换的函数表, ```_wide_data```指向```_IO_wide_data```, 这是针对宽字符的读写指针, 如下:
```C
struct _IO_wide_data
{
  wchar_t *_IO_read_ptr;          /* Current read pointer */
  wchar_t *_IO_read_end;          /* End of get area. */
  wchar_t *_IO_read_base;         /* Start of putback+get area. */
  wchar_t *_IO_write_base;        /* Start of put area. */
  wchar_t *_IO_write_ptr;         /* Current put pointer. */
  wchar_t *_IO_write_end;         /* End of put area. */
  wchar_t *_IO_buf_base;          /* Start of reserve area. */
  wchar_t *_IO_buf_end;           /* End of reserve area. */
  /* The following fields are used to support backing up and undo. */
  wchar_t *_IO_save_base;         /* Pointer to start of non-current get area. */
  wchar_t *_IO_backup_base;       /* Pointer to first valid character of
                                   backup area */
  wchar_t *_IO_save_end;          /* Pointer to end of non-current get area. */
  __mbstate_t _IO_state;
  __mbstate_t _IO_last_state;
  struct _IO_codecvt  _codecvt;
  wchar_t             _shortbuf[1];
  const struct _IO_jump_t *_wide_vtable;
};
```
区别于```_IO_FILE```自带的指针, 宽字符的读写指针是```wchar_t*```. 还会有```_wide_vtable```, 这是指向```_IO_jump_t```的指针, ```_IO_jump_t```可以看作是一个操作表, 包含了类似于```read```/```write```等操作.

## sturct file

fd是什么, 见[进程控制和进程通信(四)](https://bbing.com.cn/202105/process-ctracon4/), 进程```task_struct```会有指向进程打开的文件的列表的指针(```struct file```), 如下图. 本文的fd就是指向这个文件列表的下标.

!["fd和files_struct"](https://bu.dusays.com/2022/06/26/62b87a8cc55ce.png "fd和files_struct")

[struct file](https://code.woboq.org/linux/linux/include/linux/fs.h.html#file)如下:
```C
struct file {
	union {
		struct llist_node	fu_llist;
		struct rcu_head 	fu_rcuhead;
	} f_u;
	struct path		                f_path;
	struct inode      	          *f_inode;	/* cached value */
	const struct file_operations	*f_op;
	/*
	 * Protects f_ep_links, f_flags.
	 * Must not be taken from IRQ context.
	 */
	spinlock_t		        f_lock;
	enum rw_hint		      f_write_hint;
	atomic_long_t		      f_count;
	unsigned int 		      f_flags;
	fmode_t			          f_mode;
	struct mutex		      f_pos_lock;
	loff_t			          f_pos;
	struct fown_struct	  f_owner;
	const struct cred	    *f_cred;
	struct file_ra_state	f_ra;
	u64			              f_version;
#ifdef CONFIG_SECURITY
	void			            *f_security;
#endif
	/* needed for tty driver, and maybe others */
	void			            *private_data;
#ifdef CONFIG_EPOLL
	/* Used by fs/eventpoll.c to link all the hooks to this file */
	struct list_head	    f_ep_links;
	struct list_head	    f_tfile_llink;
#endif /* #ifdef CONFIG_EPOLL */
	struct address_space	*f_mapping;
	errseq_t		          f_wb_err;
} __randomize_layout
  __attribute__((aligned(4)));	/* lest something weird decides that 2 is OK */
```
```struct file```会有成员```f_inode```指向文件的inode, 这时候就可以找到文件对应的内容了. (TODO: vfs inode如何对应文件系统inode依然没有找到很好的资料...所以暂且认为有一个表指向吧~)
```f_op```包含了文件的基本操作(这里是指Linux广义的文件), 如```open/read/write```等等, 本文就不再探究这些操作的具体内容了.

综上所述, ```fopen```返回的```FILE```结构体可以通过fd找到```struct file```, 最终找到对应的inode. 那么```fopen```是如何找到fd的呢? 下面来追踪一下fopen的实现方式.

## fopen

```fopen```是glibc提供的用户态的api, 不同操作系统对```fopen```的实现方式是不同的, 这里采用64位Linux的实现方式(```__USE_FILE_OFFSET64``` & ```__USE_LARGEFILE64```)
```C
#define fopen   fopen64
```

在[stdio.h](https://code.woboq.org/userspace/glibc/libio/stdio.h.html)可以找到fopen64和fopen的接口是一样的.
```C
#ifdef __USE_LARGEFILE64
extern FILE *fopen64   (const char *__restrict __filename,
                        const char *__restrict __modes) __wur;
#endif
```

在[iofopen.c](https://code.woboq.org/userspace/glibc/libio/iofopen.c.html), fopen会被绑定到__fopen_internal:
```C
FILE *
__fopen_internal (const char *filename, const char *mode, int is32)
{
  struct locked_FILE
  {
    struct _IO_FILE_plus fp;
#ifdef _IO_MTSAFE_IO
    _IO_lock_t lock;
#endif
    struct _IO_wide_data wd;
  } *new_f = (struct locked_FILE *) malloc (sizeof (struct locked_FILE));
  if (new_f == NULL)
    return NULL;
#ifdef _IO_MTSAFE_IO
  new_f->fp.file._lock = &new_f->lock;
#endif
  _IO_no_init (&new_f->fp.file, 0, 0, &new_f->wd, &_IO_wfile_jumps);
  _IO_JUMPS (&new_f->fp) = &_IO_file_jumps;
  _IO_new_file_init_internal (&new_f->fp);
  if (_IO_file_fopen ((FILE *) new_f, filename, mode, is32) != NULL)
    return __fopen_maybe_mmap (&new_f->fp.file);
  _IO_un_link (&new_f->fp);
  free (new_f);
  return NULL;
}

FILE *
_IO_new_fopen (const char *filename, const char *mode)
{
  return __fopen_internal (filename, mode, 1);
}

weak_alias (_IO_new_fopen, fopen64)
```
关注第20行的```_IO_file_fopen```, 在正常情况下, 会调用[_IO_file_fopen](https://code.woboq.org/userspace/glibc/libio/fileops.c.html)

### 解析mode

```C
versioned_symbol (libc, _IO_new_file_fopen, _IO_file_fopen, GLIBC_2_1);
```
glibc中将[_IO_file_fopen](https://code.woboq.org/userspace/glibc/libio/fileops.c.html)绑定到[_IO_new_file_fopen](https://code.woboq.org/userspace/glibc/libio/fileops.c.html#_IO_new_file_fopen), 下面看[_IO_new_file_fopen](https://code.woboq.org/userspace/glibc/libio/fileops.c.html#_IO_new_file_fopen)的实现:
```C
FILE *_IO_new_file_fopen (FILE *fp, const char *filename, const char *mode, int is32not64)
{
  //......
  int oprot = 0666;
  FILE *result;
  //......
  switch (*mode)
    {
    case 'r':
      omode = O_RDONLY;
      read_write = _IO_NO_WRITES;
      break;
    case 'w':
      omode = O_WRONLY;
      oflags = O_CREAT|O_TRUNC;
      read_write = _IO_NO_READS;
      break;
    //......
    }
  last_recognized = mode;
  for (i = 1; i < 7; ++i)
    {
      switch (*++mode)
        {
        case '\0':
          break;
        case '+':
          omode = O_RDWR;
          read_write &= _IO_IS_APPENDING;
          last_recognized = mode;
          continue;
        case 'x':
          oflags |= O_EXCL;
          last_recognized = mode;
          continue;
        case 'b':
          last_recognized = mode;
          continue;
        //......
        }
      break;
    }
  result = _IO_file_open (fp, filename, omode|oflags, oprot, read_write,
                          is32not64);
  if (result != NULL)
  //...... 这里主要处理宽字符情况, 会修改一些字符指针和操作表
  return result;
}
```

### 获取fd

在```_IO_new_file_fopen```处理了```fopen```指定的文件权限和打开模式, 然后调用[_IO_file_open](https://code.woboq.org/userspace/glibc/libio/fileops.c.html#_IO_file_open)打开文件:
```C
FILE *
_IO_file_open (FILE *fp, const char *filename, int posix_mode, int prot,
               int read_write, int is32not64)
{
  int fdesc;
  if (__glibc_unlikely (fp->_flags2 & _IO_FLAGS2_NOTCANCEL))
    fdesc = __open_nocancel (filename,
                             posix_mode | (is32not64 ? 0 : O_LARGEFILE), prot);
  else
    fdesc = __open (filename, posix_mode | (is32not64 ? 0 : O_LARGEFILE), prot);
  if (fdesc < 0)
    return NULL;
  fp->_fileno = fdesc;
  //......
  _IO_link_in ((struct _IO_FILE_plus *) fp);
  return fp;
}
```
这里主要关注```__open```函数, 这依然是glibc的函数调用, 但是glibc会把```__open```绑定到[__libc_open64](https://code.woboq.org/userspace/glibc/sysdeps/unix/sysv/linux/open64.c.html#58)
```C
strong_alias (__libc_open64, __open)
```
[__libc_open64](https://code.woboq.org/userspace/glibc/sysdeps/unix/sysv/linux/open64.c.html#58)则会执行系统调用.
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
抛开```__libc_open64```继续关注```__open```, 可以看到```__open```返回的是文件的fd, 会保存在FILE结构体的```_fileno```中.

## 总结

```fopen```如何打开文件, 可以见下图:

!["fopen到inode"](https://bu.dusays.com/2022/06/26/62b87a9109048.png "fopen到inode")

## 参考链接

- ```FILE```: [https://code.woboq.org/userspace/glibc/libio/bits/types/struct_FILE.h.html](https://code.woboq.org/userspace/glibc/libio/bits/types/struct_FILE.h.html)
- ```struct file```: [https://code.woboq.org/linux/linux/include/linux/fs.h.html](https://code.woboq.org/linux/linux/include/linux/fs.h.html)
- ```fopen```: [https://code.woboq.org/userspace/glibc/libio/stdio.h.html](https://code.woboq.org/userspace/glibc/libio/stdio.h.html)
- ```iofopen```: [https://code.woboq.org/userspace/glibc/libio/iofopen.c.html](https://code.woboq.org/userspace/glibc/libio/iofopen.c.html)
- ```fileops```: [https://code.woboq.org/userspace/glibc/libio/fileops.c.html](https://code.woboq.org/userspace/glibc/libio/fileops.c.html)
- ```open64```: [https://code.woboq.org/userspace/glibc/sysdeps/unix/sysv/linux/open64.c.html](https://code.woboq.org/userspace/glibc/sysdeps/unix/sysv/linux/open64.c.html)
