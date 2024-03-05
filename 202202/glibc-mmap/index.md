# glibc-mmap源码阅读


本篇通过学习`mmap`的实现，将帮助解答[《进程控制和通信(四) · PCB介绍 》](/202105/process-ctracon4#内存管理)中的一些问题，以及加深对虚拟内存的理解。

<!--more-->

## 入口mmap

先看`mmap`的入口，首先是检查一个`PAGE`的大小以及偏移`offset`是不是满足要求，然后再系统调用`mmap(2)`。

```C
void *
__mmap (void *addr, size_t len, int prot, int flags, int fd, off_t offset)
{
  MMAP_CHECK_PAGE_UNIT ();
  if (offset & MMAP_OFF_LOW_MASK)
    return (void *) INLINE_SYSCALL_ERROR_RETURN_VALUE (EINVAL);
#ifdef __NR_mmap2
  return (void *) MMAP_CALL (mmap2, addr, len, prot, flags, fd,
                             offset / (uint32_t) MMAP2_PAGE_UNIT);
#else
  return (void *) MMAP_CALL (mmap, addr, len, prot, flags, fd,
                             MMAP_ADJUST_OFFSET (offset));
#endif
}
weak_alias (__mmap, mmap)
libc_hidden_def (__mmap)
```

首先关注`PAGE`和`offset`的检查部分：
```C
MMAP_CHECK_PAGE_UNIT ();
if (offset & MMAP_OFF_LOW_MASK)
  return (void *) INLINE_SYSCALL_ERROR_RETURN_VALUE (EINVAL);
```

对应的宏如下：

```C
/* This is the minimum mmap2 unit size accept by the kernel.  An architecture
   with multiple minimum page sizes (such as m68k) might define it as -1 and
   thus it will queried at runtime.  */
#ifndef MMAP2_PAGE_UNIT
# define MMAP2_PAGE_UNIT 4096ULL
#endif
#if MMAP2_PAGE_UNIT == -1
static uint64_t page_unit;
# define MMAP_CHECK_PAGE_UNIT()                      \
  if (page_unit == 0)                                \
    page_unit = __getpagesize ();
# undef MMAP2_PAGE_UNIT
# define MMAP2_PAGE_UNIT page_unit
#else
# define MMAP_CHECK_PAGE_UNIT()
#endif
```

一般设置一个`PAGE`的大小是`4096`，但是也支持动态获取，通过`__getpagesize`可以实时地动态获取`PAGE`大小。

`MMAP_OFF_LOW_MASK`表示`PAGE`的大小减一，例如`PAGE`大小是`4096`，那么对应的`MMAP2_PAGE_UNIT`就是`4095`，转换成二进制就是(`011111111111`)。

```C
/* Do not accept offset not multiple of page size.  */
#define MMAP_OFF_LOW_MASK  (MMAP2_PAGE_UNIT - 1)
```

为什么`MMAP_OFF_LOW_MASK`要表示为`MMAP2_PAGE_UNIT - 1`？ 如果`PAGE`一定是`2^n`大小，那么`MMAP2_PAGE_UNIT`的表示一定是后缀若干个`1`。用`offset & MMAP_OFF_LOW_MASK`判断，如果表达式为`true`，则表示`offset`末尾有`1`，那么它一定不是`PAGE`的整数倍；如果`offset`不是`PAGE`的整数倍，那么`offset & MMAP_OFF_LOW_MASK`一定为`true`吗？（是不是充要条件？）如果前提是，`PAGE`的大小一定是`2^n`，那么上述表述成立。可以大概证明一下：

如果`offset`不是`PAGE`的整数倍，假设`offset`的值是`n × PAGE + m`，`n`和`m`都是整数，且`m < PAGE`。因为`PAGE`是`2^n`，二进制表示的首个数位是`1`, 末尾有若刚个连续的`0`，例如`100000000000`，所以`n × PAGE`末尾连续`0`的个数大于或等于`PAGE`末尾连续`0`的个数。又因为`m < PAGE`，所以`m`的二进制数位长度小于`PAGE`末尾连续`0`的长度，这就会导致`n × PAGE + m`末尾连续`0`的个数小于`PAGE`末尾连续`0`的个数，因此`offset & MMAP_OFF_LOW_MASK`为`true`。

## 系统调用

### do_mmap2

以下是`mmap(2)`系统调用，都指向了`do_mmap2`这个函数：

```C
#define PAGE_SHIFT 12

SYSCALL_DEFINE6(mmap2, unsigned long, addr, size_t, len,
		unsigned long, prot, unsigned long, flags,
		unsigned long, fd, unsigned long, pgoff)
{
	return do_mmap2(addr, len, prot, flags, fd, pgoff, PAGE_SHIFT-12);
}
SYSCALL_DEFINE6(mmap, unsigned long, addr, size_t, len,
		unsigned long, prot, unsigned long, flags,
		unsigned long, fd, off_t, offset)
{
	return do_mmap2(addr, len, prot, flags, fd, offset, PAGE_SHIFT);
}
```

`do_mmap2`如下，也会检查`offset`对齐之类，主要关注`ksys_mmap_pgoff`。

```C
static inline long do_mmap2(unsigned long addr, size_t len,
			unsigned long prot, unsigned long flags,
			unsigned long fd, unsigned long off, int shift)
{
	long ret = -EINVAL;
	if (!arch_validate_prot(prot, addr))
		goto out;
	if (shift) {
		if (off & ((1 << shift) - 1))
			goto out;
		off >>= shift;
	}
	ret = ksys_mmap_pgoff(addr, len, prot, flags, fd, off);
out:
	return ret;
}
```

### ksys_mmap_pgoff

`ksys_mmap_pgoff`如下：

```C
unsigned long ksys_mmap_pgoff(unsigned long addr, unsigned long len,
			      unsigned long prot, unsigned long flags,
			      unsigned long fd, unsigned long pgoff)
{
	struct file *file = NULL;
  //......
  if (!(flags & MAP_ANONYMOUS)) {
		audit_mmap_fd(fd, flags);
		file = fget(fd);
		if (!file)
			return -EBADF;
		if (is_file_hugepages(file))
			len = ALIGN(len, huge_page_size(hstate_file(file)));
		retval = -EINVAL;
		if (unlikely(flags & MAP_HUGETLB && !is_file_hugepages(file)))
			goto out_fput;
	} else if (flags & MAP_HUGETLB) {
		struct user_struct *user = NULL;
		struct hstate *hs;
		hs = hstate_sizelog((flags >> MAP_HUGE_SHIFT) & MAP_HUGE_MASK);
		if (!hs)
			return -EINVAL;
		len = ALIGN(len, huge_page_size(hs));
		/*
		 * VM_NORESERVE is used because the reservations will be
		 * taken when vm_ops->mmap() is called
		 * A dummy user value is used because we are not locking
		 * memory so no accounting is necessary
		 */
		file = hugetlb_file_setup(HUGETLB_ANON_FILE, len,
				VM_NORESERVE,
				&user, HUGETLB_ANONHUGE_INODE,
				(flags >> MAP_HUGE_SHIFT) & MAP_HUGE_MASK);
		if (IS_ERR(file))
			return PTR_ERR(file);
	}
  //......
	retval = vm_mmap_pgoff(file, addr, len, prot, flags, pgoff);
  //......
}
```

大致三个过程：

1. 检查和设置`flag`
2. 内存对齐
3. 执行`vm_mmap_pgoff`

检查和设置`flag`阶段，我比较关注`MAP_HUGETLB`，这是Linux提供的大`PAGE`支持，在[man7](https://man7.org/linux/man-pages/man2/mmap.2.html)中可以找到大概的介绍，在`HUGE PAGE`模式下，可以支持`2MB`甚至`1GB`大小的`PAGE`！大`PAGE`可以减少IO访问的次数，同时也会带来大量的内存碎片。在[《为什么 Linux 默认页大小是 4KB》](https://draveness.me/whys-the-design-linux-default-page/)中，作者有介绍`PAGE`不同大小的影响。

### vm_mmap_pgoff

下面是`vm_mmap_pgoff`，这里比较接近`mmap`的本质了，`current->mm`拿到了当前进程的内存映射结构：

```C
unsigned long vm_mmap_pgoff(struct file *file, unsigned long addr,
	unsigned long len, unsigned long prot,
	unsigned long flag, unsigned long pgoff)
{
	unsigned long ret;
	struct mm_struct *mm = current->mm;
	unsigned long populate;
	LIST_HEAD(uf);
	ret = security_mmap_file(file, prot, flag);
	if (!ret) {
		if (down_write_killable(&mm->mmap_sem))
			return -EINTR;
		ret = do_mmap_pgoff(file, addr, len, prot, flag, pgoff,
				    &populate, &uf);
		up_write(&mm->mmap_sem);
		userfaultfd_unmap_complete(mm, &uf);
		if (populate)
			mm_populate(ret, populate);
	}
	return ret;
}
```

大概分作以下几步：
1. 检查文件安全性
2. `mmap`加锁
3. `mmap`映射
4. `mmap`解锁
（还有`populate`等步骤，不太明白，但是不影响对`mmap`的基本了解，所以本文不过分追究。不过，有机会我还是得去了解了解的～～～基础不太行，先把这些基本的问题搞清楚吧～）

`mmap`加锁和解锁逻辑不需要过分关注，只需要知道`rw_semaphore`是个读写信号量，在这里实现了类似锁的功能，应该是为了保证数据一致性。

### do_mmap

`mmap`映射步骤调用的是`do_mmap_pgoff`，如下，指向的是`do_mmap`：

```C
static inline unsigned long
do_mmap_pgoff(struct file *file, unsigned long addr,
	unsigned long len, unsigned long prot, unsigned long flags,
	unsigned long pgoff, unsigned long *populate,
	struct list_head *uf)
{
	return do_mmap(file, addr, len, prot, flags, 0, pgoff, populate, uf);
}
```

`do_mmap`如下，摘取了部分片段：

```C
/*
 * The caller must hold down_write(&current->mm->mmap_sem).
 */
unsigned long do_mmap(struct file *file, unsigned long addr,
			unsigned long len, unsigned long prot,
			unsigned long flags, vm_flags_t vm_flags,
			unsigned long pgoff, unsigned long *populate,
			struct list_head *uf)
{
	struct mm_struct *mm = current->mm;
  //......
  	/* Obtain the address to map to. we verify (or select) it and ensure
	 * that it represents a valid section of the address space.
	 */
	addr = get_unmapped_area(file, addr, len, pgoff, flags);
	if (offset_in_page(addr))
		return addr;
  //......
	addr = mmap_region(file, addr, len, vm_flags, pgoff, uf);
  //......
}
```

先是检查和修改`prot`和`flags`，这里就不追究这些逻辑了。然后会做内存对齐，检查是否溢出，检查`mapping count`是不是满了（意味着`mapping`数量是有限的，为什么要有限呢？）之类的。

接着通过`get_unmapped_area`获取一个`unmapped`的地址，除了溢出检查外，`get_unmapped_area`大致流程如下：

```C
get_area = current->mm->get_unmapped_area;
if (file) {
  if (file->f_op->get_unmapped_area)
    get_area = file->f_op->get_unmapped_area;
} else if (flags & MAP_SHARED) {
  /*
    * mmap_region() will call shmem_zero_setup() to create a file,
    * so use shmem's get_unmapped_area in case it can be huge.
    * do_mmap_pgoff() will clear pgoff, so match alignment.
    */
  pgoff = 0;
  get_area = shmem_get_unmapped_area;
}
addr = get_area(file, addr, len, pgoff, flags);
```

如果传入了一个文件，那么用文件对应的`get_unmapped_area`获取地址，或者利用进程的`get_unmapped_area`或者利用`shmem_get_unmapped_area`。现在，我们的疑问是，文件或者进程等的`get_unmapped_area`是怎么`mapping`出一块地址给我们的？

找到这么一段[arch_get_unmapped_area](https://code.woboq.org/linux/linux/arch/x86/kernel/sys_x86_64.c.html#arch_get_unmapped_area)，`arch_get_unmapped_area`会被赋值给`current->mm->get_unmapped_area`：

```C
unsigned long
arch_get_unmapped_area(struct file *filp, unsigned long addr,
		unsigned long len, unsigned long pgoff, unsigned long flags)
{
	struct mm_struct *mm = current->mm;
	struct vm_area_struct *vma;
	struct vm_unmapped_area_info info;
	unsigned long begin, end;
	addr = mpx_unmapped_area_check(addr, len, flags);
	if (IS_ERR_VALUE(addr))
		return addr;
	if (flags & MAP_FIXED)
		return addr;
	find_start_end(addr, flags, &begin, &end);
	if (len > end)
		return -ENOMEM;
	if (addr) {
		addr = PAGE_ALIGN(addr);
		vma = find_vma(mm, addr);
		if (end - len >= addr &&
		    (!vma || addr + len <= vm_start_gap(vma)))
			return addr;
	}
	info.flags = 0;
	info.length = len;
	info.low_limit = begin;
	info.high_limit = end;
	info.align_mask = 0;
	info.align_offset = pgoff << PAGE_SHIFT;
	if (filp) {
		info.align_mask = get_align_mask();
		info.align_offset += get_align_bits();
	}
	return vm_unmapped_area(&info);
}
```

主要逻辑是`vm_unmapped_area`，在调用`vm_unmapped_area`之前，会获取虚拟内存的开始地址和结束地址，然后写入`vm_unmapped_area_info`再传入`vm_unmapped_area`。

下面是`vm_unmapped_area`的实现：

```C
unsigned long unmapped_area(struct vm_unmapped_area_info *info)
{
  //......
	vma = rb_entry(mm->mm_rb.rb_node, struct vm_area_struct, vm_rb);
	if (vma->rb_subtree_gap < length)
		goto check_highest;
  //......
  while (true) {
    /* Visit left subtree if it looks promising */
    gap_end = vm_start_gap(vma);
    if (gap_end >= low_limit && vma->vm_rb.rb_left) {
      struct vm_area_struct *left =
        rb_entry(vma->vm_rb.rb_left,
            struct vm_area_struct, vm_rb);
      if (left->rb_subtree_gap >= length) {
        vma = left;
        continue;
      }
    }
  //......
  }
  found:
	/* We found a suitable gap. Clip it with the original low_limit. */
	if (gap_start < info->low_limit)
		gap_start = info->low_limit;
	/* Adjust gap address to the desired alignment */
	gap_start += (info->align_offset - gap_start) & info->align_mask;
	VM_BUG_ON(gap_start + info->length > info->high_limit);
	VM_BUG_ON(gap_start + info->length > gap_end);
	return gap_start;
}
```

这里的`rb`前缀是指红黑树，使用红黑树来管理VMA（Virtual Memory Area）。

先是判断当前进程的虚拟内存块是不是有一个大于或等于`length`大小的，只有满足这个条件，才会继续向下寻找。然后在VMA红黑树的左树找到最左侧的一个满足内存块`gap`大于或等于`length`的虚拟内存块，此时可以满足这个内存块是RB树里面最小的满足大于或等于`length`大小的内存块。

这里存在一些盲区：

1. VMA红黑树怎么构建的？什么时候构建的？
2. 虚拟内存都是按块分配的吗？

最后是`mmap_region`：

```C
addr = mmap_region(file, addr, len, vm_flags, pgoff, uf);
```

（TODO（这个月底之前吧）：内容好多～～不知道的东西有点多，疑惑越来越大，有些问题不好假设了～～所以，`mmap_region`这一小结先不写了，得去看看虚拟内存构建等知识）。

查阅其他资料了解到的，`mmap_region`是负责创建虚拟内存区域的。会有merge vma，link vma等操作。

不过，总算可以知道，`mmap`是映射了虚拟内存上的一块内存。估计程序加载进内存的时候，也会通过这个系统调用！

## 遗留问题

1. VMA如何构建已经构建时机
2. 现代一般架构下（比如X86，ARM等），CPU（加上Cache）可以直接操作硬盘吗？还是必须经过RAM？`mmap`可以虚拟地址直接映射到硬盘吗？还是必须经过RAM？
3. `malloc`等和`mmap`的关联和区别


## 番外

我最开始的疑问是，页表是如何构建以及怎么使用的？

因为我们使用的是虚拟内存，并且已经知道进程的内存在`mm_struct`管理，但是`mm_struct`也是虚拟内存上的，也就是说，如果要找到某个进程的页表，首先得找到这个进程的`mm_struct`，因为虚拟内存的映射是不定的，那么得有一个先对固定的地址，使得内核可以找到进程的页表。

在`mmap`这一篇中，没能解答这个问题，但是查阅一些资料了解到：

`mm_struct`结构体中的`pgd_t * pgd;`代表的是物理地址，`pgd`指向的就是当前进程的页表，是物理内存上的。那么，只要拿到了`pgd`，就可以拿到当前进程的也表了。又因为，`task_struct`是内核管理的，内核的也表是固定的/事先知道的（这一点没有疑问，不然内核启动不了），所以每个进程的`task_struct`又是可以在物理内存上找到的，进而每个进程的`mm_struct`也是在物理内存上可以找到的（通过内核可以找到）。

所以，进程也表加载流程可以是：

1. 切换进程
2. 找到`pgd`
3. 通过`pgd`的物理地址，在内存上找到当前进程的页表
4. MMU工作等

## 总结

期望本文可以加深大家对虚拟内存的理解，以上内容加上[《进程控制和通信(四) · PCB介绍 》](/202105/process-ctracon4#内存管理)，我有以下结论：

1. 进程的页表储存在物理内存上，通过`pgd`代表的物理地址可以找到
2. `mm_struct`表示的是虚拟内存的地址，比如数据段/代码段等等，再通过页表映射到物理内存上
3. Linux内核使用红黑树管理了内存块，`mmap`是在这些内存块上映射的
4. `mmap`会有很多内存对齐的检查，在使用传入参数的时候，最好也要考虑对齐
5. `mmap`是会阻塞的，会有读写信号量
6. `mmap`分配的虚拟内存空间可能比实际需要的大
7. `mmap`可能会失败，比如内存不足
